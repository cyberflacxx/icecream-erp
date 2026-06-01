import type { NextFunction, Request, Response } from 'express';

import { MaintenanceService } from './maintenance.service';
import {
  completeScheduleSchema,
  createBreakdownSchema,
  createMachineSchema,
  createScheduleSchema,
  listBreakdownsQuerySchema,
  listMachinesQuerySchema,
  listSchedulesQuerySchema,
  maintenanceIdParamsSchema,
  resolveBreakdownSchema,
  updateMachineSchema
} from './maintenance.schemas';

function getMaintenanceContext(req: Request) {
  if (!req.authContext) {
    throw new Error('Unauthorized');
  }

  return {
    organizationId: req.authContext.organizationId,
    userProfileId: req.authContext.profile.id
  };
}

export const maintenanceController = {
  listMachines: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const query = listMachinesQuerySchema.parse(req.query);
      const result = await MaintenanceService.listMachines(context, query);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createMachine: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const body = createMachineSchema.parse(req.body);
      const result = await MaintenanceService.createMachine(context, body);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getMachine: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const params = maintenanceIdParamsSchema.parse(req.params);
      const result = await MaintenanceService.getMachine(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateMachine: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const params = maintenanceIdParamsSchema.parse(req.params);
      const body = updateMachineSchema.parse(req.body);
      const result = await MaintenanceService.updateMachine(context, params.id, body);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listSchedules: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const query = listSchedulesQuerySchema.parse(req.query);
      const result = await MaintenanceService.listSchedules(context, query);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createSchedule: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const body = createScheduleSchema.parse(req.body);
      const result = await MaintenanceService.createSchedule(context, body);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getSchedule: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const params = maintenanceIdParamsSchema.parse(req.params);
      const result = await MaintenanceService.getSchedule(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateSchedule: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const params = maintenanceIdParamsSchema.parse(req.params);
      const body = createScheduleSchema.partial().parse(req.body);
      const result = await MaintenanceService.updateSchedule(context, params.id, body);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  completeSchedule: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const params = maintenanceIdParamsSchema.parse(req.params);
      const body = completeScheduleSchema.parse(req.body);
      const result = await MaintenanceService.completeSchedule(context, params.id, body);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listBreakdowns: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const query = listBreakdownsQuerySchema.parse(req.query);
      const result = await MaintenanceService.listBreakdowns(context, query);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createBreakdown: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const body = createBreakdownSchema.parse(req.body);
      const result = await MaintenanceService.createBreakdown(context, body);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getBreakdown: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const params = maintenanceIdParamsSchema.parse(req.params);
      const result = await MaintenanceService.getBreakdown(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateBreakdown: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const params = maintenanceIdParamsSchema.parse(req.params);
      const body = createBreakdownSchema.partial().parse(req.body);
      const result = await MaintenanceService.updateBreakdown(context, params.id, body);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  resolveBreakdown: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getMaintenanceContext(req);
      const params = maintenanceIdParamsSchema.parse(req.params);
      const body = resolveBreakdownSchema.parse(req.body);
      const result = await MaintenanceService.resolveBreakdown(context, params.id, body);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
