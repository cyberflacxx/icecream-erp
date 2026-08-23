export type ExistingOpenShiftLookupInput = {
  branchId: string;
  organizationId?: string | null;
  shift: string;
  shiftDate: string;
};

export function normalizeOptionalUuidFilter(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const lowered = normalized.toLowerCase();
  if (lowered === 'undefined' || lowered === 'null') return null;

  return normalized;
}

export function buildExistingOpenShiftFilters(input: ExistingOpenShiftLookupInput) {
  return {
    branchId: input.branchId,
    organizationId: normalizeOptionalUuidFilter(input.organizationId),
    shift: input.shift,
    shiftDate: input.shiftDate,
    status: 'OPEN' as const,
  };
}
