import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { enforceBranchScope } from '../../middleware/branch-scope';
import { requirePermission } from '../../middleware/rbac';
import { branchOperationsController } from './branch-operations.controller';

export const branchOperationsRouter = Router();

branchOperationsRouter.use(authenticateRequest);

branchOperationsRouter.get(
  '/:branchId/sales',
  requirePermission('branch_sales.read'),
  enforceBranchScope,
  branchOperationsController.listBranchSales,
);
branchOperationsRouter.post(
  '/:branchId/sales',
  requirePermission('branch_sales.create'),
  enforceBranchScope,
  branchOperationsController.createBranchSale,
);
branchOperationsRouter.get(
  '/:branchId/sales/:id',
  requirePermission('branch_sales.read'),
  enforceBranchScope,
  branchOperationsController.getBranchSale,
);

branchOperationsRouter.get(
  '/:branchId/expenses',
  requirePermission('branch_shift.close'),
  enforceBranchScope,
  branchOperationsController.listBranchExpenses,
);
branchOperationsRouter.post(
  '/:branchId/expenses',
  requirePermission('branch_shift.close'),
  enforceBranchScope,
  branchOperationsController.createBranchExpense,
);

branchOperationsRouter.get(
  '/:branchId/shift-closes',
  requirePermission('branch_shift.close'),
  enforceBranchScope,
  branchOperationsController.listShiftCloses,
);
branchOperationsRouter.post(
  '/:branchId/shift-closes',
  requirePermission('branch_shift.close'),
  enforceBranchScope,
  branchOperationsController.initShiftClose,
);
branchOperationsRouter.get(
  '/:branchId/shift-closes/:id',
  requirePermission('branch_shift.close'),
  enforceBranchScope,
  branchOperationsController.getShiftClose,
);
branchOperationsRouter.post(
  '/:branchId/shift-closes/:id/submit',
  requirePermission('branch_shift.close'),
  enforceBranchScope,
  branchOperationsController.submitShiftClose,
);
branchOperationsRouter.post(
  '/:branchId/shift-closes/:id/approve',
  requirePermission('branch_shift.close'),
  enforceBranchScope,
  branchOperationsController.approveShiftClose,
);
