import type { NextFunction, Request, Response } from 'express';

import {
  createJournalEntrySchema,
  financeDashboardQuerySchema,
  financeJournalIdParamsSchema,
  financeJournalListQuerySchema,
  updateJournalEntrySchema
} from './finance.schemas';
import { FinanceService } from './finance.service';

function getFinanceContext(req: Request) {
  if (!req.authContext) {
    throw new Error('Unauthorized');
  }

  return {
    organizationId: req.authContext.organizationId,
    userProfileId: req.authContext.profile.id
  };
}

export const financeController = {
  createJournalEntry: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getFinanceContext(req);
      const body = createJournalEntrySchema.parse(req.body);
      const result = await FinanceService.createJournalEntry(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  deleteJournalEntry: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getFinanceContext(req);
      const params = financeJournalIdParamsSchema.parse(req.params);
      const result = await FinanceService.deleteJournalEntry(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getDashboard: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getFinanceContext(req);
      const query = financeDashboardQuerySchema.parse(req.query);
      const result = await FinanceService.getDashboard(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getJournalEntry: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getFinanceContext(req);
      const params = financeJournalIdParamsSchema.parse(req.params);
      const result = await FinanceService.getJournalEntry(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listJournalEntries: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getFinanceContext(req);
      const query = financeJournalListQuerySchema.parse(req.query);
      const result = await FinanceService.listJournalEntries(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  postJournalEntry: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getFinanceContext(req);
      const params = financeJournalIdParamsSchema.parse(req.params);
      const result = await FinanceService.postJournalEntry(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateJournalEntry: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getFinanceContext(req);
      const params = financeJournalIdParamsSchema.parse(req.params);
      const body = updateJournalEntrySchema.parse(req.body);
      const result = await FinanceService.updateJournalEntry(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
