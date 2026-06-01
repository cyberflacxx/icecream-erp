import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { hrController } from './hr.controller';

export const hrRouter = Router();

hrRouter.use(authenticateRequest);

hrRouter.get('/employees', requirePermission('employee.read'), hrController.listEmployees);
hrRouter.post('/employees', requirePermission('employee.create'), hrController.createEmployee);
hrRouter.get('/employees/:id', requirePermission('employee.read'), hrController.getEmployee);
hrRouter.patch('/employees/:id', requirePermission('employee.update'), hrController.updateEmployee);
hrRouter.delete('/employees/:id', requirePermission('employee.delete'), hrController.deleteEmployee);

hrRouter.get('/attendance', requirePermission('attendance.read'), hrController.listAttendance);
hrRouter.post('/attendance', requirePermission('attendance.record'), hrController.createAttendance);
hrRouter.get('/attendance/:id', requirePermission('attendance.read'), hrController.getAttendance);

hrRouter.get('/leave', requirePermission('leave.read'), hrController.listLeave);
hrRouter.post('/leave', requirePermission('leave.create'), hrController.createLeave);
hrRouter.get('/leave/:id', requirePermission('leave.read'), hrController.getLeave);
hrRouter.patch('/leave/:id/approve', requirePermission('leave.approve'), hrController.approveLeave);
hrRouter.patch('/leave/:id/reject', requirePermission('leave.approve'), hrController.rejectLeave);

hrRouter.get('/payroll', requirePermission('payroll.read'), hrController.listPayroll);
hrRouter.post('/payroll', requirePermission('payroll.create'), hrController.createPayroll);
hrRouter.get('/payroll/:id', requirePermission('payroll.read'), hrController.getPayroll);
hrRouter.patch('/payroll/:id/approve', requirePermission('payroll.approve'), hrController.approvePayroll);
hrRouter.post('/payroll/:id/pay', requirePermission('payroll.approve'), hrController.payPayroll);
