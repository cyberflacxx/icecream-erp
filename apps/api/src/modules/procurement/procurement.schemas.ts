import { z } from 'zod';

import {
  grnStatusValues,
  purchaseOrderStatusValues,
  purchaseRequisitionStatusValues
} from './procurement.constants';

const uuidSchema = z.string().uuid();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10)
});

export const requisitionsListQuerySchema = paginationQuerySchema.extend({
  department: z.string().trim().optional(),
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional(),
  status: z.enum(purchaseRequisitionStatusValues).optional()
});

export const requisitionItemSchema = z.object({
  estimatedUnitCost: z.coerce.number().nonnegative().optional().nullable(),
  itemId: uuidSchema,
  quantityRequested: z.coerce.number().positive(),
  remarks: z.string().trim().optional().nullable(),
  unitOfMeasureId: uuidSchema
});

export const createRequisitionSchema = z.object({
  department: z.string().trim().min(1),
  items: z.array(requisitionItemSchema).min(1),
  neededByDate: z.iso.date().optional().nullable(),
  remarks: z.string().trim().optional().nullable()
});

export const updateRequisitionSchema = z
  .object({
    department: z.string().trim().min(1).optional(),
    items: z.array(requisitionItemSchema).min(1).optional(),
    neededByDate: z.iso.date().optional().nullable(),
    remarks: z.string().trim().optional().nullable()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.');

export const requisitionIdParamsSchema = z.object({
  id: uuidSchema
});

export const requisitionDecisionSchema = z.object({
  remarks: z.string().trim().optional().nullable()
});

export const purchaseOrdersListQuerySchema = paginationQuerySchema.extend({
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional(),
  status: z.enum(purchaseOrderStatusValues).optional(),
  supplierId: uuidSchema.optional()
});

export const purchaseOrderItemSchema = z.object({
  itemId: uuidSchema,
  quantityOrdered: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative(),
  unitOfMeasureId: uuidSchema
});

export const createPurchaseOrderSchema = z.object({
  discountAmount: z.coerce.number().nonnegative().default(0),
  expectedDeliveryDate: z.iso.date().optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1),
  notes: z.string().trim().optional().nullable(),
  orderDate: z.iso.date().optional(),
  requisitionId: uuidSchema.optional().nullable(),
  supplierId: uuidSchema,
  taxAmount: z.coerce.number().nonnegative().default(0)
});

export const updatePurchaseOrderSchema = z
  .object({
    discountAmount: z.coerce.number().nonnegative().optional(),
    expectedDeliveryDate: z.iso.date().optional().nullable(),
    items: z.array(purchaseOrderItemSchema).min(1).optional(),
    notes: z.string().trim().optional().nullable(),
    orderDate: z.iso.date().optional(),
    supplierId: uuidSchema.optional(),
    taxAmount: z.coerce.number().nonnegative().optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.');

export const purchaseOrderIdParamsSchema = z.object({
  id: uuidSchema
});

export const grnsListQuerySchema = paginationQuerySchema.extend({
  endDate: z.iso.date().optional(),
  purchaseOrderId: uuidSchema.optional(),
  startDate: z.iso.date().optional(),
  status: z.enum(grnStatusValues).optional()
});

export const createGRNItemSchema = z.object({
  batchNumber: z.string().trim().optional().nullable(),
  expiryDate: z.iso.date().optional().nullable(),
  itemId: uuidSchema,
  poItemId: uuidSchema,
  qualityNotes: z.string().trim().optional().nullable(),
  quantityExpected: z.coerce.number().nonnegative(),
  quantityReceived: z.coerce.number().nonnegative().default(0),
  quantityRejected: z.coerce.number().nonnegative().default(0),
  unitCost: z.coerce.number().nonnegative()
});

export const createGRNSchema = z.object({
  items: z.array(createGRNItemSchema).default([]),
  notes: z.string().trim().optional().nullable(),
  purchaseOrderId: uuidSchema,
  qualityNotes: z.string().trim().optional().nullable(),
  receivedDate: z.iso.date().optional(),
  warehouseId: uuidSchema
});

export const receiveGRNItemSchema = z.object({
  batchNumber: z.string().trim().optional().nullable(),
  expiryDate: z.iso.date().optional().nullable(),
  itemId: uuidSchema,
  overReceiveReason: z.string().trim().optional().nullable(),
  poItemId: uuidSchema,
  qualityNotes: z.string().trim().optional().nullable(),
  quantityReceived: z.coerce.number().nonnegative(),
  quantityRejected: z.coerce.number().nonnegative().default(0)
});

export const receiveGRNSchema = z.object({
  items: z.array(receiveGRNItemSchema).min(1),
  notes: z.string().trim().optional().nullable()
});

export const grnIdParamsSchema = z.object({
  id: uuidSchema
});

export const createSupplierReturnSchema = z.object({
  grnId: uuidSchema.optional().nullable(),
  reason: z.string().trim().min(1),
  returnDate: z.iso.date().optional(),
  supplierId: uuidSchema,
  totalValue: z.coerce.number().positive()
});

export type CreateGRNInput = z.infer<typeof createGRNSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>;
export type CreateSupplierReturnInput = z.infer<typeof createSupplierReturnSchema>;
export type ReceiveGRNInput = z.infer<typeof receiveGRNSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export type UpdateRequisitionInput = z.infer<typeof updateRequisitionSchema>;
