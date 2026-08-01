import { toNumber } from './inventory';

export type FinancePostingLineInput = {
  accountId: string;
  branchId?: string | null;
  costCenterCode?: string | null;
  creditAmount: number;
  debitAmount: number;
  description?: string | null;
};

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

export function resolveInventoryPostingMappingKey(input: {
  itemCategoryName?: string | null;
  itemType?: string | null;
  preferBranchInventory?: boolean;
}) {
  const itemType = normalizeText(input.itemType);
  const categoryName = normalizeText(input.itemCategoryName);

  if (input.preferBranchInventory) {
    return 'BRANCH_INVENTORY';
  }

  if (
    itemType.includes('PACK') ||
    categoryName.includes('PACK') ||
    categoryName.includes('CUP') ||
    categoryName.includes('CONE') ||
    categoryName.includes('LID')
  ) {
    return 'PACKAGING_INVENTORY';
  }

  if (
    itemType.includes('FINISHED') ||
    itemType.includes('PRODUCT') ||
    itemType.includes('MERCH')
  ) {
    return 'FINISHED_GOODS_INVENTORY';
  }

  return 'RAW_MATERIAL_INVENTORY';
}

export function resolveProductionCostCentrePriority(shift: string | null | undefined) {
  const normalizedShift = normalizeText(shift);
  if (normalizedShift.includes('NIGHT')) {
    return ['PRODUCTION_NIGHT', 'FACTORY'];
  }
  if (normalizedShift.includes('DAY')) {
    return ['PRODUCTION_DAY', 'FACTORY'];
  }
  return ['FACTORY'];
}

export function collapseFinancePostingLines(lines: FinancePostingLineInput[]) {
  const grouped = new Map<string, FinancePostingLineInput>();

  for (const line of lines) {
    const key = [
      line.accountId,
      line.branchId ?? '',
      line.costCenterCode ?? '',
      line.description ?? '',
    ].join('::');
    const current = grouped.get(key) ?? {
      accountId: line.accountId,
      branchId: line.branchId ?? null,
      costCenterCode: line.costCenterCode ?? null,
      creditAmount: 0,
      debitAmount: 0,
      description: line.description ?? null,
    };
    current.debitAmount += toNumber(line.debitAmount);
    current.creditAmount += toNumber(line.creditAmount);
    grouped.set(key, current);
  }

  return [...grouped.values()].filter((line) => line.debitAmount > 0 || line.creditAmount > 0);
}

export function toDateOnly(value: string | null | undefined, fallback = new Date().toISOString().slice(0, 10)) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, 10) : fallback;
}
