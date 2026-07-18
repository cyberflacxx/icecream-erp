"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGoodsReceivedPurchaseOrderId = normalizeGoodsReceivedPurchaseOrderId;
exports.normalizeGoodsReceivedSupplierId = normalizeGoodsReceivedSupplierId;
exports.normalizeGoodsReceivedWarehouseId = normalizeGoodsReceivedWarehouseId;
exports.normalizeGoodsReceivedItemId = normalizeGoodsReceivedItemId;
exports.normalizeGoodsReceivedUnitOfMeasureId = normalizeGoodsReceivedUnitOfMeasureId;
exports.buildGoodsReceivedDraftPayload = buildGoodsReceivedDraftPayload;
function normalizeGoodsReceivedPurchaseOrderId(input) {
    const purchaseOrderId = [input.purchase_order_id, input.purchaseOrderId, input.po_id, input.poId]
        .map((value) => String(value ?? '').trim())
        .find(Boolean);
    return purchaseOrderId ?? '';
}
function normalizeGoodsReceivedSupplierId(input) {
    const supplierId = [input.supplier_id, input.supplierId]
        .map((value) => String(value ?? '').trim())
        .find(Boolean);
    return supplierId ?? '';
}
function normalizeGoodsReceivedWarehouseId(input) {
    const warehouseId = [
        input.warehouse_id,
        input.warehouseId,
        input.receiving_warehouse_id,
        input.receivingWarehouseId,
        input.destination_warehouse_id,
        input.destinationWarehouseId,
    ]
        .map((value) => String(value ?? '').trim())
        .find(Boolean);
    return warehouseId ?? '';
}
function normalizeGoodsReceivedItemId(input) {
    const itemId = [
        input.item_id,
        input.itemId,
        input.product_id,
        input.productId,
        input.raw_material_id,
        input.rawMaterialId,
    ]
        .map((value) => String(value ?? '').trim())
        .find(Boolean);
    return itemId ?? '';
}
function normalizeGoodsReceivedUnitOfMeasureId(input) {
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
function buildGoodsReceivedDraftPayload(input) {
    const purchaseOrderId = normalizeGoodsReceivedPurchaseOrderId(input);
    const supplierId = normalizeGoodsReceivedSupplierId(input);
    const warehouseId = normalizeGoodsReceivedWarehouseId(input);
    return {
        entryMode: input.entryMode,
        items: input.items.map((item) => {
            const itemId = normalizeGoodsReceivedItemId(item);
            const unitOfMeasureId = normalizeGoodsReceivedUnitOfMeasureId(item);
            const poItemId = String(item.po_item_id ?? item.poItemId ?? '').trim();
            return {
                batchNumber: item.batchNumber ?? null,
                expiryDate: item.expiryDate ?? null,
                itemId,
                item_id: itemId,
                overReceiveReason: item.reason ?? null,
                poItemId: poItemId || null,
                po_item_id: poItemId || null,
                qualityNotes: item.qualityNotes ?? null,
                quantityExpected: item.quantityExpected,
                quantityReceived: item.quantityReceived,
                quantityRejected: item.quantityRejected,
                unitCost: item.unitCost,
                unitOfMeasureId,
                unit_of_measure_id: unitOfMeasureId,
                uomId: unitOfMeasureId,
                uom_id: unitOfMeasureId,
            };
        }),
        notes: input.notes ?? null,
        purchaseOrderId: purchaseOrderId || null,
        purchase_order_id: purchaseOrderId || null,
        qualityNotes: input.qualityNotes ?? null,
        supplierId: supplierId || null,
        supplier_id: supplierId || null,
        warehouseId: warehouseId || null,
        warehouse_id: warehouseId || null,
        receivingWarehouseId: warehouseId || null,
        receiving_warehouse_id: warehouseId || null,
    };
}
