import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { settingsController } from './settings.controller';

export const settingsRouter = Router();

settingsRouter.use(authenticateRequest);

settingsRouter.get(
  '/overview',
  requirePermission('settings.manage'),
  settingsController.getSettingsOverview,
);
settingsRouter.patch(
  '/overview',
  requirePermission('settings.manage'),
  settingsController.updateSettingsOverview,
);
settingsRouter.get(
  '/summary',
  requirePermission('settings.manage'),
  settingsController.getSummaryCounters,
);

settingsRouter.get(
  '/users',
  requirePermission('user.manage'),
  settingsController.listUsers,
);
settingsRouter.post(
  '/users/invite',
  requirePermission('user.manage'),
  settingsController.inviteUser,
);
settingsRouter.patch(
  '/users/:id/roles',
  requirePermission('user.manage'),
  settingsController.assignUserRoles,
);
settingsRouter.patch(
  '/users/:id/status',
  requirePermission('user.manage'),
  settingsController.updateUserStatus,
);

settingsRouter.get(
  '/roles',
  requirePermission('settings.manage'),
  settingsController.listRoles,
);
settingsRouter.post(
  '/roles',
  requirePermission('settings.manage'),
  settingsController.createRole,
);
settingsRouter.patch(
  '/roles/:id',
  requirePermission('settings.manage'),
  settingsController.updateRole,
);
settingsRouter.patch(
  '/roles/:id/permissions',
  requirePermission('settings.manage'),
  settingsController.assignRolePermissions,
);

settingsRouter.get(
  '/permissions',
  requirePermission('settings.manage'),
  settingsController.listPermissions,
);

settingsRouter.get(
  '/audit-logs',
  requirePermission('audit_log.read'),
  settingsController.listAuditLogs,
);
settingsRouter.get(
  '/audit-logs/export/csv',
  requirePermission('audit_log.read'),
  settingsController.exportAuditLogsCsv,
);
