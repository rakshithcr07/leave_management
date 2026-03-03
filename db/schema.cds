namespace com.leave.management;

using { cuid, managed } from '@sap/cds/common';


type LeaveApprovalStatus      : String enum {
  Pending;
  Approved;
  Rejected;
  Cancelled;
}

entity Employees : cuid, managed {
  employeeCode : String(20);
  firstName    : String(80);
  lastName     : String(80);
  email        : String(255);
  manager      : Association to Employees;
}

entity LeaveTypes : cuid, managed {
  code        : String(20);
  name        : String(80);
  description : String(255);
}

entity LeaveBalances : cuid, managed {
  employee  : Association to Employees;
  leaveType : Association to LeaveTypes;
  year      : Integer;
  allocated : Decimal(9,2);
  used      : Decimal(9,2);
}

entity LeaveRequests : cuid, managed {
  employee       : Association to Employees;
  manager        : Association to Employees;
  leaveType      : Association to LeaveTypes;
  startDate      : Date;
  endDate        : Date;
  days           : Integer;
  status         : LeaveApprovalStatus default 'Pending';
  managerComment : String(500);
  decisionAt     : Timestamp;
}
