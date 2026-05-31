import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10)
});

export const usersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional()
});

export const rolesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional()
});

export const userIdParamsSchema = z.object({
  id: uuidSchema
});

export const roleIdParamsSchema = z.object({
  id: uuidSchema
});

export const inviteUserSchema = z.object({
  branchId: uuidSchema.optional().nullable(),
  email: z.string().trim().email(),
  roleIds: z.array(uuidSchema).default([]),
  sendEmail: z.boolean().default(true)
});

export const assignUserRolesSchema = z.object({
  roleIds: z.array(uuidSchema)
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
});

export const createRoleSchema = z.object({
  description: z.string().trim().optional().nullable(),
  name: z.string().trim().min(2)
});

export const updateRoleSchema = z.object({
  description: z.string().trim().optional().nullable(),
  name: z.string().trim().min(2).optional()
});

export const assignRolePermissionsSchema = z.object({
  permissionIds: z.array(uuidSchema)
});

export const auditLogsQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().optional(),
  endDate: z.iso.date().optional(),
  entityType: z.string().trim().optional(),
  startDate: z.iso.date().optional(),
  userProfileId: uuidSchema.optional()
});

export const updateCompanyProfileSchema = z.object({
  address: z.string().trim().optional().nullable(),
  currency: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional().nullable(),
  logoUrl: z.string().trim().url().optional().nullable(),
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().optional().nullable(),
  taxNumber: z.string().trim().optional().nullable()
});

export const updateNumberSeriesSchema = z.object({
  grnPrefix: z.string().trim().min(1),
  invoicePrefix: z.string().trim().min(1),
  paymentPrefix: z.string().trim().min(1),
  poPrefix: z.string().trim().min(1),
  requisitionPrefix: z.string().trim().min(1),
  salesOrderPrefix: z.string().trim().min(1)
});

export const updateNotificationSettingsSchema = z.object({
  expiryAlert: z.boolean(),
  lowStock: z.boolean(),
  paymentReceived: z.boolean(),
  productionBatchReady: z.boolean(),
  purchaseOrderApproved: z.boolean(),
  shiftCloseSubmitted: z.boolean()
});

export const updateSettingsOverviewSchema = z.object({
  companyProfile: updateCompanyProfileSchema.optional(),
  notificationSettings: updateNotificationSettingsSchema.optional(),
  numberSeries: updateNumberSeriesSchema.optional()
});

export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type RolesQuery = z.infer<typeof rolesQuerySchema>;
export type UpdateSettingsOverviewInput = z.infer<typeof updateSettingsOverviewSchema>;
export type UsersQuery = z.infer<typeof usersQuerySchema>;
