import type { NextFunction, Request, Response } from 'express';

import { ProcurementService } from './procurement.service';
import {
  createGRNSchema,
  createPurchaseOrderSchema,
  createRequisitionSchema,
  createSupplierReturnSchema,
  grnIdParamsSchema,
  grnsListQuerySchema,
  purchaseOrderIdParamsSchema,
  purchaseOrdersListQuerySchema,
  receiveGRNSchema,
  requisitionDecisionSchema,
  requisitionIdParamsSchema,
  requisitionsListQuerySchema,
  updatePurchaseOrderSchema,
  updateRequisitionSchema
} from './procurement.schemas';

function getProcurementContext(req: Request) {
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

export const procurementController = {
  approveGRN: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const params = grnIdParamsSchema.parse(req.params);
      const result = await ProcurementService.approveGRN(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  approvePurchaseOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const params = purchaseOrderIdParamsSchema.parse(req.params);
      const result = await ProcurementService.approvePurchaseOrder(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  approveRequisition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const params = requisitionIdParamsSchema.parse(req.params);
      const body = requisitionDecisionSchema.parse(req.body);
      const result = await ProcurementService.approveRequisition(context, params.id, body.remarks);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createGRN: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const body = createGRNSchema.parse(req.body);
      const result = await ProcurementService.createGRN(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createPurchaseOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const body = createPurchaseOrderSchema.parse(req.body);
      const result = await ProcurementService.createPurchaseOrder(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createRequisition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const body = createRequisitionSchema.parse(req.body);
      const result = await ProcurementService.createRequisition(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createSupplierReturn: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const body = createSupplierReturnSchema.parse(req.body);
      const result = await ProcurementService.createSupplierReturn(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getPurchaseOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const params = purchaseOrderIdParamsSchema.parse(req.params);
      const result = await ProcurementService.getPurchaseOrder(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getPurchaseOrderPdf: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const params = purchaseOrderIdParamsSchema.parse(req.params);
      const result = await ProcurementService.createPurchaseOrderPdf(context, params.id);

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);

      return res.status(200).send(result.content);
    } catch (error) {
      return next(error);
    }
  },

  getProcurementMeta: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const result = await ProcurementService.getProcurementMeta(context);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listGRNs: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const query = grnsListQuerySchema.parse(req.query);
      const result = await ProcurementService.listGRNs(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listPurchaseOrders: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const query = purchaseOrdersListQuerySchema.parse(req.query);
      const result = await ProcurementService.listPurchaseOrders(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listRequisitions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const query = requisitionsListQuerySchema.parse(req.query);
      const result = await ProcurementService.listRequisitions(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  receiveGRN: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const params = grnIdParamsSchema.parse(req.params);
      const body = receiveGRNSchema.parse(req.body);
      const result = await ProcurementService.receiveGRN(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  rejectRequisition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const params = requisitionIdParamsSchema.parse(req.params);
      const body = requisitionDecisionSchema.parse(req.body);
      const result = await ProcurementService.rejectRequisition(context, params.id, body.remarks);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  sendPurchaseOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const params = purchaseOrderIdParamsSchema.parse(req.params);
      const result = await ProcurementService.sendPurchaseOrder(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  submitRequisition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const params = requisitionIdParamsSchema.parse(req.params);
      const result = await ProcurementService.submitRequisition(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updatePurchaseOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const params = purchaseOrderIdParamsSchema.parse(req.params);
      const body = updatePurchaseOrderSchema.parse(req.body);
      const result = await ProcurementService.updatePurchaseOrder(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateRequisition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProcurementContext(req);
      const params = requisitionIdParamsSchema.parse(req.params);
      const body = updateRequisitionSchema.parse(req.body);
      const result = await ProcurementService.updateRequisition(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
