import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { enforceBranchScope } from '../../middleware/branch-scope';
import { requirePermission } from '../../middleware/rbac';
import { productionController } from './production.controller';

export const productionRouter = Router();

productionRouter.use(authenticateRequest);

productionRouter.get(
  '/dashboard',
  requirePermission('production_batch.read'),
  productionController.getDashboard,
);

productionRouter.get(
  '/batches',
  requirePermission('production_batch.read'),
  enforceBranchScope,
  productionController.listBatches,
);
productionRouter.post(
  '/batches',
  requirePermission('production_batch.create'),
  enforceBranchScope,
  productionController.createBatch,
);
productionRouter.get(
  '/batches/:id',
  requirePermission('production_batch.read'),
  enforceBranchScope,
  productionController.getBatch,
);
productionRouter.post(
  '/batches/:id/request-materials',
  requirePermission('production_batch.create'),
  enforceBranchScope,
  productionController.requestMaterials,
);
productionRouter.post(
  '/batches/:id/approve-materials',
  requirePermission('production_batch.create'),
  enforceBranchScope,
  productionController.approveMaterials,
);
productionRouter.post(
  '/batches/:id/reserve-materials',
  requirePermission('production_batch.create'),
  enforceBranchScope,
  productionController.reserveMaterials,
);
productionRouter.post(
  '/batches/:id/start',
  requirePermission('production_batch.create'),
  enforceBranchScope,
  productionController.startBatch,
);
productionRouter.post(
  '/batches/:id/submit-quality',
  requirePermission('production_batch.update_output'),
  enforceBranchScope,
  productionController.submitQuality,
);
productionRouter.patch(
  '/batches/:id/quality-result',
  requirePermission('production_quality.approve'),
  enforceBranchScope,
  productionController.recordQualityResult,
);
productionRouter.post(
  '/batches/:id/close',
  requirePermission('production_batch.close'),
  enforceBranchScope,
  productionController.closeBatch,
);
productionRouter.post(
  '/batches/:id/cancel',
  requirePermission('production_batch.create'),
  enforceBranchScope,
  productionController.cancelBatch,
);
