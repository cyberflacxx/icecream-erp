import { z } from 'zod';

export const financeDashboardQuerySchema = z.object({
  branchId: z.string().optional(),
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional()
});

const uuidSchema = z.string().uuid();

export const financeJournalIdParamsSchema = z.object({
  id: uuidSchema
});

export const financeJournalListQuerySchema = z.object({
  endDate: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  startDate: z.iso.date().optional(),
  status: z.string().trim().optional()
});

export const createJournalEntrySchema = z.object({
  description: z.string().trim().min(1),
  entryDate: z.string().datetime(),
  lines: z
    .array(
      z.object({
        accountId: uuidSchema,
        creditAmount: z.coerce.number().min(0).default(0),
        debitAmount: z.coerce.number().min(0).default(0),
        description: z.string().trim().optional()
      }),
    )
    .min(2)
    .refine(
      (lines) => {
        const debit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
        const credit = lines.reduce((sum, line) => sum + line.creditAmount, 0);

        return Math.abs(debit - credit) < 0.01;
      },
      { message: 'Journal entry is not balanced' },
    ),
  referenceId: z.string().trim().optional(),
  referenceType: z.string().trim().optional()
});

export const updateJournalEntrySchema = createJournalEntrySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field must be provided.',
);

export type FinanceDashboardQuery = z.infer<typeof financeDashboardQuerySchema>;
export type FinanceJournalListQuery = z.infer<typeof financeJournalListQuerySchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
