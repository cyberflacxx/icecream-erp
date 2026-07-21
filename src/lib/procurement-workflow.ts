type WorkflowBadgeVariant = 'error' | 'info' | 'neutral' | 'success' | 'warning';

export interface ProcurementWorkflowAccess {
  canApprove?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canPost?: boolean;
  canSend?: boolean;
  role?: string | null;
  roleNames?: Array<string | null | undefined>;
}

interface RequisitionLike {
  approvalStatus?: unknown;
  approvedAt?: unknown;
  approvedBy?: unknown;
  approverName?: string | null;
  rejectedAt?: unknown;
  rejectedBy?: string | null;
  status?: unknown;
}

interface PurchaseOrderLike {
  approvedAt?: unknown;
  approvedBy?: unknown;
  approverName?: string | null;
  rejectedAt?: unknown;
  sentAt?: unknown;
  status?: unknown;
}

interface GoodsReceivedLike {
  purchaseOrder?: { id?: string | null } | null;
  qualityStatus?: unknown;
  status?: unknown;
}

function hasTimestamp(value: unknown) {
  return String(value ?? '').trim().length > 0;
}

function normalizeRoleName(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeStatusCode(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
}

export function formatProcurementWorkflowStatusLabel(value: string) {
  const normalized = normalizeStatusCode(value);
  return normalized.replace(/_/g, ' ').trim() || 'Draft';
}

function getRoleNames(access: ProcurementWorkflowAccess) {
  return [access.role, ...(access.roleNames ?? [])]
    .map(normalizeRoleName)
    .filter(Boolean);
}

function hasRole(access: ProcurementWorkflowAccess, matches: string[]) {
  const roles = getRoleNames(access);
  return roles.some((role) => matches.some((match) => role.includes(match)));
}

export function normalizeProcurementRoleName(value: string | null | undefined) {
  return normalizeRoleName(value);
}

export function resolveProcurementRoleAccess(access: ProcurementWorkflowAccess) {
  const adminLike = hasRole(access, ['super admin', 'system admin', 'administrator', 'admin']);
  const procurementLike = adminLike || hasRole(access, ['procurement', 'purchase', 'buyer']);
  const operationsLike = adminLike || hasRole(access, ['operations', 'branch manager', 'manager']);
  const inventoryLike = adminLike || hasRole(access, ['inventory', 'warehouse', 'store', 'stores', 'stock']);
  const supervisorLike = adminLike || hasRole(access, ['supervisor']);

  return {
    adminLike,
    canApprove: Boolean(access.canApprove) || procurementLike || operationsLike || inventoryLike || supervisorLike,
    canCreateDrafts: Boolean(access.canCreate) || Boolean(access.canEdit) || procurementLike || operationsLike,
    canCreateOrders: Boolean(access.canCreate) || Boolean(access.canEdit) || procurementLike || operationsLike,
    canPostInventory: Boolean(access.canPost) || inventoryLike || procurementLike || operationsLike,
    canReceiveGoods: Boolean(access.canCreate) || inventoryLike || procurementLike || operationsLike,
    canSendOrders: Boolean(access.canSend) || Boolean(access.canCreate) || procurementLike || operationsLike,
  };
}

export function deriveRequisitionWorkflowStatus(input: RequisitionLike) {
  const candidates = [input.approvalStatus, input.status].map(normalizeStatusCode);

  if (hasTimestamp(input.rejectedAt) || candidates.includes('REJECTED')) {
    return 'REJECTED';
  }

  if (candidates.includes('PO_CREATED')) {
    return 'PO_CREATED';
  }

  if (
    hasTimestamp(input.approvedAt) ||
    candidates.some((status) =>
      ['APPROVED', 'APPROVED_FOR_PO', 'LEVEL1_APPROVED', 'LEVEL2_APPROVED', 'OPEN'].includes(status),
    )
  ) {
    return 'APPROVED';
  }

  if (candidates.some((status) => ['PENDING_APPROVAL', 'AWAITING_APPROVAL', 'SUBMITTED'].includes(status))) {
    return 'PENDING_APPROVAL';
  }

  if (candidates.includes('CANCELLED')) {
    return 'CANCELLED';
  }

  return 'DRAFT';
}

export function getRequisitionStatusVariant(status: string): WorkflowBadgeVariant {
  if (status === 'APPROVED' || status === 'PO_CREATED') return 'success';
  if (status === 'PENDING_APPROVAL') return 'info';
  if (status === 'DRAFT') return 'warning';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'error';
  return 'neutral';
}

export function getRequisitionWorkflowCopy(input: RequisitionLike) {
  const normalizedStatus = deriveRequisitionWorkflowStatus(input);

  if (normalizedStatus === 'REJECTED') {
    return input.rejectedBy ? `Rejected by ${input.rejectedBy}.` : 'Rejected and waiting for revision.';
  }

  if (normalizedStatus === 'PO_CREATED') {
    return 'Converted to a purchase order.';
  }

  if (normalizedStatus === 'APPROVED') {
    return input.approvedBy ? `Approved by ${input.approvedBy}.` : 'Approved and ready for PO conversion.';
  }

  if (normalizedStatus === 'PENDING_APPROVAL') {
    return input.approverName ? `Waiting on ${input.approverName}.` : 'Submitted and waiting for approval.';
  }

  return input.approverName ? `Draft assigned to ${input.approverName}.` : 'Draft waiting to be submitted.';
}

export function getRequisitionActionState(row: RequisitionLike, access: ProcurementWorkflowAccess) {
  const normalizedStatus = deriveRequisitionWorkflowStatus(row);
  const roleAccess = resolveProcurementRoleAccess(access);

  return {
    canApprove: normalizedStatus === 'PENDING_APPROVAL' && roleAccess.canApprove,
    canCreatePo: (normalizedStatus === 'APPROVED' || normalizedStatus === 'PO_CREATED') && roleAccess.canCreateOrders,
    canEditDraft: normalizedStatus === 'DRAFT' && roleAccess.canCreateDrafts,
    canReject: normalizedStatus === 'PENDING_APPROVAL' && roleAccess.canApprove,
    canSubmit: normalizedStatus === 'DRAFT' && roleAccess.canCreateDrafts,
    normalizedStatus,
    statusVariant: getRequisitionStatusVariant(normalizedStatus),
  };
}

export function derivePurchaseOrderWorkflowStatus(input: PurchaseOrderLike) {
  const normalizedStatus = normalizeStatusCode(input.status);

  if (hasTimestamp(input.rejectedAt) || normalizedStatus === 'REJECTED' || normalizedStatus === 'CANCELLED') {
    return normalizedStatus === 'CANCELLED' ? 'CANCELLED' : 'REJECTED';
  }

  if (['FULLY_RECEIVED', 'RECEIVED'].includes(normalizedStatus)) {
    return 'FULLY_RECEIVED';
  }

  if (['PARTIAL_RECEIVED', 'PARTIALLY_RECEIVED'].includes(normalizedStatus)) {
    return 'PARTIAL_RECEIVED';
  }

  if (hasTimestamp(input.sentAt) || ['SENT', 'SENT_TO_SUPPLIER'].includes(normalizedStatus)) {
    return 'SENT_TO_SUPPLIER';
  }

  if (
    hasTimestamp(input.approvedAt) ||
    hasTimestamp(input.approvedBy) ||
    ['APPROVED', 'LEVEL1_APPROVED', 'LEVEL2_APPROVED'].includes(normalizedStatus)
  ) {
    return 'APPROVED';
  }

  if (['PENDING_APPROVAL', 'AWAITING_APPROVAL', 'SUBMITTED'].includes(normalizedStatus)) {
    return 'PENDING_APPROVAL';
  }

  return 'DRAFT';
}

export function getPurchaseOrderStatusVariant(status: string): WorkflowBadgeVariant {
  if (status === 'FULLY_RECEIVED') return 'success';
  if (status === 'PARTIAL_RECEIVED' || status === 'PENDING_APPROVAL') return 'warning';
  if (status === 'APPROVED' || status === 'SENT_TO_SUPPLIER') return 'info';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'error';
  return 'neutral';
}

export function getPurchaseOrderWorkflowCopy(input: PurchaseOrderLike) {
  const normalizedStatus = derivePurchaseOrderWorkflowStatus(input);

  if (normalizedStatus === 'SENT_TO_SUPPLIER' || normalizedStatus === 'PARTIAL_RECEIVED') {
    return 'Ready for goods receiving.';
  }

  if (normalizedStatus === 'APPROVED') {
    return 'Approved and ready to dispatch to the supplier.';
  }

  if (normalizedStatus === 'PENDING_APPROVAL') {
    return input.approverName ? `Waiting on ${input.approverName}.` : 'Waiting for approval.';
  }

  if (normalizedStatus === 'FULLY_RECEIVED') {
    return 'Fully received against stock.';
  }

  if (normalizedStatus === 'REJECTED' || normalizedStatus === 'CANCELLED') {
    return 'This order is closed and cannot progress.';
  }

  return 'Draft order waiting for review.';
}

export function getPurchaseOrderActionState(row: PurchaseOrderLike, access: ProcurementWorkflowAccess) {
  const normalizedStatus = derivePurchaseOrderWorkflowStatus(row);
  const roleAccess = resolveProcurementRoleAccess(access);

  return {
    canApprove: ['DRAFT', 'PENDING_APPROVAL'].includes(normalizedStatus) && roleAccess.canApprove,
    canEdit: ['DRAFT', 'PENDING_APPROVAL'].includes(normalizedStatus) && roleAccess.canCreateOrders,
    canRecordGrn: ['APPROVED', 'SENT_TO_SUPPLIER', 'PARTIAL_RECEIVED'].includes(normalizedStatus) && roleAccess.canReceiveGoods,
    canReject: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(normalizedStatus) && roleAccess.canApprove,
    canSend: normalizedStatus === 'APPROVED' && roleAccess.canSendOrders,
    normalizedStatus,
    statusVariant: getPurchaseOrderStatusVariant(normalizedStatus),
  };
}

export function deriveGoodsReceivedWorkflowStatus(input: GoodsReceivedLike) {
  const candidates = [input.qualityStatus, input.status].map(normalizeStatusCode);

  if (candidates.includes('POSTED')) {
    return 'POSTED';
  }

  if (candidates.includes('REJECTED')) {
    return 'REJECTED';
  }

  if (candidates.includes('APPROVED')) {
    return 'APPROVED';
  }

  if (candidates.some((status) => ['PENDING_APPROVAL', 'AWAITING_APPROVAL', 'SUBMITTED'].includes(status))) {
    return 'PENDING_APPROVAL';
  }

  return 'DRAFT';
}

export function getGoodsReceivedWorkflowCopy(input: GoodsReceivedLike) {
  const normalizedStatus = deriveGoodsReceivedWorkflowStatus(input);

  if (normalizedStatus === 'PENDING_APPROVAL') return 'Waiting for supervisor sign-off.';
  if (normalizedStatus === 'APPROVED') return 'Approved and ready to post into inventory.';
  if (normalizedStatus === 'POSTED') return 'Inventory posted.';
  if (normalizedStatus === 'REJECTED') return 'Rejected and not posted.';
  return 'Draft receipt.';
}

export function getGoodsReceivedActionState(row: GoodsReceivedLike, access: ProcurementWorkflowAccess) {
  const normalizedStatus = deriveGoodsReceivedWorkflowStatus(row);
  const roleAccess = resolveProcurementRoleAccess(access);
  const hasPurchaseOrderLink = Boolean(String(row.purchaseOrder?.id ?? '').trim());

  return {
    canApprove: normalizedStatus === 'PENDING_APPROVAL' && roleAccess.canApprove,
    canOpenPurchaseOrder: hasPurchaseOrderLink,
    canPost: normalizedStatus === 'APPROVED' && roleAccess.canPostInventory,
    canReject: normalizedStatus === 'PENDING_APPROVAL' && roleAccess.canApprove,
    normalizedStatus,
    statusVariant:
      normalizedStatus === 'POSTED'
        ? 'success'
        : normalizedStatus === 'APPROVED'
          ? 'info'
          : normalizedStatus === 'PENDING_APPROVAL'
            ? 'warning'
            : normalizedStatus === 'REJECTED'
              ? 'error'
              : 'neutral',
  };
}
