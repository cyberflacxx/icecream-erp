type RawStatus = 'approved' | 'cancelled' | 'draft' | 'sent_to_supplier';

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Approved',
  AWAITING_APPROVAL: 'Awaiting Approval',
  CANCELLED: 'Cancelled',
  DRAFT: 'Draft',
  FULLY_RECEIVED: 'Fully Received',
  LEVEL1_APPROVED: 'Level 1 Approved',
  LEVEL2_APPROVED: 'Level 2 Approved',
  PARTIAL_RECEIVED: 'Partial Received',
  REJECTED: 'Rejected',
  SENT: 'Sent',
  SENT_TO_SUPPLIER: 'Sent to Supplier',
};

export function normalizePurchaseOrderStatus(status: unknown) {
  return String(status ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase();
}

export function derivePurchaseOrderStatus(input: {
  rejectedAt?: unknown;
  sentAt?: unknown;
  status?: unknown;
}) {
  const normalized = normalizePurchaseOrderStatus(input.status);

  if (input.rejectedAt) {
    return 'REJECTED';
  }

  if (input.sentAt && normalized === 'APPROVED') {
    return 'SENT_TO_SUPPLIER';
  }

  if (normalized === 'RECEIVED') {
    return 'FULLY_RECEIVED';
  }

  return normalized || 'DRAFT';
}

export function formatPurchaseOrderStatusLabel(status: unknown) {
  const normalized = normalizePurchaseOrderStatus(status);
  return STATUS_LABELS[normalized] ?? (normalized.replace(/_/g, ' ').trim() || 'Draft');
}

export function formatPurchaseOrderDbStatus(target: RawStatus, sampleStatus: unknown) {
  const useUppercase = String(sampleStatus ?? '') === String(sampleStatus ?? '').toUpperCase();
  const nextStatus = useUppercase ? target.toUpperCase() : target;
  return nextStatus;
}

export function isPurchaseOrderSentLike(status: unknown) {
  const normalized = normalizePurchaseOrderStatus(status);
  return normalized === 'SENT' || normalized === 'SENT_TO_SUPPLIER' || normalized === 'PARTIAL_RECEIVED';
}

export function isPurchaseOrderRejectable(status: unknown) {
  const normalized = normalizePurchaseOrderStatus(status);
  return normalized === 'DRAFT' || normalized === 'APPROVED';
}

export function isPurchaseOrderApprovable(status: unknown) {
  return normalizePurchaseOrderStatus(status) === 'DRAFT';
}
