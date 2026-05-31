import { z } from 'zod';

import {
  branchShiftStatusValues,
  branchStatusValues,
  paymentMethodValues,
  shiftTypeValues
} from './branch-operations.constants';

const uuidSchema = z.string().uuid();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10)
});

export const dateRangeQuerySchema = paginationQuerySchema.extend({
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional()
});

export const branchIdParamsSchema = z.object({
  branchId: uuidSchema
});

export const branchEntityIdParamsSchema = z.object({
  branchId: uuidSchema,
  id: uuidSchema
});

export const branchDetailIdParamsSchema = z.object({
  id: uuidSchema
});

export const branchListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(branchStatusValues).optional()
});

export const createBranchSchema = z.object({
  address: z.string().trim().optional().nullable(),
  code: z.string().trim().min(1),
  managerId: uuidSchema.optional().nullable(),
  name: z.string().trim().min(1),
  phone: z.string().trim().optional().nullable(),
  status: z.enum(branchStatusValues).default('ACTIVE')
});

export const updateBranchSchema = z
  .object({
    address: z.string().trim().optional().nullable(),
    managerId: uuidSchema.optional().nullable(),
    name: z.string().trim().min(1).optional(),
    phone: z.string().trim().optional().nullable(),
    status: z.enum(branchStatusValues).optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.');

export const branchDashboardQuerySchema = z.object({
  date: z.iso.date().optional()
});

export const branchStockQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional()
});

export const branchSalesQuerySchema = dateRangeQuerySchema.extend({
  paymentMethod: z.enum(paymentMethodValues).optional(),
  shift: z.enum(shiftTypeValues).optional()
});

export const branchExpensesQuerySchema = dateRangeQuerySchema.extend({
  paymentMethod: z.enum(paymentMethodValues).optional()
});

export const shiftCloseListQuerySchema = dateRangeQuerySchema.extend({
  status: z.enum(branchShiftStatusValues).optional()
});

export const branchSaleItemSchema = z.object({
  itemId: uuidSchema,
  quantity: z.coerce.number().positive(),
  totalPrice: z.coerce.number().nonnegative(),
  unitPrice: z.coerce.number().nonnegative()
});

export const createBranchSaleSchema = z.object({
  customerId: uuidSchema.optional().nullable(),
  items: z.array(branchSaleItemSchema).min(1),
  paymentMethod: z.enum(paymentMethodValues),
  paymentReference: z.string().trim().optional().nullable(),
  saleDate: z.iso.date().optional(),
  shift: z.enum(shiftTypeValues)
});

export const createBranchExpenseSchema = z.object({
  amount: z.coerce.number().positive(),
  category: z.string().trim().min(1),
  description: z.string().trim().min(1),
  expenseDate: z.iso.date().optional(),
  paymentMethod: z.enum(paymentMethodValues),
  receiptUrl: z.string().trim().url().optional().nullable()
});

export const initShiftCloseSchema = z.object({
  date: z.iso.date(),
  shift: z.enum(shiftTypeValues)
});

export const submitShiftCloseSchema = z.object({
  actualCash: z.coerce.number(),
  actualClosingStock: z.coerce.number().nonnegative(),
  damagedStockValue: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().optional().nullable()
});

export type BranchDashboardQuery = z.infer<typeof branchDashboardQuerySchema>;
export type BranchExpensesQuery = z.infer<typeof branchExpensesQuerySchema>;
export type BranchListQuery = z.infer<typeof branchListQuerySchema>;
export type BranchSalesQuery = z.infer<typeof branchSalesQuerySchema>;
export type BranchStockQuery = z.infer<typeof branchStockQuerySchema>;
export type CreateBranchExpenseInput = z.infer<typeof createBranchExpenseSchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type CreateBranchSaleInput = z.infer<typeof createBranchSaleSchema>;
export type InitShiftCloseInput = z.infer<typeof initShiftCloseSchema>;
export type ShiftCloseListQuery = z.infer<typeof shiftCloseListQuerySchema>;
export type SubmitShiftCloseInput = z.infer<typeof submitShiftCloseSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
