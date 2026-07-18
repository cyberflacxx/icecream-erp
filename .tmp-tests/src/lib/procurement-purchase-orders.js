"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePurchaseOrderStatus = normalizePurchaseOrderStatus;
exports.derivePurchaseOrderStatus = derivePurchaseOrderStatus;
exports.formatPurchaseOrderStatusLabel = formatPurchaseOrderStatusLabel;
exports.formatPurchaseOrderDbStatus = formatPurchaseOrderDbStatus;
exports.isPurchaseOrderSentLike = isPurchaseOrderSentLike;
exports.isPurchaseOrderRejectable = isPurchaseOrderRejectable;
exports.isPurchaseOrderApprovable = isPurchaseOrderApprovable;
exports.normalizePurchaseOrderSupplierId = normalizePurchaseOrderSupplierId;
exports.buildPurchaseOrderDraftPayload = buildPurchaseOrderDraftPayload;
const STATUS_LABELS = {
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
function normalizePurchaseOrderStatus(status) {
    return String(status ?? '')
        .trim()
        .replace(/\s+/g, '_')
        .toUpperCase();
}
function derivePurchaseOrderStatus(input) {
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
function formatPurchaseOrderStatusLabel(status) {
    const normalized = normalizePurchaseOrderStatus(status);
    return STATUS_LABELS[normalized] ?? (normalized.replace(/_/g, ' ').trim() || 'Draft');
}
function formatPurchaseOrderDbStatus(target, sampleStatus) {
    const useUppercase = String(sampleStatus ?? '') === String(sampleStatus ?? '').toUpperCase();
    const nextStatus = useUppercase ? target.toUpperCase() : target;
    return nextStatus;
}
function isPurchaseOrderSentLike(status) {
    const normalized = normalizePurchaseOrderStatus(status);
    return normalized === 'SENT' || normalized === 'SENT_TO_SUPPLIER' || normalized === 'PARTIAL_RECEIVED';
}
function isPurchaseOrderRejectable(status) {
    const normalized = normalizePurchaseOrderStatus(status);
    return normalized === 'DRAFT' || normalized === 'APPROVED';
}
function isPurchaseOrderApprovable(status) {
    return normalizePurchaseOrderStatus(status) === 'DRAFT';
}
function normalizePurchaseOrderSupplierId(input) {
    const supplierId = [input.supplier_id, input.supplierId]
        .map((value) => String(value ?? '').trim())
        .find(Boolean);
    return supplierId ?? '';
}
function buildPurchaseOrderDraftPayload(input) {
    const supplierId = normalizePurchaseOrderSupplierId(input);
    return {
        approverEmail: input.approverEmail?.trim() || null,
        approverName: input.approverName?.trim() || null,
        approverUserId: input.approverUserId ?? null,
        approvalNotes: input.approvalNotes?.trim() || null,
        discountAmount: input.discountAmount,
        expectedDeliveryDate: input.expectedDeliveryDate ?? null,
        items: input.items,
        notes: input.notes ?? null,
        orderDate: input.orderDate ?? null,
        requisitionId: input.requisitionId ?? null,
        supplierId,
        supplier_id: supplierId,
        taxAmount: input.taxAmount,
    };
}
