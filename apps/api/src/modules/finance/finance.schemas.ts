import { z } from 'zod';

export const financeDashboardQuerySchema = z.object({
  branchId: z.string().optional(),
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional()
});

export type FinanceDashboardQuery = z.infer<typeof financeDashboardQuerySchema>;

