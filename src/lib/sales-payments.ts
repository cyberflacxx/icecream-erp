export interface SalesReceiptPrintPayload {
  paymentId: string;
}

export function formatPaymentMethodLabel(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function buildSalesReceiptPrintUrl(payload: SalesReceiptPrintPayload, options?: { autoPrint?: boolean }) {
  const searchParams = new URLSearchParams({
    paymentId: payload.paymentId,
  });

  if (options?.autoPrint) searchParams.set('autoprint', '1');

  return `/sales/payments/receipt?${searchParams.toString()}`;
}
