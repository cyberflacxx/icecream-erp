"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRequisitionItemId = normalizeRequisitionItemId;
exports.normalizeRequisitionUnitOfMeasureId = normalizeRequisitionUnitOfMeasureId;
exports.buildRequisitionDraftPayload = buildRequisitionDraftPayload;
function normalizeRequisitionItemId(input) {
    const itemId = [input.item_id, input.itemId]
        .map((value) => String(value ?? '').trim())
        .find(Boolean);
    return itemId ?? '';
}
function normalizeRequisitionUnitOfMeasureId(input) {
    const unitOfMeasureId = [
        input.unit_of_measure_id,
        input.unitOfMeasureId,
        input.uom_id,
        input.uomId,
        input.uom,
    ]
        .map((value) => String(value ?? '').trim())
        .find(Boolean);
    return unitOfMeasureId ?? '';
}
function buildRequisitionDraftPayload(input) {
    return {
        approverEmail: input.approverEmail?.trim() || null,
        approverName: input.approverName?.trim() || null,
        approverUserId: input.approverUserId ?? null,
        approvalNotes: input.approvalNotes?.trim() || null,
        department: input.department,
        items: input.items.map((item) => {
            const itemId = normalizeRequisitionItemId(item);
            const unitOfMeasureId = normalizeRequisitionUnitOfMeasureId(item);
            return {
                estimatedUnitCost: item.estimatedUnitCost ?? null,
                itemId,
                item_id: itemId,
                quantityRequested: item.quantityRequested,
                remarks: item.remarks ?? null,
                unitOfMeasureId,
                unit_of_measure_id: unitOfMeasureId,
                uomId: unitOfMeasureId,
                uom_id: unitOfMeasureId,
            };
        }),
        neededByDate: input.neededByDate ?? null,
        remarks: input.remarks ?? null,
    };
}
