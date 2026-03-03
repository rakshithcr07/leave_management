using {com.leave.management as db } from '../db/schema';

service LeaveManagementService @(path: '/leave') {
  entity Employees      as projection on db.Employees;
  entity LeaveTypes     as projection on db.LeaveTypes;
  entity LeaveBalances  as projection on db.LeaveBalances;
  entity LeaveRequests  as projection on db.LeaveRequests;
}
 