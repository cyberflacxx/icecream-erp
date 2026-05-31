import type { NextFunction, Request, Response } from 'express';

import { financeDashboardQuerySchema } from './finance.schemas';
import { FinanceService } from './finance.service';

function getFinanceContext(req: Request) {
  if (!req.authContext) {
    throw new Error('Unauthorized');
  }

  return {
    organizationId: req.authContext.organizationId
  };
}

export const financeController = {
  getDashboard: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getFinanceContext(req);
      const query = financeDashboardQuerySchema.parse(req.query);
      const result = await FinanceService.getDashboard(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};

