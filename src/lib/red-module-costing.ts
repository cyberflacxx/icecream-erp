export type CostStatus = 'COMPLETE' | 'NOT_CONFIGURED' | 'PARTIAL';

type Primitive = string | number | boolean | null | undefined;

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function resolveLabourRate(row: Record<string, unknown>) {
  const hourlyRate = toNumber(row.hourly_rate, Number.NaN);
  if (Number.isFinite(hourlyRate) && hourlyRate > 0) return { rate: hourlyRate, rateType: 'HOURLY' };

  const rate = toNumber(row.rate, Number.NaN);
  if (Number.isFinite(rate) && rate > 0) return { rate, rateType: String(row.rate_type ?? 'HOURLY').toUpperCase() };

  const shiftRate = toNumber(row.shift_rate, Number.NaN);
  if (Number.isFinite(shiftRate) && shiftRate > 0) return { rate: shiftRate, rateType: 'SHIFT' };

  const dailyRate = toNumber(row.daily_rate ?? row.basic_rate, Number.NaN);
  if (Number.isFinite(dailyRate) && dailyRate > 0) return { rate: dailyRate, rateType: 'DAILY' };

  return { rate: null, rateType: null };
}

export function calculateWorkerLabourCost(input: {
  hoursWorked?: unknown;
  labourCost?: unknown;
  rate?: unknown;
}) {
  const explicitCost = toNumber(input.labourCost, Number.NaN);
  if (Number.isFinite(explicitCost) && explicitCost > 0) return round(explicitCost);

  const hoursWorked = toNumber(input.hoursWorked, Number.NaN);
  const rate = toNumber(input.rate, Number.NaN);
  if (!Number.isFinite(hoursWorked) || hoursWorked <= 0 || !Number.isFinite(rate) || rate <= 0) return null;
  return round(hoursWorked * rate);
}

export function summarizeBatchLabour(input: {
  assignments?: Array<Record<string, unknown>>;
  goodUnitsProduced: number;
  labourAllocations?: Array<Record<string, unknown>>;
}) {
  const allocations = input.labourAllocations ?? [];
  const workers = new Set<string>();
  let totalHours = 0;
  let totalCost = 0;
  let missingRate = false;
  let missingHours = false;

  for (const allocation of allocations) {
    const employeeId = String(allocation.employee_id ?? allocation.employeeId ?? '').trim();
    if (employeeId) workers.add(employeeId);
    const hoursWorked = toNumber(allocation.hours_worked ?? allocation.hoursWorked, Number.NaN);
    if (Number.isFinite(hoursWorked) && hoursWorked > 0) {
      totalHours += hoursWorked;
    } else {
      missingHours = true;
    }
    const rate = resolveLabourRate(allocation);
    if (rate.rate === null) missingRate = true;
    const workerCost = calculateWorkerLabourCost({
      hoursWorked,
      labourCost: allocation.labour_cost ?? allocation.labourCost,
      rate: rate.rate,
    });
    if (workerCost === null) {
      missingRate = true;
    } else {
      totalCost += workerCost;
    }
  }

  for (const assignment of input.assignments ?? []) {
    const employeeId = String(assignment.employee_id ?? assignment.employeeId ?? '').trim();
    if (employeeId) workers.add(employeeId);
  }

  const assignedWorkers = Math.max(workers.size, input.assignments?.length ?? 0);
  const missingComponents: string[] = [];
  if (assignedWorkers === 0) missingComponents.push('LABOUR_ASSIGNMENTS');
  if (allocations.length === 0) missingComponents.push('LABOUR_COST_ALLOCATIONS');
  if (missingHours) missingComponents.push('LABOUR_HOURS');
  if (missingRate) missingComponents.push('LABOUR_RATE');

  return {
    assignedWorkers,
    labourCostPerUnit: input.goodUnitsProduced > 0 ? round(totalCost / input.goodUnitsProduced, 4) : null,
    labourStatus: missingComponents.length === 0 ? 'COMPLETE' as CostStatus : 'NOT_CONFIGURED' as CostStatus,
    missingComponents,
    totalLabourCost: round(totalCost),
    totalLabourHours: round(totalHours, 4),
    unitsPerWorker: assignedWorkers > 0 ? round(input.goodUnitsProduced / assignedWorkers, 4) : null,
  };
}

export function buildProductionCostSummary(input: {
  goodUnitsProduced: number;
  labourCost?: unknown;
  overheadCost?: unknown;
  packagingCost?: unknown;
  rawMaterialCost?: unknown;
  receiptUnitCost?: unknown;
  totalProductionCost?: unknown;
  wastageCost?: unknown;
}) {
  const rawMaterialCost = toNumber(input.rawMaterialCost);
  const packagingCost = toNumber(input.packagingCost);
  const labourCost = toNumber(input.labourCost);
  const overheadCost = toNumber(input.overheadCost);
  const wastageCost = toNumber(input.wastageCost);
  const componentTotal = rawMaterialCost + packagingCost + labourCost + overheadCost + wastageCost;
  const postedTotal = toNumber(input.totalProductionCost, Number.NaN);
  const receiptUnitCost = toNumber(input.receiptUnitCost, Number.NaN);
  const goodUnitsProduced = toNumber(input.goodUnitsProduced);
  const authoritativeTotal = Number.isFinite(postedTotal) && postedTotal > 0
    ? postedTotal
    : componentTotal;
  const costPerGoodUnit = goodUnitsProduced > 0
    ? round(authoritativeTotal / goodUnitsProduced, 4)
    : Number.isFinite(receiptUnitCost) && receiptUnitCost > 0
      ? round(receiptUnitCost, 4)
      : null;

  const missingComponents: string[] = [];
  if (rawMaterialCost <= 0) missingComponents.push('RAW_MATERIAL_COST');
  if (packagingCost <= 0) missingComponents.push('PACKAGING_COST');
  if (labourCost <= 0) missingComponents.push('DIRECT_LABOUR_COST');
  if (overheadCost <= 0) missingComponents.push('OVERHEAD_NOT_CONFIGURED');
  if (goodUnitsProduced <= 0) missingComponents.push('GOOD_UNITS_PRODUCED');

  const costStatus: CostStatus = missingComponents.length === 0
    ? 'COMPLETE'
    : authoritativeTotal > 0 || componentTotal > 0
      ? 'PARTIAL'
      : 'NOT_CONFIGURED';

  return {
    costPerGoodUnit,
    costStatus,
    finishedGoodsValue: round(authoritativeTotal),
    goodUnitsProduced,
    labourCost: round(labourCost),
    missingComponents,
    overheadCost: round(overheadCost),
    packagingCost: round(packagingCost),
    rawMaterialCost: round(rawMaterialCost),
    totalProductionCost: round(authoritativeTotal),
    wastageCost: round(wastageCost),
  };
}

export type CustomerStatementEntry = {
  credit: number;
  date: string | null;
  debit: number;
  documentId: string;
  documentNumber: string;
  referenceType: string;
  type: string;
  [key: string]: unknown;
};

function entryTime(entry: CustomerStatementEntry) {
  return Date.parse(String(entry.date ?? '')) || 0;
}

export function buildCustomerStatement(input: {
  entries: CustomerStatementEntry[];
  fromDate?: string | null;
  toDate?: string | null;
}) {
  const fromTime = input.fromDate ? Date.parse(input.fromDate) : Number.NEGATIVE_INFINITY;
  const toTime = input.toDate ? Date.parse(input.toDate) : Number.POSITIVE_INFINITY;
  const sorted = input.entries.slice().sort((left, right) => entryTime(left) - entryTime(right));
  const openingBalance = round(sorted
    .filter((entry) => entryTime(entry) < fromTime)
    .reduce((sum, entry) => sum + entry.debit - entry.credit, 0));

  let runningBalance = openingBalance;
  const periodEntries = sorted
    .filter((entry) => entryTime(entry) >= fromTime && entryTime(entry) <= toTime)
    .map((entry) => {
      runningBalance = round(runningBalance + entry.debit - entry.credit);
      return { ...entry, runningBalance };
    });

  const periodDebits = round(periodEntries.reduce((sum, entry) => sum + entry.debit, 0));
  const periodCredits = round(periodEntries.reduce((sum, entry) => sum + entry.credit, 0));
  return {
    closingBalance: round(runningBalance),
    openingBalance,
    periodCredits,
    periodDebits,
    periodEntries,
  };
}
