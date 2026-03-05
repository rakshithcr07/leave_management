const cds = require('@sap/cds')

module.exports = (srv) => {

  // Entities exposed by the service
  const { Employees, LeaveRequests, LeaveBalances, LeaveTypes } = srv.entities

  // CDS query helpers
  const { SELECT, UPDATE, INSERT } = cds.ql


  // -------------------------------------------------------
  // Role definitions used in the system
  // -------------------------------------------------------
  const ROLES = {
    Employee: 'Employee',
    Manager: 'Manager',
    HRAdmin: 'HRAdmin'
  }


  // -------------------------------------------------------
  // Leave request status values
  // -------------------------------------------------------
  const STATUS = {
    Pending: 'Pending',
    Approved: 'Approved',
    Rejected: 'Rejected',
    Cancelled: 'Cancelled'
  }


  // -------------------------------------------------------
  // Returns the logged-in user's identifier
  // In this project user email = employee email
  // -------------------------------------------------------
  const _currentUserId = (req) => req.user && (req.user.id || req.user.sub)


  // -------------------------------------------------------
  // Checks if authentication service already provides roles
  // (useful when deployed with SAP IAS / XSUAA)
  // -------------------------------------------------------
  const _hasRoleClaims = (req) => {
    if (!req.user || typeof req.user.is !== 'function') return false
    try {
      return req.user.is(ROLES.Employee) || req.user.is(ROLES.Manager) || req.user.is(ROLES.HRAdmin)
    } catch (e) {
      return false
    }
  }


  // -------------------------------------------------------
  // Local role detection for development/testing
  // -------------------------------------------------------
  const _inferLocalRole = (req) => {
    const userId = _currentUserId(req)

    if (!userId) return null

    if (userId === 'hradmin@test.com') return ROLES.HRAdmin
    if (userId === 'manager1@test.com') return ROLES.Manager

    return ROLES.Employee
  }


  // Role helper functions
  const _isHRAdmin = (req) => (_hasRoleClaims(req) ? req.user.is(ROLES.HRAdmin) : _inferLocalRole(req) === ROLES.HRAdmin)
  const _isManager = (req) => (_hasRoleClaims(req) ? req.user.is(ROLES.Manager) : _inferLocalRole(req) === ROLES.Manager)
  const _isEmployee = (req) => (_hasRoleClaims(req) ? req.user.is(ROLES.Employee) : _inferLocalRole(req) === ROLES.Employee)


  // -------------------------------------------------------
  // Returns current timestamp for audit fields
  // -------------------------------------------------------
  const _todayISO = () => new Date().toISOString()


  // -------------------------------------------------------
  // Converts input value to Date object safely
  // Returns null if invalid
  // -------------------------------------------------------
  const _toDate = (value) => {
    if (!value) return null

    const d = new Date(value)

    return Number.isNaN(d.getTime()) ? null : d
  }


  // -------------------------------------------------------
  // Calculates number of days between two dates
  // (inclusive calculation)
  // -------------------------------------------------------
  const _daysBetweenInclusive = (startDate, endDate) => {

    const msPerDay = 24 * 60 * 60 * 1000

    const start = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())

    const end = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())

    return Math.floor((end - start) / msPerDay) + 1
  }


  // -------------------------------------------------------
  // Formats date as YYYY-MM-DD
  // -------------------------------------------------------
  const _fmtYMD = (d) => {

    const y = d.getFullYear()

    const m = String(d.getMonth() + 1).padStart(2, '0')

    const day = String(d.getDate()).padStart(2, '0')

    return `${y}-${m}-${day}`
  }


  // -------------------------------------------------------
  // Checks if given date is weekend
  // -------------------------------------------------------
  const _isWeekend = (d) => {

    const dow = d.getDay()

    return dow === 0 || dow === 6
  }


  // -------------------------------------------------------
  // Returns predefined Indian public holidays
  // (simplified fixed list)
  // -------------------------------------------------------
  const _holidaySetForYear = (year) => {

    const fixed = [
      `${year}-01-01`,
      `${year}-01-26`,
      `${year}-08-15`,
      `${year}-10-02`,
      `${year}-12-25`
    ]

    return new Set(fixed)
  }


  // -------------------------------------------------------
  // Splits leave dates into valid working days
  // and invalid days (weekends or holidays)
  // -------------------------------------------------------
  const _splitValidInvalidDates = (startDate, endDate) => {

    const invalidDates = []

    const validDates = []

    const year = startDate.getFullYear()

    const holidays = _holidaySetForYear(year)

    const cur = new Date(startDate.getTime())

    while (cur.getTime() <= endDate.getTime()) {

      const ymd = _fmtYMD(cur)

      const isInvalid = _isWeekend(cur) || holidays.has(ymd)

      if (isInvalid) invalidDates.push(ymd)

      else validDates.push(ymd)

      cur.setDate(cur.getDate() + 1)
    }

    return { validDates, invalidDates }
  }


  // -------------------------------------------------------
  // Finds employee record for logged in user
  // -------------------------------------------------------
  const _getCurrentEmployee = async (tx, req) => {

    const userId = _currentUserId(req)

    if (!userId) req.reject(401, 'Unauthenticated')

    const employee = await tx.run(
      SELECT.one.from(Employees).where({ email: userId })
    )

    if (!employee) req.reject(404, `No employee found for user ${userId}`)

    return employee
  }


  // -------------------------------------------------------
  // Ensures user has at least one valid role
  // -------------------------------------------------------
  const _requireOneRole = (req) => {

    if (_isHRAdmin(req) || _isManager(req) || _isEmployee(req)) return

    req.reject(403, 'Missing required role')
  }


  // -------------------------------------------------------
  // Validates leave request dates and day count
  // -------------------------------------------------------
  const _validateLeaveDatesAndDays = (req) => {

    const start = _toDate(req.data.startDate)

    const end = _toDate(req.data.endDate)

    if (!start || !end)
      req.reject(400, 'startDate and endDate are required')

    if (start.getTime() > end.getTime())
      req.reject(400, 'startDate must be before endDate')

    const expectedDays = _daysBetweenInclusive(start, end)

    const providedDays = Number(req.data.days)

    if (providedDays !== expectedDays)
      req.reject(400, `days must match range (${expectedDays})`)
  }


  // -------------------------------------------------------
  // Reads LeaveBalance for employee + leaveType + year
  // -------------------------------------------------------
  const _getBalanceForYear = async (tx, employeeId, leaveTypeId, year) => {

    return tx.run(
      SELECT.one.from(LeaveBalances)
        .where({ employee_ID: employeeId, leaveType_ID: leaveTypeId, year })
    )
  }


  // -------------------------------------------------------
  // Checks if employee has enough leave balance
  // -------------------------------------------------------
  const _checkSufficientBalance = (req, balance, requestedDays) => {

    const allocated = Number(balance.allocated || 0)

    const used = Number(balance.used || 0)

    const remaining = allocated - used

    if (remaining < requestedDays)

      req.reject(400, 'Insufficient leave balance')
  }


  // -------------------------------------------------------
  // CREATE Leave Request validation logic
  // -------------------------------------------------------
  srv.before('CREATE', 'LeaveRequests', async (req) => {

    if (!_isEmployee(req))

      req.reject(403, 'Only employees can apply leave')

    _validateLeaveDatesAndDays(req)

    const tx = cds.transaction(req)

    const employee = await _getCurrentEmployee(tx, req)

    const start = _toDate(req.data.startDate)

    const end = _toDate(req.data.endDate)

    const { validDates } = _splitValidInvalidDates(start, end)

    req.data.days = validDates.length

    req.data.employee_ID = employee.ID

    req.data.manager_ID = employee.manager_ID

    req.data.status = STATUS.Pending

    const year = start.getFullYear()

    let balance = await _getBalanceForYear(tx, employee.ID, req.data.leaveType_ID, year)

    // Auto create leave balance if missing
    if (!balance) {

      await tx.run(
        INSERT.into(LeaveBalances).entries({
          employee_ID: employee.ID,
          leaveType_ID: req.data.leaveType_ID,
          year: year,
          allocated: 12,
          used: 0
        })
      )

      balance = await _getBalanceForYear(tx, employee.ID, req.data.leaveType_ID, year)
    }

    _checkSufficientBalance(req, balance, Number(req.data.days))
  })

}