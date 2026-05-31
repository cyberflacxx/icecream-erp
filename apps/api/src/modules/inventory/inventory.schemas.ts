import { z } from 'zod';

import {
  inventoryBatchStatusValues,
  itemTypeValues,
  stockMovementTypeValues,
  transferStatusValues,
  warehouseTypeValues
} from './inventory.constants';

const uuidSchema = z.string().uuid();
const quantitySchema = z.coerce.number().positive();
const optionalDecimalSchema = z.coerce.number().nonnegative().optional();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10)
});

export const itemStatusSchema = z.enum(['active', 'inactive']);

export const itemsQuerySchema = paginationQuerySchema.extend({
  category: uuidSchema.optional(),
  search: z.string().trim().optional(),
  status: itemStatusSchema.optional(),
  type: z.enum(itemTypeValues).optional()
});

export const createItemSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  itemType: z.enum(itemTypeValues),
  categoryId: uuidSchema,
  unitOfMeasureId: uuidSchema,
  reorderLevel: optionalDecimalSchema,
  reorderQuantity: optionalDecimalSchema,
  unitCost: optionalDecimalSchema,
  sellingPrice: optionalDecimalSchema,
  trackExpiry: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

export const updateItemSchema = createItemSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required to update an item.',
);

export const createWarehouseSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.enum(warehouseTypeValues),
  branchId: uuidSchema.nullish(),
  address: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true)
});

export const stockBalancesQuerySchema = paginationQuerySchema.extend({
  itemId: uuidSchema.optional(),
  itemType: z.enum(itemTypeValues).optional(),
  lowStock: z.coerce.boolean().optional(),
  warehouseId: uuidSchema.optional()
});

export const stockBalanceParamsSchema = z.object({
  itemId: uuidSchema,
  warehouseId: uuidSchema
});

export const stockMovementsQuerySchema = paginationQuerySchema.extend({
  endDate: z.string().date().optional(),
  itemId: uuidSchema.optional(),
  startDate: z.string().date().optional(),
  type: z.enum(stockMovementTypeValues).optional(),
  warehouseId: uuidSchema.optional()
});

export const transferItemSchema = z.object({
  itemId: uuidSchema,
  quantity: quantitySchema
});

export const createTransferSchema = z.object({
  fromWarehouseId: uuidSchema,
  items: z.array(transferItemSchema).min(1),
  notes: z.string().trim().optional().nullable(),
  toWarehouseId: uuidSchema
}).refine((value) => value.fromWarehouseId !== value.toWarehouseId, {
  message: 'Source and destination warehouses must be different.',
  path: ['toWarehouseId']
});

export const transfersQuerySchema = paginationQuerySchema.extend({
  fromWarehouseId: uuidSchema.optional(),
  status: z.enum(transferStatusValues).optional(),
  toWarehouseId: uuidSchema.optional()
});

export const adjustStockSchema = z.object({
  itemId: uuidSchema,
  quantity: quantitySchema,
  reason: z.string().trim().min(1),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
  warehouseId: uuidSchema
});

export const expiringBatchesQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30)
});

export const writeOffExpiredSchema = z.object({
  batchId: uuidSchema,
  reason: z.string().trim().min(1)
});

export const inventoryMetaQuerySchema = z.object({
  includeInactiveItems: z.coerce.boolean().optional()
});

export const receiveStockSchema = z.object({
  batchNumber: z.string().trim().min(1),
  expiryDate: z.string().date().optional(),
  itemId: uuidSchema,
  manufacturedDate: z.string().date().optional(),
  quantity: quantitySchema,
  supplierId: uuidSchema.optional(),
  unitCost: z.coerce.number().nonnegative(),
  warehouseId: uuidSchema
});

export const reserveStockSchema = z.object({
  batchId: uuidSchema.optional(),
  itemId: uuidSchema,
  quantity: quantitySchema,
  referenceId: z.string().trim().min(1),
  referenceType: z.string().trim().min(1),
  warehouseId: uuidSchema
});

export const issueStockSchema = z.object({
  allowExpired: z.boolean().default(false),
  itemId: uuidSchema,
  overrideReason: z.string().trim().optional(),
  quantity: quantitySchema,
  referenceId: z.string().trim().min(1),
  referenceType: z.string().trim().min(1),
  warehouseId: uuidSchema
});

export const addFinishedGoodsSchema = z.object({
  batchNumber: z.string().trim().min(1),
  itemId: uuidSchema,
  productionBatchId: uuidSchema,
  quantity: quantitySchema,
  unitCost: z.coerce.number().nonnegative().default(0),
  warehouseId: uuidSchema
});

export const inventoryBatchStatusSchema = z.enum(inventoryBatchStatusValues);

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type ItemsQuery = z.infer<typeof itemsQuerySchema>;
export type StockBalancesQuery = z.infer<typeof stockBalancesQuerySchema>;
export type StockMovementsQuery = z.infer<typeof stockMovementsQuerySchema>;
export type TransfersQuery = z.infer<typeof transfersQuerySchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
