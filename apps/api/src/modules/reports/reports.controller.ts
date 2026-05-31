import type { NextFunction, Request, Response } from 'express';

import { enqueuePdfGenerationJob } from '../../jobs/pdf-generation.job';
import { ReportsService } from './reports.service';
import { reportQuerySchema } from './reports.schemas';

function getReportsContext(req: Request) {
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

export const reportsController = {
  exportCsv: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getReportsContext(req);
      const query = reportQuerySchema.parse(req.query);
      const result = await ReportsService.exportCsv(context, query);

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);

      return res.status(200).send(result.content);
    } catch (error) {
      return next(error);
    }
  },

  exportPdf: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getReportsContext(req);
      const query = reportQuerySchema.parse(req.query);
      const result = await enqueuePdfGenerationJob({
        context,
        reportQuery: query
      });

      return res.status(202).json({
        message: 'PDF generation queued',
        ...result
      });
    } catch (error) {
      return next(error);
    }
  },

  getDashboardData: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getReportsContext(req);
      const result = await ReportsService.getDashboardData(context);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getReport: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getReportsContext(req);
      const query = reportQuerySchema.parse(req.query);
      const result = await ReportsService.generateReport(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
