import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { financeController } from './finance.controller';

export const financeRouter = Router();

financeRouter.use(authenticateRequest);

financeRouter.get(
  '/dashboard',
  requirePermission('finance.read'),
  financeController.getDashboard,
);

