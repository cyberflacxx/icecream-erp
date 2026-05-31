import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { reportsController } from './reports.controller';

export const reportsRouter = Router();

reportsRouter.use(authenticateRequest);

reportsRouter.get('/', requirePermission('reports.read'), reportsController.getReport);
reportsRouter.get('/export/csv', requirePermission('reports.read'), reportsController.exportCsv);
reportsRouter.get('/export/pdf', requirePermission('reports.read'), reportsController.exportPdf);
reportsRouter.get('/dashboard', requirePermission('dashboard.read'), reportsController.getDashboardData);
