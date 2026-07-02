export interface SalesReceiptPrintPayload {
  amount: number;
  customerName: string;
  invoiceNumber: string;
  notes?: string;
  paymentDate: string;
  paymentMethod: string;
  paymentNumber: string;
  referenceNumber?: string;
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
    amount: String(payload.amount),
    customerName: payload.customerName,
    invoiceNumber: payload.invoiceNumber,
    paymentDate: payload.paymentDate,
    paymentMethod: payload.paymentMethod,
    paymentNumber: payload.paymentNumber,
  });

  if (payload.notes) searchParams.set('notes', payload.notes);
  if (payload.referenceNumber) searchParams.set('referenceNumber', payload.referenceNumber);
  if (options?.autoPrint) searchParams.set('autoprint', '1');

  return `/sales/payments/receipt?${searchParams.toString()}`;
}
