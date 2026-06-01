import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { maintenanceController } from './maintenance.controller';

export const maintenanceRouter = Router();

maintenanceRouter.use(authenticateRequest);

maintenanceRouter.get('/machines', requirePermission('maintenance.read'), maintenanceController.listMachines);
maintenanceRouter.post('/machines', requirePermission('maintenance.manage'), maintenanceController.createMachine);
maintenanceRouter.get('/machines/:id', requirePermission('maintenance.read'), maintenanceController.getMachine);
maintenanceRouter.patch('/machines/:id', requirePermission('maintenance.manage'), maintenanceController.updateMachine);

maintenanceRouter.get('/schedules', requirePermission('maintenance.read'), maintenanceController.listSchedules);
maintenanceRouter.post('/schedules', requirePermission('maintenance.manage'), maintenanceController.createSchedule);
maintenanceRouter.get('/schedules/:id', requirePermission('maintenance.read'), maintenanceController.getSchedule);
maintenanceRouter.patch('/schedules/:id', requirePermission('maintenance.manage'), maintenanceController.updateSchedule);
maintenanceRouter.post('/schedules/:id/complete', requirePermission('maintenance.manage'), maintenanceController.completeSchedule);

maintenanceRouter.get('/breakdowns', requirePermission('maintenance.read'), maintenanceController.listBreakdowns);
maintenanceRouter.post('/breakdowns', requirePermission('maintenance.manage'), maintenanceController.createBreakdown);
maintenanceRouter.get('/breakdowns/:id', requirePermission('maintenance.read'), maintenanceController.getBreakdown);
maintenanceRouter.patch('/breakdowns/:id', requirePermission('maintenance.manage'), maintenanceController.updateBreakdown);
maintenanceRouter.post('/breakdowns/:id/resolve', requirePermission('maintenance.manage'), maintenanceController.resolveBreakdown);
