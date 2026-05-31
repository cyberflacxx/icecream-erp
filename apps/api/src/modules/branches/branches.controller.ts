import type { NextFunction, Request, Response } from 'express';

import { BranchOperationsService } from '../branch-operations/branch-operations.service';
import {
  branchDashboardQuerySchema,
  branchDetailIdParamsSchema,
  branchListQuerySchema,
  branchSalesQuerySchema,
  branchStockQuerySchema,
  createBranchSchema,
  shiftCloseListQuerySchema,
  updateBranchSchema
} from '../branch-operations/branch-operations.schemas';

function getBranchContext(req: Request) {
  if (!req.authContext) {
    throw new Error('Unauthorized');
  }

  return {
    branchId: req.authContext.profile.branchId,
    isBranchScoped: req.authContext.isBranchScoped,
    organizationId: req.authContext.organizationId,
    roles: req.authContext.roles,
    userProfileId: req.authContext.profile.id
  };
}

export const branchesController = {
  createBranch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const body = createBranchSchema.parse(req.body);
      const result = await BranchOperationsService.createBranch(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getBranchDashboard: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchDetailIdParamsSchema.parse(req.params);
      const query = branchDashboardQuerySchema.parse(req.query);
      const result = await BranchOperationsService.getBranchDashboard(context, params.id, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listBranches: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const query = branchListQuerySchema.parse(req.query);
      const result = await BranchOperationsService.listBranches(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listBranchSales: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchDetailIdParamsSchema.parse(req.params);
      const query = branchSalesQuerySchema.parse(req.query);
      const result = await BranchOperationsService.listBranchSales(context, params.id, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listBranchStock: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchDetailIdParamsSchema.parse(req.params);
      const query = branchStockQuerySchema.parse(req.query);
      const result = await BranchOperationsService.listBranchStock(context, params.id, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listShiftCloses: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchDetailIdParamsSchema.parse(req.params);
      const query = shiftCloseListQuerySchema.parse(req.query);
      const result = await BranchOperationsService.listShiftCloses(context, params.id, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateBranch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchDetailIdParamsSchema.parse(req.params);
      const body = updateBranchSchema.parse(req.body);
      const result = await BranchOperationsService.updateBranch(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
