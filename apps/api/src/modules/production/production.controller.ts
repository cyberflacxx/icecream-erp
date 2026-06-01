import type { NextFunction, Request, Response } from 'express';

import {
  cancelProductionBatchSchema,
  closeProductionBatchSchema,
  createProductionBatchSchema,
  productionBatchIdParamsSchema,
  productionBatchesQuerySchema,
  productionDashboardQuerySchema,
  recordQualityResultSchema,
  submitBatchQualitySchema
} from './production.schemas';
import { ProductionService } from './production.service';

function getProductionContext(req: Request) {
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

export const productionController = {
  approveMaterials: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const params = productionBatchIdParamsSchema.parse(req.params);
      const result = await ProductionService.approveMaterials(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  cancelBatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const params = productionBatchIdParamsSchema.parse(req.params);
      const body = cancelProductionBatchSchema.parse(req.body);
      const result = await ProductionService.cancelBatch(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  closeBatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const params = productionBatchIdParamsSchema.parse(req.params);
      const body = closeProductionBatchSchema.parse(req.body);
      const result = await ProductionService.closeBatch(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createBatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const body = createProductionBatchSchema.parse(req.body);
      const result = await ProductionService.createBatch(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getBatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const params = productionBatchIdParamsSchema.parse(req.params);
      const result = await ProductionService.getBatch(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getDashboard: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const query = productionDashboardQuerySchema.parse(req.query);
      const result = await ProductionService.getDashboard(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listBatches: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const query = productionBatchesQuerySchema.parse(req.query);
      const result = await ProductionService.listBatches(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  recordQualityResult: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const params = productionBatchIdParamsSchema.parse(req.params);
      const body = recordQualityResultSchema.parse(req.body);
      const result = await ProductionService.recordQualityResult(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  requestMaterials: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const params = productionBatchIdParamsSchema.parse(req.params);
      const result = await ProductionService.requestMaterials(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  reserveMaterials: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const params = productionBatchIdParamsSchema.parse(req.params);
      const result = await ProductionService.reserveMaterials(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  startBatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const params = productionBatchIdParamsSchema.parse(req.params);
      const result = await ProductionService.startBatch(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  submitQuality: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const params = productionBatchIdParamsSchema.parse(req.params);
      submitBatchQualitySchema.parse(req.body ?? {});
      const result = await ProductionService.submitBatchQuality(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
