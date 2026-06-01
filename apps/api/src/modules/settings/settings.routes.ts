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
  '/users',
  requirePermission('user.manage'),
  settingsController.createUser,
);
settingsRouter.post(
  '/users/invite',
  requirePermission('user.manage'),
  settingsController.inviteUser,
);
settingsRouter.get(
  '/users/:id',
  requirePermission('user.manage'),
  settingsController.getUser,
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
settingsRouter.patch(
  '/users/:id/activate',
  requirePermission('user.manage'),
  settingsController.activateUser,
);
settingsRouter.patch(
  '/users/:id/deactivate',
  requirePermission('user.manage'),
  settingsController.deactivateUser,
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
settingsRouter.get(
  '/roles/:id',
  requirePermission('settings.manage'),
  settingsController.getRole,
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
settingsRouter.get(
  '/number-series',
  requirePermission('settings.manage'),
  settingsController.getNumberSeries,
);
settingsRouter.patch(
  '/number-series',
  requirePermission('settings.manage'),
  settingsController.updateNumberSeries,
);
