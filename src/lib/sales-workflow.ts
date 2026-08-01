export function normalizeSalesQuotationStatus(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'ACCEPTED') return 'APPROVED';
  if (normalized === 'CONVERTED' || normalized === 'CONVERTED_TO_ORDER') return 'CONVERTED_TO_ORDER';
  return normalized || 'DRAFT';
}

export function normalizeSalesOrderStatus(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized || 'DRAFT';
}

export function normalizeSalesInvoiceStatus(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'PARTIAL_PAID') return 'PARTIALLY_PAID';
  return normalized || 'DRAFT';
}

export function deriveSalesInvoiceStatus(input: {
  amountPaid?: unknown;
  approvedAt?: unknown;
  approvedBy?: unknown;
  balanceDue?: unknown;
  postedAt?: unknown;
  postedBy?: unknown;
  status?: unknown;
  total?: unknown;
}) {
  const normalizedStatus = normalizeSalesInvoiceStatus(input.status);
  const total = Number(input.total ?? 0);
  const amountPaid = Number(input.amountPaid ?? 0);
  const balanceDue = Number(input.balanceDue ?? Math.max(0, total - amountPaid));

  if (['CANCELLED', 'VOIDED', 'REVERSED'].includes(normalizedStatus)) {
    return normalizedStatus;
  }
  if (normalizedStatus === 'PAID' || (total > 0 && balanceDue <= 0 && amountPaid > 0)) {
    return 'PAID';
  }
  if (normalizedStatus === 'PARTIALLY_PAID' || amountPaid > 0) {
    return 'PARTIALLY_PAID';
  }
  if (input.postedAt || input.postedBy) {
    return 'POSTED';
  }
  if (normalizedStatus === 'APPROVED' || input.approvedAt || input.approvedBy) {
    return 'APPROVED';
  }
  if (normalizedStatus === 'SENT') {
    return 'POSTED';
  }
  return normalizedStatus;
}

export function isSalesInvoicePosted(input: {
  amountPaid?: unknown;
  approvedAt?: unknown;
  approvedBy?: unknown;
  balanceDue?: unknown;
  postedAt?: unknown;
  postedBy?: unknown;
  status?: unknown;
  total?: unknown;
}) {
  return ['POSTED', 'PARTIALLY_PAID', 'PAID'].includes(deriveSalesInvoiceStatus(input));
}

export function isSalesInvoicePrintable(input: {
  amountPaid?: unknown;
  approvedAt?: unknown;
  approvedBy?: unknown;
  balanceDue?: unknown;
  postedAt?: unknown;
  postedBy?: unknown;
  status?: unknown;
  total?: unknown;
}) {
  return !['DRAFT', 'REJECTED', 'CANCELLED', 'VOIDED', 'REVERSED'].includes(deriveSalesInvoiceStatus(input));
}

export function isSalesOrderInvoiceable(value: unknown) {
  const normalized = normalizeSalesOrderStatus(value);
  return ['CONFIRMED', 'APPROVED', 'DISPATCHED'].includes(normalized);
}
