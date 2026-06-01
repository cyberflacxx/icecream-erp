import type { NextFunction, Request, Response } from 'express';

import { BranchOperationsService } from './branch-operations.service';
import {
  branchExpensesQuerySchema,
  branchEntityIdParamsSchema,
  branchIdParamsSchema,
  branchSalesQuerySchema,
  createBranchExpenseSchema,
  createBranchSaleSchema,
  initShiftCloseSchema,
  rejectShiftCloseSchema,
  shiftCloseListQuerySchema,
  submitShiftCloseSchema
} from './branch-operations.schemas';

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

export const branchOperationsController = {
  approveShiftClose: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchEntityIdParamsSchema.parse(req.params);
      const result = await BranchOperationsService.approveShiftClose(context, params.branchId, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createBranchExpense: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchIdParamsSchema.parse(req.params);
      const body = createBranchExpenseSchema.parse(req.body);
      const result = await BranchOperationsService.createBranchExpense(context, params.branchId, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createBranchSale: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchIdParamsSchema.parse(req.params);
      const body = createBranchSaleSchema.parse(req.body);
      const result = await BranchOperationsService.createBranchSale(context, params.branchId, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getBranchSale: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchEntityIdParamsSchema.parse(req.params);
      const result = await BranchOperationsService.getBranchSale(context, params.branchId, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getShiftClose: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchEntityIdParamsSchema.parse(req.params);
      const result = await BranchOperationsService.getShiftClose(context, params.branchId, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  initShiftClose: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchIdParamsSchema.parse(req.params);
      const body = initShiftCloseSchema.parse(req.body);
      const result = await BranchOperationsService.initShiftClose(
        context,
        params.branchId,
        body.date,
        body.shift,
      );

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listBranchExpenses: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchIdParamsSchema.parse(req.params);
      const query = branchExpensesQuerySchema.parse(req.query);
      const result = await BranchOperationsService.listBranchExpenses(context, params.branchId, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listBranchSales: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchIdParamsSchema.parse(req.params);
      const query = branchSalesQuerySchema.parse(req.query);
      const result = await BranchOperationsService.listBranchSales(context, params.branchId, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listShiftCloses: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchIdParamsSchema.parse(req.params);
      const query = shiftCloseListQuerySchema.parse(req.query);
      const result = await BranchOperationsService.listShiftCloses(context, params.branchId, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  rejectShiftClose: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchEntityIdParamsSchema.parse(req.params);
      const body = rejectShiftCloseSchema.parse(req.body);
      const result = await BranchOperationsService.rejectShiftClose(context, params.branchId, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  submitShiftClose: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getBranchContext(req);
      const params = branchEntityIdParamsSchema.parse(req.params);
      const body = submitShiftCloseSchema.parse(req.body);
      const result = await BranchOperationsService.submitShiftClose(context, params.branchId, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
