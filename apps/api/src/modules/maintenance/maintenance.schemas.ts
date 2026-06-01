import { z } from 'zod';

export const maintenancePaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional()
});

export const maintenanceIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const createMachineSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1),
  location: z.string().trim().optional(),
  machineType: z.string().trim().min(1),
  status: z.string().trim().default('ACTIVE'),
  purchaseDate: z.string().datetime().optional(),
  warrantyExpiry: z.string().datetime().optional(),
  isActive: z.boolean().default(true)
});

export const updateMachineSchema = createMachineSchema.partial();

export const listMachinesQuerySchema = maintenancePaginationQuerySchema.extend({
  machineType: z.string().trim().optional(),
  status: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional()
});

export const createScheduleSchema = z.object({
  machineId: z.string().uuid(),
  maintenanceType: z.enum(['PREVENTIVE', 'CORRECTIVE', 'BREAKDOWN', 'INSPECTION']),
  scheduledDate: z.string().datetime(),
  notes: z.string().trim().optional()
});

export const completeScheduleSchema = z.object({
  completedDate: z.string().datetime(),
  performedBy: z.string().uuid().optional(),
  cost: z.coerce.number().min(0).optional(),
  notes: z.string().trim().optional()
});

export const listSchedulesQuerySchema = maintenancePaginationQuerySchema.extend({
  machineId: z.string().uuid().optional(),
  maintenanceType: z.enum(['PREVENTIVE', 'CORRECTIVE', 'BREAKDOWN', 'INSPECTION']).optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED']).optional()
});

export const createBreakdownSchema = z.object({
  machineId: z.string().uuid(),
  breakdownDate: z.string().datetime(),
  description: z.string().trim().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
});

export const resolveBreakdownSchema = z.object({
  resolvedAt: z.string().datetime(),
  downtimeHours: z.coerce.number().min(0).optional(),
  repairCost: z.coerce.number().min(0).optional(),
  notes: z.string().trim().optional()
});

export const listBreakdownsQuerySchema = maintenancePaginationQuerySchema.extend({
  machineId: z.string().uuid().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED']).optional()
});

export type CreateMachineInput = z.infer<typeof createMachineSchema>;
export type UpdateMachineInput = z.infer<typeof updateMachineSchema>;
export type ListMachinesQuery = z.infer<typeof listMachinesQuerySchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type CompleteScheduleInput = z.infer<typeof completeScheduleSchema>;
export type ListSchedulesQuery = z.infer<typeof listSchedulesQuerySchema>;
export type CreateBreakdownInput = z.infer<typeof createBreakdownSchema>;
export type ResolveBreakdownInput = z.infer<typeof resolveBreakdownSchema>;
export type ListBreakdownsQuery = z.infer<typeof listBreakdownsQuerySchema>;
