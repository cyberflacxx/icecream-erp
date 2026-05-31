import type { NextFunction, Request, Response } from 'express';

import {
  assignRolePermissionsSchema,
  assignUserRolesSchema,
  auditLogsQuerySchema,
  createRoleSchema,
  inviteUserSchema,
  roleIdParamsSchema,
  rolesQuerySchema,
  updateRoleSchema,
  updateSettingsOverviewSchema,
  updateUserStatusSchema,
  userIdParamsSchema,
  usersQuerySchema
} from './settings.schemas';
import { SettingsService } from './settings.service';

function getSettingsContext(req: Request) {
  if (!req.authContext) {
    throw new Error('Unauthorized');
  }

  return {
    organizationId: req.authContext.organizationId,
    userProfileId: req.authContext.profile.id
  };
}

export const settingsController = {
  assignRolePermissions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const params = roleIdParamsSchema.parse(req.params);
      const body = assignRolePermissionsSchema.parse(req.body);
      const result = await SettingsService.assignRolePermissions(context, params.id, body.permissionIds);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  assignUserRoles: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const params = userIdParamsSchema.parse(req.params);
      const body = assignUserRolesSchema.parse(req.body);
      const result = await SettingsService.assignUserRoles(context, params.id, body.roleIds);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createRole: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const body = createRoleSchema.parse(req.body);
      const result = await SettingsService.createRole(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  exportAuditLogsCsv: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const query = auditLogsQuerySchema.parse(req.query);
      const result = await SettingsService.exportAuditLogsCsv(context, query);

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);

      return res.status(200).send(result.content);
    } catch (error) {
      return next(error);
    }
  },

  getSettingsOverview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const result = await SettingsService.getSettingsOverview(context);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getSummaryCounters: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const result = await SettingsService.getSummaryCounters(context);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  inviteUser: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const body = inviteUserSchema.parse(req.body);
      const result = await SettingsService.inviteUser(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listAuditLogs: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const query = auditLogsQuerySchema.parse(req.query);
      const result = await SettingsService.listAuditLogs(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listPermissions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const result = await SettingsService.listPermissions(context);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listRoles: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const query = rolesQuerySchema.parse(req.query);
      const result = await SettingsService.listRoles(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listUsers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const query = usersQuerySchema.parse(req.query);
      const result = await SettingsService.listUsers(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateRole: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const params = roleIdParamsSchema.parse(req.params);
      const body = updateRoleSchema.parse(req.body);
      const result = await SettingsService.updateRole(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateSettingsOverview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const body = updateSettingsOverviewSchema.parse(req.body);
      const result = await SettingsService.updateSettingsOverview(context, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateUserStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSettingsContext(req);
      const params = userIdParamsSchema.parse(req.params);
      const body = updateUserStatusSchema.parse(req.body);
      const result = await SettingsService.updateUserStatus(context, params.id, body.status);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};
