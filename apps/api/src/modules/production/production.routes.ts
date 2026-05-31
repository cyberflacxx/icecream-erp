import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { productionController } from './production.controller';

export const productionRouter = Router();

productionRouter.use(authenticateRequest);

productionRouter.get(
  '/dashboard',
  requirePermission('production_batch.read'),
  productionController.getDashboard,
);
