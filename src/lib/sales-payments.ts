export interface SalesReceiptPrintPayload {
  branchSaleId?: string;
  paymentId?: string;
}

export function formatPaymentMethodLabel(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function buildSalesReceiptPrintUrl(payload: SalesReceiptPrintPayload, options?: { autoPrint?: boolean }) {
  const searchParams = new URLSearchParams();
  if (payload.paymentId) searchParams.set('paymentId', payload.paymentId);
  if (payload.branchSaleId) searchParams.set('branchSaleId', payload.branchSaleId);

  if (options?.autoPrint) searchParams.set('autoprint', '1');

  return `/sales/payments/receipt?${searchParams.toString()}`;
}

export function buildBranchSaleReceiptNumber(saleNumber: string) {
  const normalized = String(saleNumber ?? '').trim();
  if (!normalized) return 'BRR-PENDING';
  return normalized.startsWith('BS-') ? normalized.replace(/^BS-/, 'BRR-') : `BRR-${normalized}`;
}
