import { z } from 'zod';

import {
  supplierBalanceUpdateTypeValues,
  supplierStatusValues
} from './suppliers.constants';

const uuidSchema = z.string().uuid();

export const suppliersPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10)
});

export const listSuppliersQuerySchema = suppliersPaginationSchema.extend({
  categoryId: uuidSchema.optional(),
  search: z.string().trim().optional(),
  status: z.enum(supplierStatusValues).optional()
});

export const createSupplierSchema = z.object({
  address: z.string().trim().optional().nullable(),
  categoryId: uuidSchema,
  code: z.string().trim().optional(),
  contactPerson: z.string().trim().optional().nullable(),
  creditLimit: z.coerce.number().nonnegative().optional().nullable(),
  email: z.email().optional().nullable(),
  name: z.string().trim().min(1),
  paymentTerms: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  status: z.enum(supplierStatusValues).default('ACTIVE'),
  taxNumber: z.string().trim().optional().nullable()
});

export const updateSupplierSchema = createSupplierSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.');

export const supplierIdParamsSchema = z.object({
  id: uuidSchema
});

export const supplierPurchaseHistoryQuerySchema = suppliersPaginationSchema.extend({
  tab: z
    .enum(['purchase_orders', 'grns', 'returns', 'payments'])
    .default('purchase_orders')
});

export const updateSupplierBalanceSchema = z.object({
  amount: z.coerce.number().positive(),
  type: z.enum(supplierBalanceUpdateTypeValues)
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
export type SupplierPurchaseHistoryQuery = z.infer<typeof supplierPurchaseHistoryQuerySchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
