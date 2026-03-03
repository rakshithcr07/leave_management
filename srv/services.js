const cds = require('@sap/cds')
const { SELECT, UPDATE } = cds.ql

module.exports = cds.service.impl(function () {
  const { Employees, LeaveRequests, LeaveBalances, LeaveTypes } = this.entities

  const _currentUserId = (req) => req.user && (req.user.id || req.user.sub)

  const _getCurrentEmployee = async (tx, req) => {
    const userId = _currentUserId(req)
    if (!userId) req.reject(401, 'Unauthenticated')

    const employee = await tx.run(SELECT.one.from(Employees).where({ email: userId }))
    if (!employee) req.reject(404, `No employee found for user ${userId}`)
    return employee
  }

  const _getIdFromReq = (req) => {
    if (req.data?.ID) return req.data.ID
    const p0 = req.params && req.params[0]
    if (p0?.ID) return p0.ID
    return null
  }

  const _requireAdmin = (req) => {
    if (!req.user) req.reject(401, 'Unauthenticated')
    const isAdmin =
      req.user.is?.('admin') ||
      req.user.is?.('Admin') ||
      req.user.roles?.includes?.('admin') ||
      req.user.roles?.includes?.('Admin')
    if (!isAdmin) req.reject(403, 'Admin privileges required')
  }

  const _normalizeLeaveTypeCode = (req) => {
    if (req.data?.code == null) return
    const code = String(req.data.code).trim()
    if (!code) req.reject(400, 'code is required')
    req.data.code = code.toUpperCase()
  }

  this.before('CREATE', LeaveRequests, async (req) => {
    const tx = cds.tx(req)
    const employee = await _getCurrentEmployee(tx, req)

    req.data.employee_ID = employee.ID

    if (!employee.manager_ID) req.reject(400, 'No manager assigned to employee')
    req.data.manager_ID = employee.manager_ID

    if (!req.data.status) req.data.status = 'Pending'
    if (req.data.status !== 'Pending') req.reject(400, 'New leave request status must be Pending')
  })

  this.before('CREATE', LeaveTypes, async (req) => {
    _requireAdmin(req)
    _normalizeLeaveTypeCode(req)

    if (!req.data.name || !String(req.data.name).trim()) req.reject(400, 'name is required')

    const tx = cds.tx(req)
    const existing = await tx.run(SELECT.one.from(LeaveTypes).columns('ID').where({ code: req.data.code }))
    if (existing) req.reject(400, `LeaveType code already exists: ${req.data.code}`)
  })

  this.before('UPDATE', LeaveTypes, async (req) => {
    _requireAdmin(req)
    _normalizeLeaveTypeCode(req)

    const id = _getIdFromReq(req)
    if (!id) req.reject(400, 'Missing leave type ID')

    if (req.data.code) {
      const tx = cds.tx(req)
      const dup = await tx.run(
        SELECT.one.from(LeaveTypes).columns('ID').where({ code: req.data.code, ID: { '!=': id } })
      )
      if (dup) req.reject(400, `LeaveType code already exists: ${req.data.code}`)
    }
  })

  this.before('DELETE', LeaveTypes, async (req) => {
    _requireAdmin(req)

    const id = _getIdFromReq(req)
    if (!id) req.reject(400, 'Missing leave type ID')

    const tx = cds.tx(req)
    const usedInRequests = await tx.run(
      SELECT.one.from(LeaveRequests).columns('ID').where({ leaveType_ID: id })
    )
    if (usedInRequests) req.reject(400, 'Cannot delete leave type: referenced by leave requests')

    const usedInBalances = await tx.run(
      SELECT.one.from(LeaveBalances).columns('ID').where({ leaveType_ID: id })
    )
    if (usedInBalances) req.reject(400, 'Cannot delete leave type: referenced by leave balances')
  })

  this.before('UPDATE', LeaveRequests, async (req) => {
    const tx = cds.tx(req)
    const employee = await _getCurrentEmployee(tx, req)

    const id = _getIdFromReq(req)
    if (!id) req.reject(400, 'Missing leave request ID')

    const existing = await tx.run(
      SELECT.one.from(LeaveRequests).columns('employee_ID', 'manager_ID', 'status').where({ ID: id })
    )
    if (!existing) req.reject(404, 'Leave request not found')

    req._oldLeaveRequestStatus = existing.status

    if (req.data.employee || req.data.employee_ID) req.reject(400, 'employee cannot be changed')
    if (req.data.manager || req.data.manager_ID) req.reject(400, 'manager cannot be changed')

    if (req.data.status) {
      const newStatus = req.data.status
      const oldStatus = existing.status

      if (oldStatus !== 'Pending') req.reject(400, 'Only Pending requests can be updated')

      if (newStatus === 'Approved' || newStatus === 'Rejected') {
        if (employee.ID !== existing.manager_ID) req.reject(403, 'Only the manager can approve/reject')
        req.data.decisionAt = new Date().toISOString()
      } else if (newStatus === 'Cancelled') {
        if (employee.ID !== existing.employee_ID) req.reject(403, 'Only the employee can cancel')
      } else if (newStatus === 'Pending') {
        req.reject(400, 'Status is already Pending')
      } else {
        req.reject(400, 'Invalid status')
      }
    }
  })

  this.after('UPDATE', LeaveRequests, async (data, req) => {
    const id = data?.ID || _getIdFromReq(req)
    if (!id) return
    if (!data?.status) return

    const oldStatus = req._oldLeaveRequestStatus
    if (oldStatus !== 'Pending' || data.status !== 'Approved') return

    const tx = cds.tx(req)

    const approved = await tx.run(
      SELECT.one
        .from(LeaveRequests)
        .columns('employee_ID', 'leaveType_ID', 'startDate', 'days', 'status')
        .where({ ID: id })
    )
    if (!approved || approved.status !== 'Approved') return

    const year = approved.startDate
      ? new Date(approved.startDate).getFullYear()
      : new Date().getFullYear()

    const updated = await tx.run(
      UPDATE(LeaveBalances)
        .set({ used: { '+=': approved.days || 0 } })
        .where({ employee_ID: approved.employee_ID, leaveType_ID: approved.leaveType_ID, year })
    )

    if (!updated || updated === 0 || updated.affectedRows === 0) {
      req.reject(400, 'No leave balance found for employee/type/year')
    }
  })

  this.before('DELETE', LeaveRequests, async (req) => {
    const tx = cds.tx(req)
    const employee = await _getCurrentEmployee(tx, req)

    const id = _getIdFromReq(req)
    if (!id) req.reject(400, 'Missing leave request ID')

    const existing = await tx.run(
      SELECT.one.from(LeaveRequests).columns('employee_ID', 'status').where({ ID: id })
    )
    if (!existing) req.reject(404, 'Leave request not found')

    if (existing.employee_ID !== employee.ID) req.reject(403, 'Only the employee can delete the request')
    if (existing.status !== 'Pending') req.reject(400, 'Only Pending requests can be deleted')
  })
})
