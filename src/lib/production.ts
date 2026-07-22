import { asArray, asObject, ensureNonNegative, ensurePositiveQuantity, normalizeDate, normalizeWarehouseCode, toCsv, toNumber } from './inventory';

export const PRODUCTION_PLAN_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export const PRODUCTION_BATCH_STATUSES = [
  'DRAFT',
  'PLANNED',
  'MATERIALS_REQUESTED',
  'MATERIALS_APPROVED',
  'MATERIALS_RESERVED',
  'IN_PROGRESS',
  'WIP',
  'QUALITY_CHECK',
  'COMPLETED',
  'CANCELLED',
] as const;

export const PRODUCTION_QUALITY_STATUSES = [
  'PENDING',
  'PASSED',
  'PARTIALLY_PASSED',
  'FAILED',
  'REWORK_REQUIRED',
] as const;

export const PRODUCTION_SHIFTS = ['DAY', 'NIGHT'] as const;

export type ProductionShift = (typeof PRODUCTION_SHIFTS)[number];

export type MaterialRequirementInput = {
  item_id: string;
  items?: unknown;
  quantity_required: number | string | null;
  unit_id?: string | null;
  units_of_measure?: unknown;
  wastage_allowance_percent?: number | string | null;
};

export type MaterialRequirementRow = {
  availableQuantity: number;
  estimatedMaterialCost?: number;
  itemCode: string | null;
  itemId: string;
  itemName: string;
  requiredQuantity: number;
  scalingFactor?: number;
  shortageQuantity: number;
  standardUnitCost?: number;
  unit: string | null;
  unitId: string | null;
  wastageAllowancePercent: number;
};

export type PlanShortageSummary = {
  availableQuantity: number;
  itemCode: string | null;
  itemId: string;
  itemName: string;
  requiredQuantity: number;
  shortageQuantity: number;
  supplierLeadTimeDays: number | null;
};

export type ProductionVarianceRow = {
  actualMaterialQuantity: number;
  actualOutput: number;
  batchNumber: string;
  expectedMaterialQuantity: number;
  expectedOutput: number;
  materialVariance: number;
  outputVariance: number;
  productName: string;
  shift: string;
};

export type ProductionYieldRow = {
  acceptedOutput: number;
  batchNumber: string;
  mixUsed: number;
  productName: string;
  shift: string;
  yieldPercentage: number;
};

export type ProductionProductivityRow = {
  actualOutput: number;
  batchNumber: string;
  outputPerWorker: number;
  productName: string;
  shift: string;
  workerCount: number;
};

export type ProductionCostingRow = {
  acceptedOutput: number;
  batchNumber: string;
  costPerUnit: number;
  productName: string;
  shift: string;
  totalBatchCost: number;
};

export type ShiftPerformanceRow = {
  actualOutput: number;
  date: string;
  efficiencyPercentage: number;
  shift: string;
  targetOutput: number;
  totalBatches: number;
  varianceQuantity: number;
  workerCount: number;
};

export type ImportValidationResult<T extends Record<string, unknown>> = {
  errors: Array<{ message: string; rowNumber: number }>;
  rows: T[];
};

export type ProductionStockReceiveLineInput = {
  itemId?: string | null;
  quantity?: number | string | null;
  unitCost?: number | string | null;
};

export type ProductionStockReceiveFailure = {
  success: false;
  code: 'PRODUCTION_STOCK_RECEIVE_FAILED';
  stage: string;
  message: string;
  details: {
    productionOrderId: string | null;
    itemId: string | null;
    sourceWarehouseId: string | null;
    destinationWarehouseId: string | null;
    quantity: number | null;
    dbMessage: string | null;
  };
};

export type LiveWarehouseLike = {
  code?: unknown;
  name?: unknown;
  type?: unknown;
  warehouseType?: unknown;
  warehouse_type?: unknown;
};

export type LiveWarehouseKind = 'production' | 'raw';
export type ProductionSmokeSetupStage =
  | 'WAREHOUSE_OR_SOURCE_STOCK_MISSING'
  | 'SOURCE_STOCK_SEED_UNAVAILABLE';

export type ProductionSmokeSetupFailure = {
  success: false;
  code: 'PRODUCTION_SMOKE_SETUP_FAILED';
  stage: ProductionSmokeSetupStage;
  message: string;
  details: Record<string, unknown>;
};

function normalizeLiveWarehouseType(value: unknown) {
  const warehouseType = normalizeWarehouseCode(String(value ?? ''));

  switch (warehouseType) {
    case 'PRODUCTION_MATERIAL':
    case 'PRODUCTION_MATERIALS':
    case 'PRODUCTION_MATERIALS_STORE':
    case 'PRODUCTION_WAREHOUSE':
      return 'PRODUCTION';
    case 'RAW_MATERIALS_STORE':
      return 'RAW_MATERIALS';
    default:
      return warehouseType;
  }
}

export function getExistingWarehouseTypes(warehouses: LiveWarehouseLike[]) {
  const types = new Set<string>();

  for (const warehouse of warehouses) {
    const warehouseType = normalizeLiveWarehouseType(
      warehouse.warehouseType ?? warehouse.warehouse_type ?? warehouse.type,
    );
    if (warehouseType) {
      types.add(warehouseType);
    }
  }

  return [...types];
}

export function resolveWarehouseTypeForLive(
  kind: LiveWarehouseKind,
  existingTypes: string[],
) {
  const normalizedTypes = new Set(existingTypes.map((type) => normalizeLiveWarehouseType(type)).filter(Boolean));
  const preferredTypes =
    kind === 'production'
      ? ['PRODUCTION', 'WIP', 'GENERAL']
      : ['RAW_MATERIALS', 'RAW_MATERIAL', 'GENERAL'];

  for (const preferredType of preferredTypes) {
    if (normalizedTypes.has(preferredType)) {
      return preferredType;
    }
  }

  return null;
}

export function resolveWarehouseTypeCandidatesForLive(
  kind: LiveWarehouseKind,
  existingTypes: string[],
) {
  const preferredTypes =
    kind === 'production'
      ? ['PRODUCTION', 'WIP', 'GENERAL']
      : ['RAW_MATERIALS', 'RAW_MATERIAL', 'GENERAL'];
  const normalizedExisting = existingTypes
    .map((type) => normalizeLiveWarehouseType(type))
    .filter(Boolean);

  return [...new Set([...preferredTypes.filter((type) => normalizedExisting.includes(type)), ...preferredTypes])];
}

export function calculateProductionSmokeSeedQuantity(
  availableQuantity: number,
  requiredQuantity: number,
) {
  const normalizedAvailable = Number.isFinite(availableQuantity) ? availableQuantity : 0;
  const normalizedRequired = ensurePositiveQuantity(requiredQuantity, 'requiredQuantity');
  return Math.max(normalizedRequired - normalizedAvailable, 0);
}

export function buildProductionSmokeSetupFailure(input: {
  details?: Record<string, unknown>;
  message: string;
  stage: ProductionSmokeSetupStage;
}): ProductionSmokeSetupFailure {
  return {
    success: false,
    code: 'PRODUCTION_SMOKE_SETUP_FAILED',
    stage: input.stage,
    message: input.message,
    details: input.details ?? {},
  };
}

export function normalizeProductionStockReceiveItems(
  items: ProductionStockReceiveLineInput[],
) {
  return items
    .map((item) => ({
      itemId: String(item.itemId ?? '').trim(),
      quantity: toNumber(item.quantity, 0),
      unitCost: toNumber(item.unitCost, 0),
    }))
    .filter((item) => item.itemId && item.quantity > 0)
    .sort((left, right) => {
      if (left.itemId === right.itemId) {
        return left.quantity - right.quantity;
      }

      return left.itemId.localeCompare(right.itemId);
    });
}

export function buildProductionStockReceiveSignature(input: {
  destinationWarehouseId?: string | null;
  items: ProductionStockReceiveLineInput[];
  notes?: string | null;
  productionOrderId?: string | null;
  sourceWarehouseId?: string | null;
  transferDate?: string | null;
}) {
  return JSON.stringify({
    destinationWarehouseId: String(input.destinationWarehouseId ?? '').trim(),
    items: normalizeProductionStockReceiveItems(input.items),
    notes: String(input.notes ?? '').trim(),
    productionOrderId: String(input.productionOrderId ?? '').trim(),
    sourceWarehouseId: String(input.sourceWarehouseId ?? '').trim(),
    transferDate: String(input.transferDate ?? '').trim(),
  });
}

export function buildProductionStockReceiveFailure(input: {
  dbMessage?: string | null;
  destinationWarehouseId?: string | null;
  itemId?: string | null;
  message: string;
  productionOrderId?: string | null;
  quantity?: number | null;
  sourceWarehouseId?: string | null;
  stage: string;
}): ProductionStockReceiveFailure {
  return {
    success: false,
    code: 'PRODUCTION_STOCK_RECEIVE_FAILED',
    stage: input.stage,
    message: `${input.stage}: ${input.message}`,
    details: {
      productionOrderId: input.productionOrderId ? String(input.productionOrderId) : null,
      itemId: input.itemId ? String(input.itemId) : null,
      sourceWarehouseId: input.sourceWarehouseId ? String(input.sourceWarehouseId) : null,
      destinationWarehouseId: input.destinationWarehouseId ? String(input.destinationWarehouseId) : null,
      quantity: input.quantity == null ? null : toNumber(input.quantity),
      dbMessage: input.dbMessage ? String(input.dbMessage) : null,
    },
  };
}

export function calculateScalingFactor(plannedQuantity: number, standardOutputQuantity: number) {
  const normalizedPlanned = ensurePositiveQuantity(plannedQuantity, 'plannedQuantity');
  const normalizedStandardOutput = ensurePositiveQuantity(standardOutputQuantity, 'standardOutputQuantity');
  return normalizedPlanned / normalizedStandardOutput;
}

export function calculateScaledMaterialRequirement(input: {
  plannedQuantity: number;
  quantityRequired: number | string;
  standardOutputQuantity: number;
  standardUnitCost?: number | null;
  wastageAllowancePercent?: number | null;
}) {
  const scalingFactor = calculateScalingFactor(input.plannedQuantity, input.standardOutputQuantity);
  const baseRequiredQuantity = ensurePositiveQuantity(input.quantityRequired, 'quantityRequired') * scalingFactor;
  const wastageAllowancePercent = ensureNonNegative(input.wastageAllowancePercent ?? 0, 'wastageAllowancePercent');
  const requiredQuantity = baseRequiredQuantity + (baseRequiredQuantity * wastageAllowancePercent) / 100;
  const standardUnitCost = ensureNonNegative(input.standardUnitCost ?? 0, 'standardUnitCost');

  return {
    estimatedMaterialCost: requiredQuantity * standardUnitCost,
    requiredQuantity,
    scalingFactor,
    standardUnitCost,
  };
}

export function normalizeShift(value: unknown): ProductionShift {
  const text = String(value ?? '').trim().toUpperCase();
  return text === 'NIGHT' ? 'NIGHT' : 'DAY';
}

export function validateProductionCodeUniqueness(existingCodes: string[], nextCode: string) {
  return !existingCodes.map((code) => code.trim().toUpperCase()).includes(nextCode.trim().toUpperCase());
}

export function calculateRequiredMaterials(
  recipeItems: MaterialRequirementInput[],
  plannedQuantity: number,
  recipeExpectedOutput: number,
  stockByItemId = new Map<string, number>(),
): MaterialRequirementRow[] {
  const normalizedPlanned = ensurePositiveQuantity(plannedQuantity, 'plannedQuantity');
  const normalizedExpectedOutput = ensurePositiveQuantity(recipeExpectedOutput, 'recipeExpectedOutput');

  return recipeItems.map((item) => {
    const ingredient = asObject(item.items);
    const unit = asObject(item.units_of_measure);
    const wastageAllowancePercent = ensureNonNegative(item.wastage_allowance_percent ?? 0, 'wastageAllowancePercent');
    const standardUnitCost = ensureNonNegative(ingredient?.unit_cost ?? 0, 'standardUnitCost');
    const scaled = calculateScaledMaterialRequirement({
      plannedQuantity: normalizedPlanned,
      quantityRequired: item.quantity_required ?? 0,
      standardOutputQuantity: normalizedExpectedOutput,
      standardUnitCost,
      wastageAllowancePercent,
    });
    const availableQuantity = stockByItemId.get(String(item.item_id)) ?? 0;

    return {
      availableQuantity,
      estimatedMaterialCost: scaled.estimatedMaterialCost,
      itemCode: ingredient?.code ? String(ingredient.code) : null,
      itemId: String(item.item_id),
      itemName: String(ingredient?.name ?? 'Unknown item'),
      requiredQuantity: scaled.requiredQuantity,
      scalingFactor: scaled.scalingFactor,
      shortageQuantity: Math.max(0, scaled.requiredQuantity - availableQuantity),
      standardUnitCost: scaled.standardUnitCost,
      unit: unit?.abbreviation ? String(unit.abbreviation) : null,
      unitId: item.unit_id ? String(item.unit_id) : null,
      wastageAllowancePercent,
    };
  });
}

export function summarizePlanShortages(
  requirements: MaterialRequirementRow[],
  supplierLeadTimes = new Map<string, number>(),
): PlanShortageSummary[] {
  return requirements
    .filter((row) => row.shortageQuantity > 0)
    .map((row) => ({
      availableQuantity: row.availableQuantity,
      itemCode: row.itemCode,
      itemId: row.itemId,
      itemName: row.itemName,
      requiredQuantity: row.requiredQuantity,
      shortageQuantity: row.shortageQuantity,
      supplierLeadTimeDays: supplierLeadTimes.get(row.itemId) ?? null,
    }))
    .sort((a, b) => b.shortageQuantity - a.shortageQuantity);
}

export function calculateEfficiencyPercentage(actualOutput: number, expectedOutput: number) {
  const normalizedExpectedOutput = ensurePositiveQuantity(expectedOutput, 'expectedOutput');
  const normalizedActualOutput = ensureNonNegative(actualOutput, 'actualOutput');
  return (normalizedActualOutput / normalizedExpectedOutput) * 100;
}

export function calculateYieldPercentage(acceptedOutput: number, mixUsed: number) {
  const normalizedAcceptedOutput = ensureNonNegative(acceptedOutput, 'acceptedOutput');
  const normalizedMixUsed = ensurePositiveQuantity(mixUsed, 'mixUsed');
  return (normalizedAcceptedOutput / normalizedMixUsed) * 100;
}

export function calculateProductivity(actualOutput: number, workerCount: number) {
  const normalizedActualOutput = ensureNonNegative(actualOutput, 'actualOutput');
  const normalizedWorkerCount = ensurePositiveQuantity(workerCount, 'workerCount');
  return normalizedActualOutput / normalizedWorkerCount;
}

export function calculateCostPerUnit(totalBatchCost: number, acceptedOutput: number) {
  const normalizedTotalBatchCost = ensureNonNegative(totalBatchCost, 'totalBatchCost');
  const normalizedAcceptedOutput = ensurePositiveQuantity(acceptedOutput, 'acceptedOutput');
  return normalizedTotalBatchCost / normalizedAcceptedOutput;
}

export function buildVarianceRows(
  batches: Array<Record<string, unknown>>,
): ProductionVarianceRow[] {
  return batches.map((batch) => {
    const materials = asArray(batch.production_batch_materials);
    const recipe = asObject(batch.recipes);
    const finishedItem = asObject(recipe?.finished_item);
    const expectedMaterialQuantity = materials.reduce(
      (sum, row) => sum + toNumber(row.quantity_required),
      0,
    );
    const actualMaterialQuantity = materials.reduce(
      (sum, row) => sum + toNumber(row.quantity_actual ?? row.quantity_issued),
      0,
    );
    const expectedOutput = toNumber(batch.expected_output);
    const actualOutput = toNumber(batch.actual_output);

    return {
      actualMaterialQuantity,
      actualOutput,
      batchNumber: String(batch.batch_number ?? ''),
      expectedMaterialQuantity,
      expectedOutput,
      materialVariance: actualMaterialQuantity - expectedMaterialQuantity,
      outputVariance: actualOutput - expectedOutput,
      productName: String(finishedItem?.name ?? recipe?.name ?? 'Unknown product'),
      shift: String(batch.shift ?? ''),
    };
  });
}

export function buildYieldRows(
  batches: Array<Record<string, unknown>>,
): ProductionYieldRow[] {
  return batches.map((batch) => {
    const recipe = asObject(batch.recipes);
    const finishedItem = asObject(recipe?.finished_item);
    const materials = asArray(batch.production_batch_materials);
    const mixUsed = materials
      .filter((row) => {
        const item = asObject(row.items);
        const name = String(item?.name ?? '').toLowerCase();
        return name.includes('mix');
      })
      .reduce((sum, row) => sum + toNumber(row.quantity_actual ?? row.quantity_issued), 0);
    const acceptedOutput = toNumber(batch.actual_output);

    return {
      acceptedOutput,
      batchNumber: String(batch.batch_number ?? ''),
      mixUsed,
      productName: String(finishedItem?.name ?? recipe?.name ?? 'Unknown product'),
      shift: String(batch.shift ?? ''),
      yieldPercentage: mixUsed > 0 ? calculateYieldPercentage(acceptedOutput, mixUsed) : 0,
    };
  });
}

export function buildProductivityRows(
  batches: Array<Record<string, unknown>>,
  workerCounts = new Map<string, number>(),
): ProductionProductivityRow[] {
  return batches.map((batch) => {
    const recipe = asObject(batch.recipes);
    const finishedItem = asObject(recipe?.finished_item);
    const batchId = String(batch.id ?? '');
    const workerCount = workerCounts.get(batchId) ?? toNumber(batch.worker_count, 0);
    const actualOutput = toNumber(batch.actual_output);

    return {
      actualOutput,
      batchNumber: String(batch.batch_number ?? ''),
      outputPerWorker: workerCount > 0 ? calculateProductivity(actualOutput, workerCount) : 0,
      productName: String(finishedItem?.name ?? recipe?.name ?? 'Unknown product'),
      shift: String(batch.shift ?? ''),
      workerCount,
    };
  });
}

export function buildCostingRows(
  batches: Array<Record<string, unknown>>,
): ProductionCostingRow[] {
  return batches.map((batch) => {
    const recipe = asObject(batch.recipes);
    const finishedItem = asObject(recipe?.finished_item);
    const materials = asArray(batch.production_batch_materials);
    const totalBatchCost = materials.reduce((sum, row) => {
      const actualQuantity = toNumber(row.quantity_actual ?? row.quantity_issued);
      const item = asObject(row.items);
      const unitCost = toNumber(row.unit_cost ?? item?.unit_cost);
      return sum + (actualQuantity * unitCost);
    }, 0);
    const acceptedOutput = toNumber(batch.actual_output);

    return {
      acceptedOutput,
      batchNumber: String(batch.batch_number ?? ''),
      costPerUnit: acceptedOutput > 0 ? calculateCostPerUnit(totalBatchCost, acceptedOutput) : 0,
      productName: String(finishedItem?.name ?? recipe?.name ?? 'Unknown product'),
      shift: String(batch.shift ?? ''),
      totalBatchCost,
    };
  });
}

export function buildShiftPerformanceRows(
  batches: Array<Record<string, unknown>>,
  targets: Array<Record<string, unknown>>,
  workerCounts = new Map<string, number>(),
): ShiftPerformanceRow[] {
  const grouped = new Map<string, ShiftPerformanceRow>();

  for (const batch of batches) {
    const date = String(batch.production_date ?? '').slice(0, 10);
    const shift = String(batch.shift ?? '');
    const key = `${date}:${shift}`;
    const existing = grouped.get(key) ?? {
      actualOutput: 0,
      date,
      efficiencyPercentage: 0,
      shift,
      targetOutput: 0,
      totalBatches: 0,
      varianceQuantity: 0,
      workerCount: 0,
    };

    existing.actualOutput += toNumber(batch.actual_output);
    existing.totalBatches += 1;
    existing.workerCount += workerCounts.get(String(batch.id ?? '')) ?? toNumber(batch.worker_count, 0);
    grouped.set(key, existing);
  }

  for (const target of targets) {
    const date = String(target.target_date ?? target.shift_date ?? '').slice(0, 10);
    const shift = String(target.shift ?? '');
    const key = `${date}:${shift}`;
    const existing = grouped.get(key) ?? {
      actualOutput: 0,
      date,
      efficiencyPercentage: 0,
      shift,
      targetOutput: 0,
      totalBatches: 0,
      varianceQuantity: 0,
      workerCount: 0,
    };

    existing.targetOutput += toNumber(target.target_output_quantity ?? target.target_quantity);
    existing.workerCount = Math.max(existing.workerCount, toNumber(target.target_workers, existing.workerCount));
    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      efficiencyPercentage: row.targetOutput > 0 ? (row.actualOutput / row.targetOutput) * 100 : 0,
      varianceQuantity: row.actualOutput - row.targetOutput,
    }))
    .sort((a, b) => `${b.date}${b.shift}`.localeCompare(`${a.date}${a.shift}`));
}

export function buildReportCsv(rows: Array<Record<string, unknown>>) {
  return toCsv(rows as Array<Record<string, string | number | boolean | null | undefined>>);
}

export function buildProductionImportTemplate(type: 'recipes' | 'shift-targets') {
  if (type === 'recipes') {
    return toCsv([
      {
        chocolateTypeCode: '',
        expectedOutputQuantity: 0,
        flavourCode: '',
        ingredientCode: '',
        ingredientQuantity: 0,
        packagingRequirement: '',
        productCode: '',
        recipeCode: '',
        recipeName: '',
        unitAbbreviation: '',
        versionNumber: 1,
        wastageAllowancePercent: 0,
      },
    ]);
  }

  return toCsv([
    {
      productCode: '',
      shift: 'DAY',
      targetDate: normalizeDate(new Date().toISOString()).slice(0, 10),
      targetMaterialUsage: 0,
      targetOutputQuantity: 0,
      targetProductionTimeHours: 0,
      targetWorkers: 0,
    },
  ]);
}

export function validateRecipeImportRows(
  rows: Array<Record<string, unknown>>,
): ImportValidationResult<Record<string, unknown>> {
  const errors: ImportValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const recipeCode = String(row.recipeCode ?? '').trim();
    const productCode = String(row.productCode ?? '').trim();
    const ingredientCode = String(row.ingredientCode ?? '').trim();
    const ingredientQuantity = toNumber(row.ingredientQuantity, NaN);

    if (!recipeCode) errors.push({ message: 'recipeCode is required', rowNumber });
    if (!productCode) errors.push({ message: 'productCode is required', rowNumber });
    if (!ingredientCode) errors.push({ message: 'ingredientCode is required', rowNumber });
    if (!Number.isFinite(ingredientQuantity) || ingredientQuantity <= 0) {
      errors.push({ message: 'ingredientQuantity must be greater than zero', rowNumber });
    }

    if (recipeCode && productCode && ingredientCode && ingredientQuantity > 0) {
      validRows.push(row);
    }
  });

  return { errors, rows: validRows };
}

export function validateShiftTargetImportRows(
  rows: Array<Record<string, unknown>>,
): ImportValidationResult<Record<string, unknown>> {
  const errors: ImportValidationResult<Record<string, unknown>>['errors'] = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const productCode = String(row.productCode ?? '').trim();
    const targetOutputQuantity = toNumber(row.targetOutputQuantity, NaN);
    const targetWorkers = toNumber(row.targetWorkers, NaN);

    if (!productCode) errors.push({ message: 'productCode is required', rowNumber });
    if (!Number.isFinite(targetOutputQuantity) || targetOutputQuantity <= 0) {
      errors.push({ message: 'targetOutputQuantity must be greater than zero', rowNumber });
    }
    if (!Number.isFinite(targetWorkers) || targetWorkers <= 0) {
      errors.push({ message: 'targetWorkers must be greater than zero', rowNumber });
    }

    if (productCode && targetOutputQuantity > 0 && targetWorkers > 0) {
      validRows.push(row);
    }
  });

  return { errors, rows: validRows };
}
