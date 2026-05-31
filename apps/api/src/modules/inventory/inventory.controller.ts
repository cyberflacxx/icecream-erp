import type { NextFunction, Request, Response } from 'express';

import { InventoryService } from './inventory.service';
import {
  addFinishedGoodsSchema,
  adjustStockSchema,
  createItemSchema,
  createTransferSchema,
  createWarehouseSchema,
  expiringBatchesQuerySchema,
  inventoryMetaQuerySchema,
  issueStockSchema,
  itemsQuerySchema,
  receiveStockSchema,
  reserveStockSchema,
  stockBalanceParamsSchema,
  stockBalancesQuerySchema,
  stockMovementsQuerySchema,
  transfersQuerySchema,
  updateItemSchema,
  writeOffExpiredSchema
} from './inventory.schemas';

function getInventoryContext(req: Request) {
  if (!req.authContext) {
    throw new Error('Unauthorized');
  }

  return {
    branchId: req.authContext.profile.branchId,
    isBranchScoped: req.authContext.isBranchScoped,
    organizationId: req.authContext.organizationId,
    userProfileId: req.authContext.profile.id
  };
}

export const inventoryController = {
  addFinishedGoods: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const body = addFinishedGoodsSchema.parse(req.body);
      const result = await InventoryService.addFinishedGoods(context, {
        ...body
      });

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  adjustStock: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const body = adjustStockSchema.parse(req.body);
      const result = await InventoryService.adjustStock(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const body = createItemSchema.parse(req.body);
      const result = await InventoryService.createItem(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createTransfer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const body = createTransferSchema.parse(req.body);
      const result = await InventoryService.transferStock(context, {
        ...body,
        requestedBy: context.userProfileId
      });

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createWarehouse: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const body = createWarehouseSchema.parse(req.body);
      const result = await InventoryService.createWarehouse(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getExpiringBatches: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const query = expiringBatchesQuerySchema.parse(req.query);
      const result = await InventoryService.getExpiringBatches(context, query.days);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getInventoryMeta: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const query = inventoryMetaQuerySchema.parse(req.query);
      const result = await InventoryService.getInventoryMeta(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getLowStockItems: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const result = await InventoryService.getLowStockItems(context);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getStockBalance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const params = stockBalanceParamsSchema.parse(req.params);
      const result = await InventoryService.getStockBalance(context, params.itemId, params.warehouseId);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  issueStock: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const body = issueStockSchema.parse(req.body);
      const result = await InventoryService.issueStock(context, {
        allowExpired: body.allowExpired,
        itemId: body.itemId,
        overrideReason: body.overrideReason,
        quantity: body.quantity,
        reference: {
          id: body.referenceId,
          notes: body.overrideReason,
          type: body.referenceType
        },
        warehouseId: body.warehouseId
      });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listItems: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const query = itemsQuerySchema.parse(req.query);
      const result = await InventoryService.listItems(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listStockBalances: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const query = stockBalancesQuerySchema.parse(req.query);
      const result = await InventoryService.listStockBalances(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listStockMovements: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const query = stockMovementsQuerySchema.parse(req.query);
      const result = await InventoryService.listStockMovements(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listTransfers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const query = transfersQuerySchema.parse(req.query);
      const result = await InventoryService.listTransfers(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listWarehouses: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const result = await InventoryService.listWarehouses(context);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  receiveStock: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const body = receiveStockSchema.parse(req.body);
      const result = await InventoryService.receiveStock(context, {
        ...body,
        reference: {
          id: body.batchNumber,
          type: 'goods_received_note'
        }
      });

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  reserveStock: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const body = reserveStockSchema.parse(req.body);
      const result = await InventoryService.reserveStock(context, {
        batchId: body.batchId,
        itemId: body.itemId,
        quantity: body.quantity,
        reference: {
          id: body.referenceId,
          type: body.referenceType
        },
        warehouseId: body.warehouseId
      });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const body = updateItemSchema.parse(req.body);
      const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      if (!itemId) {
        throw new Error('Item id is required.');
      }

      const result = await InventoryService.updateItem(context, itemId, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  writeOffExpired: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getInventoryContext(req);
      const body = writeOffExpiredSchema.parse(req.body);
      const result = await InventoryService.writeOffExpired(context, body.batchId, body.reason);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
