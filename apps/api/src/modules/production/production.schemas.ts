import { z } from 'zod';

export const productionDashboardQuerySchema = z.object({
  branchId: z.string().optional(),
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional()
});

export type ProductionDashboardQuery = z.infer<typeof productionDashboardQuerySchema>;

