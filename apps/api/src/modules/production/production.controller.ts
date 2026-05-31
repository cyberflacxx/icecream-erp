import type { NextFunction, Request, Response } from 'express';

import { productionDashboardQuerySchema } from './production.schemas';
import { ProductionService } from './production.service';

function getProductionContext(req: Request) {
  if (!req.authContext) {
    throw new Error('Unauthorized');
  }

  return {
    branchId: req.authContext.profile.branchId,
    isBranchScoped: req.authContext.isBranchScoped,
    organizationId: req.authContext.organizationId
  };
}

export const productionController = {
  getDashboard: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getProductionContext(req);
      const query = productionDashboardQuerySchema.parse(req.query);
      const result = await ProductionService.getDashboard(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};

