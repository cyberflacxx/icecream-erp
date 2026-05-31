import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { branchesController } from './branches.controller';

export const branchesRouter = Router();

branchesRouter.use(authenticateRequest);

branchesRouter.get(
  '/',
  requirePermission(['branch_sales.read', 'settings.manage']),
  branchesController.listBranches,
);
branchesRouter.post(
  '/',
  requirePermission('settings.manage'),
  branchesController.createBranch,
);
branchesRouter.patch(
  '/:id',
  requirePermission('settings.manage'),
  branchesController.updateBranch,
);
branchesRouter.get(
  '/:id/dashboard',
  requirePermission(['branch_sales.read', 'branch_shift.close']),
  branchesController.getBranchDashboard,
);
branchesRouter.get(
  '/:id/stock',
  requirePermission(['inventory.read', 'branch_sales.read']),
  branchesController.listBranchStock,
);
branchesRouter.get(
  '/:id/sales',
  requirePermission('branch_sales.read'),
  branchesController.listBranchSales,
);
branchesRouter.get(
  '/:id/shift-closes',
  requirePermission('branch_shift.close'),
  branchesController.listShiftCloses,
);
