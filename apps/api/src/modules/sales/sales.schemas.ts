import { z } from 'zod';

import {
  customerStatusValues,
  invoiceStatusValues,
  paymentMethodValues,
  quotationStatusValues,
  salesOrderStatusValues
} from './sales.constants';

const uuidSchema = z.string().uuid();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10)
});

export const customersListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(customerStatusValues).optional()
});

export const customerIdParamsSchema = z.object({
  id: uuidSchema
});

export const createCustomerSchema = z.object({
  address: z.string().trim().optional().nullable(),
  code: z.string().trim().optional(),
  creditLimit: z.coerce.number().nonnegative().optional().nullable(),
  customerType: z.string().trim().min(1),
  email: z.string().trim().email().optional().nullable(),
  name: z.string().trim().min(1),
  paymentTerms: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  status: z.enum(customerStatusValues).default('ACTIVE')
});

export const updateCustomerSchema = z
  .object({
    address: z.string().trim().optional().nullable(),
    creditLimit: z.coerce.number().nonnegative().optional().nullable(),
    customerType: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional().nullable(),
    name: z.string().trim().min(1).optional(),
    paymentTerms: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    status: z.enum(customerStatusValues).optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.');

const lineItemSchema = z.object({
  discountPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  itemId: uuidSchema,
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative()
});

export const quotationsListQuerySchema = paginationQuerySchema.extend({
  customerId: uuidSchema.optional(),
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional(),
  status: z.enum(quotationStatusValues).optional()
});

export const createQuotationSchema = z.object({
  customerId: uuidSchema,
  discountAmount: z.coerce.number().nonnegative().default(0),
  items: z.array(lineItemSchema).min(1),
  notes: z.string().trim().optional().nullable(),
  quotationDate: z.iso.date().optional(),
  taxAmount: z.coerce.number().nonnegative().default(0),
  validUntil: z.iso.date().optional().nullable()
});

export const updateQuotationSchema = z
  .object({
    discountAmount: z.coerce.number().nonnegative().optional(),
    items: z.array(lineItemSchema).min(1).optional(),
    notes: z.string().trim().optional().nullable(),
    quotationDate: z.iso.date().optional(),
    status: z.enum(quotationStatusValues).optional(),
    taxAmount: z.coerce.number().nonnegative().optional(),
    validUntil: z.iso.date().optional().nullable()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.');

export const quotationIdParamsSchema = z.object({
  id: uuidSchema
});

export const ordersListQuerySchema = paginationQuerySchema.extend({
  branchId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional(),
  status: z.enum(salesOrderStatusValues).optional()
});

export const createSalesOrderSchema = z.object({
  branchId: uuidSchema.optional().nullable(),
  customerId: uuidSchema,
  discountAmount: z.coerce.number().nonnegative().default(0),
  items: z.array(lineItemSchema).min(1),
  notes: z.string().trim().optional().nullable(),
  orderDate: z.iso.date().optional(),
  quotationId: uuidSchema.optional().nullable(),
  requiredDate: z.iso.date().optional().nullable(),
  taxAmount: z.coerce.number().nonnegative().default(0),
  warehouseId: uuidSchema
});

export const orderIdParamsSchema = z.object({
  id: uuidSchema
});

export const createDeliveryNoteSchema = z.object({
  deliveryDate: z.iso.date().optional(),
  notes: z.string().trim().optional().nullable(),
  salesOrderId: uuidSchema
});

export const deliveryNoteIdParamsSchema = z.object({
  id: uuidSchema
});

export const invoicesListQuerySchema = paginationQuerySchema.extend({
  customerId: uuidSchema.optional(),
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional(),
  status: z.enum(invoiceStatusValues).optional()
});

export const createInvoiceSchema = z.object({
  customerId: uuidSchema,
  discountAmount: z.coerce.number().nonnegative().default(0),
  dueDate: z.iso.date().optional().nullable(),
  invoiceDate: z.iso.date().optional(),
  items: z.array(lineItemSchema).optional(),
  notes: z.string().trim().optional().nullable(),
  salesOrderId: uuidSchema.optional().nullable(),
  taxAmount: z.coerce.number().nonnegative().default(0)
});

export const updateInvoiceSchema = z
  .object({
    discountAmount: z.coerce.number().nonnegative().optional(),
    dueDate: z.iso.date().optional().nullable(),
    items: z.array(lineItemSchema).min(1).optional(),
    notes: z.string().trim().optional().nullable(),
    status: z.enum(invoiceStatusValues).optional(),
    taxAmount: z.coerce.number().nonnegative().optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.');

export const invoiceIdParamsSchema = z.object({
  id: uuidSchema
});

export const invoicePaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(paymentMethodValues),
  reference: z.string().trim().optional().nullable()
});

export const createCustomerReturnSchema = z.object({
  customerId: uuidSchema,
  invoiceId: uuidSchema.optional().nullable(),
  reason: z.string().trim().min(1),
  returnDate: z.iso.date().optional(),
  totalValue: z.coerce.number().positive()
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomersListQuery = z.infer<typeof customersListQuerySchema>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type QuotationsListQuery = z.infer<typeof quotationsListQuerySchema>;
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type OrdersListQuery = z.infer<typeof ordersListQuerySchema>;
export type CreateDeliveryNoteInput = z.infer<typeof createDeliveryNoteSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoicesListQuery = z.infer<typeof invoicesListQuerySchema>;
export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>;
export type CreateCustomerReturnInput = z.infer<typeof createCustomerReturnSchema>;
