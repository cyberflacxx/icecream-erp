export const PURCHASE_ORDER_NUMBER_PREFIX = 'PO';
export const PURCHASE_ORDER_NUMBER_PADDING = 5;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parsePurchaseOrderNumber(value: unknown, prefix = PURCHASE_ORDER_NUMBER_PREFIX) {
  const match = String(value ?? '').trim().match(new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`));
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function nextPurchaseOrderNumber(
  existingNumbers: unknown[],
  options: { padding?: number; prefix?: string } = {},
) {
  const prefix = options.prefix ?? PURCHASE_ORDER_NUMBER_PREFIX;
  const padding = options.padding ?? PURCHASE_ORDER_NUMBER_PADDING;
  const highest = existingNumbers.reduce<number>((maximum, value) => {
    const parsed = parsePurchaseOrderNumber(value, prefix);
    return parsed === null ? maximum : Math.max(maximum, parsed);
  }, 0);

  return `${prefix}-${String(highest + 1).padStart(padding, '0')}`;
}

export function isPostgresUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      String((error as { code?: unknown }).code ?? '') === '23505',
  );
}
