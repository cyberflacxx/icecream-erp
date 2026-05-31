import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { suppliersController } from './suppliers.controller';

export const suppliersRouter = Router();

suppliersRouter.use(authenticateRequest);

suppliersRouter.get(
  '/',
  requirePermission('supplier.read'),
  suppliersController.listSuppliers,
);
suppliersRouter.get(
  '/meta',
  requirePermission('supplier.read'),
  suppliersController.listSupplierCategories,
);
suppliersRouter.post(
  '/',
  requirePermission('supplier.create'),
  suppliersController.createSupplier,
);
suppliersRouter.get(
  '/:id',
  requirePermission('supplier.read'),
  suppliersController.getSupplier,
);
suppliersRouter.patch(
  '/:id',
  requirePermission('supplier.update'),
  suppliersController.updateSupplier,
);
suppliersRouter.delete(
  '/:id',
  requirePermission('supplier.delete'),
  suppliersController.deleteSupplier,
);
suppliersRouter.get(
  '/:id/purchase-history',
  requirePermission('supplier.read'),
  suppliersController.getSupplierPurchaseHistory,
);
suppliersRouter.post(
  '/:id/balance',
  requirePermission('supplier.update'),
  suppliersController.updateSupplierBalance,
);
