import type { NextFunction, Request, Response } from 'express';

import { HrService } from './hr.service';
import {
  createAttendanceSchema,
  createEmployeeSchema,
  createLeaveSchema,
  createPayrollSchema,
  employeeIdParamsSchema,
  listAttendanceQuerySchema,
  listEmployeesQuerySchema,
  listLeaveQuerySchema,
  listPayrollQuerySchema,
  updateEmployeeSchema
} from './hr.schemas';

function getHrContext(req: Request) {
  if (!req.authContext) {
    throw new Error('Unauthorized');
  }

  return {
    organizationId: req.authContext.organizationId,
    userProfileId: req.authContext.profile.id
  };
}

export const hrController = {
  listEmployees: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const query = listEmployeesQuerySchema.parse(req.query);
      const result = await HrService.listEmployees(context, query);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createEmployee: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const body = createEmployeeSchema.parse(req.body);
      const result = await HrService.createEmployee(context, body);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getEmployee: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const params = employeeIdParamsSchema.parse(req.params);
      const result = await HrService.getEmployee(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateEmployee: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const params = employeeIdParamsSchema.parse(req.params);
      const body = updateEmployeeSchema.parse(req.body);
      const result = await HrService.updateEmployee(context, params.id, body);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  deleteEmployee: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const params = employeeIdParamsSchema.parse(req.params);
      const result = await HrService.deleteEmployee(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listAttendance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const query = listAttendanceQuerySchema.parse(req.query);
      const result = await HrService.listAttendance(context, query);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createAttendance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const body = createAttendanceSchema.parse(req.body);
      const result = await HrService.createAttendance(context, body);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getAttendance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const params = employeeIdParamsSchema.parse(req.params);
      const result = await HrService.getAttendance(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listLeave: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const query = listLeaveQuerySchema.parse(req.query);
      const result = await HrService.listLeaveRequests(context, query);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createLeave: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const body = createLeaveSchema.parse(req.body);
      const result = await HrService.createLeaveRequest(context, body);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getLeave: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const params = employeeIdParamsSchema.parse(req.params);
      const result = await HrService.getLeaveRequest(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  approveLeave: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const params = employeeIdParamsSchema.parse(req.params);
      const result = await HrService.approveLeave(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  rejectLeave: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const params = employeeIdParamsSchema.parse(req.params);
      const result = await HrService.rejectLeave(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listPayroll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const query = listPayrollQuerySchema.parse(req.query);
      const result = await HrService.listPayroll(context, query);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createPayroll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const body = createPayrollSchema.parse(req.body);
      const result = await HrService.createPayroll(context, body);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getPayroll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const params = employeeIdParamsSchema.parse(req.params);
      const result = await HrService.getPayroll(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  approvePayroll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const params = employeeIdParamsSchema.parse(req.params);
      const result = await HrService.approvePayroll(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  payPayroll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getHrContext(req);
      const params = employeeIdParamsSchema.parse(req.params);
      const result = await HrService.payPayroll(context, params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
