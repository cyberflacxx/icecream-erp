import type { NextFunction, Request, Response } from 'express';

import { SuppliersService } from './suppliers.service';
import {
  createSupplierSchema,
  listSuppliersQuerySchema,
  supplierIdParamsSchema,
  supplierPurchaseHistoryQuerySchema,
  updateSupplierBalanceSchema,
  updateSupplierSchema
} from './suppliers.schemas';

function getSupplierContext(req: Request) {
  if (!req.authContext) {
    throw new Error('Unauthorized');
  }

  return {
    organizationId: req.authContext.organizationId,
    userProfileId: req.authContext.profile.id
  };
}

export const suppliersController = {
  createSupplier: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSupplierContext(req);
      const body = createSupplierSchema.parse(req.body);
      const result = await SuppliersService.createSupplier(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  deleteSupplier: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSupplierContext(req);
      const params = supplierIdParamsSchema.parse(req.params);
      const result = await SuppliersService.deleteSupplier(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getSupplier: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSupplierContext(req);
      const params = supplierIdParamsSchema.parse(req.params);
      const result = await SuppliersService.getSupplier(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getSupplierPurchaseHistory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSupplierContext(req);
      const params = supplierIdParamsSchema.parse(req.params);
      const query = supplierPurchaseHistoryQuerySchema.parse(req.query);
      const result = await SuppliersService.getSupplierPurchaseHistory(context, params.id, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listSuppliers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSupplierContext(req);
      const query = listSuppliersQuerySchema.parse(req.query);
      const result = await SuppliersService.listSuppliers(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listSupplierCategories: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSupplierContext(req);
      const result = await SuppliersService.listSupplierCategories(context);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateSupplier: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSupplierContext(req);
      const params = supplierIdParamsSchema.parse(req.params);
      const body = updateSupplierSchema.parse(req.body);
      const result = await SuppliersService.updateSupplier(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateSupplierBalance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSupplierContext(req);
      const params = supplierIdParamsSchema.parse(req.params);
      const body = updateSupplierBalanceSchema.parse(req.body);
      const result = await SuppliersService.updateSupplierBalance(
        context,
        params.id,
        body.amount,
        body.type,
      );

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
