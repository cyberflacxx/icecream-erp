import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const productionBatchStatusValues = [
  'DRAFT',
  'PLANNED',
  'MATERIALS_REQUESTED',
  'MATERIALS_APPROVED',
  'MATERIALS_RESERVED',
  'IN_PROGRESS',
  'WIP',
  'QUALITY_CHECK',
  'COMPLETED',
  'CANCELLED'
] as const;

export const qualityStatusValues = [
  'PENDING',
  'PASSED',
  'FAILED',
  'CONDITIONAL_RELEASE',
  'QUARANTINE'
] as const;

export const productionDashboardQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional()
});

export const productionBatchesQuerySchema = z.object({
  branchId: uuidSchema.optional(),
  endDate: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  recipeId: uuidSchema.optional(),
  search: z.string().trim().optional(),
  startDate: z.iso.date().optional(),
  status: z.enum(productionBatchStatusValues).optional(),
  warehouseId: uuidSchema.optional()
});

export const productionBatchIdParamsSchema = z.object({
  id: uuidSchema
});

export const createProductionBatchSchema = z.object({
  expectedOutput: z.coerce.number().positive(),
  plannedQuantity: z.coerce.number().positive(),
  productionDate: z.iso.date(),
  productionLine: z.string().trim().min(1),
  recipeId: uuidSchema,
  shift: z.enum(['DAY', 'NIGHT']),
  warehouseId: uuidSchema
});

export const closeProductionBatchSchema = z.object({
  actualMaterials: z
    .array(
      z.object({
        itemId: uuidSchema,
        quantityActual: z.coerce.number().nonnegative()
      }),
    )
    .default([]),
  wastageReason: z.string().trim().optional()
});

export const cancelProductionBatchSchema = z.object({
  reason: z.string().trim().min(1)
});

export const submitBatchQualitySchema = z.object({
  qualityNotes: z.string().trim().optional()
});

export const recordQualityResultSchema = z.object({
  correctedAction: z.string().trim().optional(),
  failedQuantity: z.coerce.number().min(0).optional(),
  notes: z.string().trim().optional(),
  passedQuantity: z.coerce.number().min(0).optional(),
  rejectionReason: z.string().trim().optional(),
  status: z.enum(['PASSED', 'FAILED', 'CONDITIONAL_RELEASE'])
});

export type CancelProductionBatchInput = z.infer<typeof cancelProductionBatchSchema>;
export type CloseProductionBatchInput = z.infer<typeof closeProductionBatchSchema>;
export type CreateProductionBatchInput = z.infer<typeof createProductionBatchSchema>;
export type ProductionBatchesQuery = z.infer<typeof productionBatchesQuerySchema>;
export type ProductionDashboardQuery = z.infer<typeof productionDashboardQuerySchema>;
export type RecordQualityResultInput = z.infer<typeof recordQualityResultSchema>;
export type SubmitBatchQualityInput = z.infer<typeof submitBatchQualitySchema>;
