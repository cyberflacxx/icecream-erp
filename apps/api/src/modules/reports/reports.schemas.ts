import { z } from 'zod';

import { reportTypeValues } from './reports.constants';

const uuidSchema = z.string().uuid();

export const reportQuerySchema = z.object({
  branchId: uuidSchema.optional(),
  date: z.iso.date().optional(),
  daysAhead: z.coerce.number().int().min(1).max(120).optional(),
  employeeId: uuidSchema.optional(),
  endDate: z.iso.date().optional(),
  itemId: uuidSchema.optional(),
  productId: uuidSchema.optional(),
  productionLine: z.string().trim().optional(),
  reportType: z.enum(reportTypeValues),
  shift: z.enum(['DAY', 'NIGHT']).optional(),
  startDate: z.iso.date().optional(),
  supplierId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional()
});

export const reportTypeParamsSchema = z.object({
  type: z.enum(reportTypeValues)
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
