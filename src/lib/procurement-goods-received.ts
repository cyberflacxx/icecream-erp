export function normalizeGoodsReceivedPurchaseOrderId(input: {
  purchase_order_id?: unknown;
  purchaseOrderId?: unknown;
  po_id?: unknown;
  poId?: unknown;
}) {
  const purchaseOrderId = [input.purchase_order_id, input.purchaseOrderId, input.po_id, input.poId]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return purchaseOrderId ?? '';
}

export function normalizeGoodsReceivedSupplierId(input: {
  supplier_id?: unknown;
  supplierId?: unknown;
}) {
  const supplierId = [input.supplier_id, input.supplierId]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return supplierId ?? '';
}

export function normalizeGoodsReceivedItemId(input: {
  item_id?: unknown;
  itemId?: unknown;
  product_id?: unknown;
  productId?: unknown;
  raw_material_id?: unknown;
  rawMaterialId?: unknown;
}) {
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

export function normalizeGoodsReceivedUnitOfMeasureId(input: {
  unit_of_measure_id?: unknown;
  unitOfMeasureId?: unknown;
  uom_id?: unknown;
  uomId?: unknown;
  uom?: unknown;
}) {
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

interface GoodsReceivedDraftPayloadInput {
  entryMode: string;
  items: Array<{
    batchNumber?: string | null;
    expiryDate?: string | null;
    itemId?: string | null;
    item_id?: string | null;
    poItemId?: string | null;
    po_item_id?: string | null;
    qualityNotes?: string | null;
    quantityExpected: number;
    quantityReceived: number;
    quantityRejected: number;
    reason?: string | null;
    unitCost: number;
    unitOfMeasureId?: string | null;
    unit_of_measure_id?: string | null;
    uomId?: string | null;
    uom_id?: string | null;
    uom?: string | null;
  }>;
  notes?: string | null;
  purchaseOrderId?: string | null;
  purchase_order_id?: string | null;
  qualityNotes?: string | null;
  supplierId?: string | null;
  supplier_id?: string | null;
  warehouseId: string;
}

export function buildGoodsReceivedDraftPayload(input: GoodsReceivedDraftPayloadInput) {
  const purchaseOrderId = normalizeGoodsReceivedPurchaseOrderId(input);
  const supplierId = normalizeGoodsReceivedSupplierId(input);

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
    warehouseId: input.warehouseId,
  };
}
