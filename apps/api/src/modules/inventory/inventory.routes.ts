import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { enforceBranchScope } from '../../middleware/branch-scope';
import { requirePermission } from '../../middleware/rbac';
import { inventoryController } from './inventory.controller';

export const inventoryRouter = Router();

inventoryRouter.use(authenticateRequest);

inventoryRouter.get(
  '/items',
  requirePermission('inventory.read'),
  inventoryController.listItems,
);
inventoryRouter.post(
  '/items',
  requirePermission('settings.manage'),
  inventoryController.createItem,
);
inventoryRouter.patch(
  '/items/:id',
  requirePermission('settings.manage'),
  inventoryController.updateItem,
);

inventoryRouter.get(
  '/warehouses',
  requirePermission('inventory.read'),
  inventoryController.listWarehouses,
);
inventoryRouter.post(
  '/warehouses',
  requirePermission('settings.manage'),
  inventoryController.createWarehouse,
);

inventoryRouter.get(
  '/meta',
  requirePermission('inventory.read'),
  inventoryController.getInventoryMeta,
);

inventoryRouter.get(
  '/stock-balances',
  requirePermission('inventory.read'),
  enforceBranchScope,
  inventoryController.listStockBalances,
);
inventoryRouter.get(
  '/stock-balances/:itemId/:warehouseId',
  requirePermission('inventory.read'),
  enforceBranchScope,
  inventoryController.getStockBalance,
);

inventoryRouter.get(
  '/stock-movements',
  requirePermission('inventory.read'),
  enforceBranchScope,
  inventoryController.listStockMovements,
);

inventoryRouter.post(
  '/transfers',
  requirePermission('stock_transfer.create'),
  enforceBranchScope,
  inventoryController.createTransfer,
);
inventoryRouter.get(
  '/transfers',
  requirePermission('inventory.read'),
  enforceBranchScope,
  inventoryController.listTransfers,
);

inventoryRouter.post(
  '/adjustments',
  requirePermission('inventory.adjust'),
  enforceBranchScope,
  inventoryController.adjustStock,
);
inventoryRouter.get(
  '/low-stock',
  requirePermission('inventory.read'),
  inventoryController.getLowStockItems,
);
inventoryRouter.get(
  '/expiring',
  requirePermission('inventory.read'),
  inventoryController.getExpiringBatches,
);
inventoryRouter.post(
  '/write-off',
  requirePermission('inventory.adjust'),
  enforceBranchScope,
  inventoryController.writeOffExpired,
);

// Internal endpoints for service-backed flows.
inventoryRouter.post(
  '/receive-stock',
  requirePermission('goods_received.create'),
  enforceBranchScope,
  inventoryController.receiveStock,
);
inventoryRouter.post(
  '/reserve-stock',
  requirePermission('production_batch.create'),
  enforceBranchScope,
  inventoryController.reserveStock,
);
inventoryRouter.post(
  '/issue-stock',
  requirePermission('inventory.adjust'),
  enforceBranchScope,
  inventoryController.issueStock,
);
inventoryRouter.post(
  '/finished-goods',
  requirePermission('production_batch.close'),
  enforceBranchScope,
  inventoryController.addFinishedGoods,
);
