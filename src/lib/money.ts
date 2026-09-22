export const MONEY_DECIMAL_PLACES = 4;
export const MONEY_EPSILON = 1 / 10 ** MONEY_DECIMAL_PLACES;

export const defaultCurrencyCode = 'USD';

export function formatCurrency(value: unknown, currency = defaultCurrencyCode) {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat('en-US', {
    currency,
    maximumFractionDigits: MONEY_DECIMAL_PLACES,
    minimumFractionDigits: MONEY_DECIMAL_PLACES,
    style: 'currency',
  }).format(safeAmount);
}

export function formatMoneyAmount(value: unknown) {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return safeAmount.toLocaleString('en-US', {
    maximumFractionDigits: MONEY_DECIMAL_PLACES,
    minimumFractionDigits: MONEY_DECIMAL_PLACES,
  });
}
