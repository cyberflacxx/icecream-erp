import { applyInventoryDelta, recordStockMovement } from './inventory-server';

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

export function normalizeGoodsReceivedWarehouseId(input: {
  warehouse_id?: unknown;
  warehouseId?: unknown;
  receiving_warehouse_id?: unknown;
  receivingWarehouseId?: unknown;
  destination_warehouse_id?: unknown;
  destinationWarehouseId?: unknown;
}) {
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
  warehouse_id?: string | null;
  warehouseId?: string | null;
  receiving_warehouse_id?: string | null;
  receivingWarehouseId?: string | null;
  destination_warehouse_id?: string | null;
  destinationWarehouseId?: string | null;
}

export function buildGoodsReceivedDraftPayload(input: GoodsReceivedDraftPayloadInput) {
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

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '');
  return '';
}

function isMissingColumnError(error: unknown, table: string, columnName: string) {
  return getErrorMessage(error).includes(`column ${table}.${columnName} does not exist`);
}

export async function postGoodsReceivedNoteToInventory(
  service: {
    from: (table: string) => any;
  },
  input: {
    grnId: string;
    organizationId: string;
    userId: string;
  },
) {
  const primary = await service
    .from('goods_received_notes')
    .select('id, grn_number, status, quality_status, warehouse_id, receiving_warehouse_id, purchase_order_id, po_id, notes, approval_notes, stock_posted')
    .eq('organization_id', input.organizationId)
    .eq('id', input.grnId)
    .maybeSingle();

  const grn =
    primary.error && isMissingColumnError(primary.error, 'goods_received_notes', 'purchase_order_id')
      ? (
          await service
            .from('goods_received_notes')
            .select('id, grn_number, status, quality_status, warehouse_id, po_id, notes, approval_notes')
            .eq('organization_id', input.organizationId)
            .eq('id', input.grnId)
            .maybeSingle()
        ).data
      : primary.data;

  if (!grn) {
    throw new Error('Goods received note not found.');
  }

  const warehouseId = String(grn.receiving_warehouse_id ?? grn.warehouse_id ?? '').trim();
  if (!warehouseId) {
    throw new Error('Please select a receiving warehouse before posting GRN.');
  }

  if (grn.stock_posted === true || String(grn.status ?? '').toUpperCase() === 'POSTED') {
    throw new Error('GRN has already been posted to stock.');
  }

  const existingMovement = await service
    .from('stock_movements')
    .select('id')
    .or(`reference_id.eq.${input.grnId},source_document_id.eq.${input.grnId}`)
    .limit(1);

  if (!existingMovement.error && (existingMovement.data ?? []).length > 0) {
    await service
      .from('goods_received_notes')
      .update({
        posted_at: new Date().toISOString(),
        posted_by: input.userId,
        stock_posted: true,
      })
      .eq('id', input.grnId);
    throw new Error('GRN has already been posted to stock.');
  }

  const itemsPrimary = await service
    .from('goods_received_note_items')
    .select('id, item_id, purchase_order_item_id, po_item_id, quantity_ordered, quantity_expected, quantity_received, quantity_rejected, unit_cost, warehouse_id, batch_number')
    .eq('grn_id', input.grnId);

  const items =
    itemsPrimary.error && getErrorMessage(itemsPrimary.error).includes('goods_received_note_items')
      ? (
          await service
            .from('grn_items')
            .select('id, item_id, po_item_id, ordered_qty, received_qty, rejected_qty, unit_cost, warehouse_id, batch_number')
            .eq('grn_id', input.grnId)
        ).data?.map((item: Record<string, unknown>) => ({
          ...item,
          purchase_order_item_id: item.po_item_id,
          quantity_ordered: item.ordered_qty,
          quantity_received: item.received_qty,
          quantity_rejected: item.rejected_qty,
        }))
      : itemsPrimary.data;

  if (!items || items.length === 0) {
    throw new Error('Goods received note could not update inventory. Please check warehouse and item details.');
  }

  const purchaseOrderItemIds = [
    ...new Set(
      (items as Array<Record<string, unknown>>)
        .map((item) => String(item.purchase_order_item_id ?? item.po_item_id ?? '').trim())
        .filter(Boolean),
    ),
  ];
  const itemIds = [
    ...new Set(
      (items as Array<Record<string, unknown>>)
        .map((item) => String(item.item_id ?? '').trim())
        .filter(Boolean),
    ),
  ];
  const poItemRows = purchaseOrderItemIds.length
    ? await service
        .from('purchase_order_items')
        .select('id, unit_price, unit_cost')
        .in('id', purchaseOrderItemIds)
    : { data: [], error: null };
  const itemRows = itemIds.length
    ? await service
        .from('items')
        .select('id, purchase_price, cost_price, unit_cost, standard_cost, default_purchase_price, price, selling_price')
        .in('id', itemIds)
    : { data: [], error: null };
  const poItemsById = new Map(
    (poItemRows.error ? [] : poItemRows.data ?? []).map((item: Record<string, unknown>) => [String(item.id), item]),
  );
  const itemsById = new Map(
    (itemRows.error ? [] : itemRows.data ?? []).map((item: Record<string, unknown>) => [String(item.id), item]),
  );
  let inventoryValuePosted = 0;

  for (const rawItem of items as Array<Record<string, unknown>>) {
    const itemId = String(rawItem.item_id ?? '').trim();
    if (!itemId) continue;
    const quantityReceived = toNumber(rawItem.quantity_received);
    const quantityRejected = toNumber(rawItem.quantity_rejected);
    const quantity = Math.max(0, quantityReceived - quantityRejected);
    if (quantity <= 0) continue;

    const purchaseOrderItemId = String(rawItem.purchase_order_item_id ?? rawItem.po_item_id ?? '').trim();
    const poItem = (purchaseOrderItemId ? poItemsById.get(purchaseOrderItemId) : null) as Record<string, unknown> | null;
    const itemMaster = itemsById.get(itemId) as Record<string, unknown> | undefined;
    const unitCost = toNumber(
      rawItem.unit_cost ??
        poItem?.unit_price ??
        poItem?.unit_cost ??
        itemMaster?.purchase_price ??
        itemMaster?.cost_price ??
        itemMaster?.unit_cost ??
        itemMaster?.standard_cost ??
        itemMaster?.default_purchase_price ??
        itemMaster?.price ??
        itemMaster?.selling_price ??
        0,
    );
    inventoryValuePosted += quantity * unitCost;
    const lineWarehouseId = String(rawItem.warehouse_id ?? warehouseId).trim() || warehouseId;

    await applyInventoryDelta(service, {
      itemId,
      organizationId: input.organizationId,
      quantityDelta: quantity,
      unitCost,
      warehouseId: lineWarehouseId,
    });

    await recordStockMovement(service, {
      batchNumber: rawItem.batch_number ? String(rawItem.batch_number) : null,
      createdBy: input.userId,
      itemId,
      movementType: 'GRN_RECEIPT',
      notes: String(grn.notes ?? grn.approval_notes ?? ''),
      organizationId: input.organizationId,
      quantity,
      referenceId: input.grnId,
      referenceType: 'goods_received_note',
      unitCost,
      warehouseId: lineWarehouseId,
    });

    if (purchaseOrderItemId) {
      const poItemResult = await service
        .from('purchase_order_items')
        .select('id, quantity_received')
        .eq('id', purchaseOrderItemId)
        .maybeSingle();
      if (!poItemResult.error && poItemResult.data) {
        await service
          .from('purchase_order_items')
          .update({
            quantity_received: toNumber(poItemResult.data.quantity_received) + quantity,
          })
          .eq('id', purchaseOrderItemId);
      }
    }
  }

  const purchaseOrderId = String(grn.purchase_order_id ?? grn.po_id ?? '').trim();
  if (purchaseOrderId) {
    const poItemsPrimary = await service
      .from('purchase_order_items')
      .select('quantity_ordered, quantity_received')
      .eq('purchase_order_id', purchaseOrderId);
    const poItems =
      poItemsPrimary.error && isMissingColumnError(poItemsPrimary.error, 'purchase_order_items', 'purchase_order_id')
        ? (
            await service
              .from('purchase_order_items')
              .select('quantity_ordered, received_qty')
              .eq('po_id', purchaseOrderId)
          ).data?.map((item: Record<string, unknown>) => ({
            ...item,
            quantity_received: item.received_qty,
          }))
        : poItemsPrimary.data;

    const allReceived = (poItems ?? []).length > 0 && (poItems ?? []).every((item: Record<string, unknown>) => toNumber(item.quantity_received) >= toNumber(item.quantity_ordered));
    const anyReceived = (poItems ?? []).some((item: Record<string, unknown>) => toNumber(item.quantity_received) > 0);
    await service
      .from('purchase_orders')
      .update({
        status: allReceived ? 'FULLY_RECEIVED' : anyReceived ? 'PARTIAL_RECEIVED' : 'APPROVED',
      })
      .eq('id', purchaseOrderId);
  }

  const postedAt = new Date().toISOString();
  let updatePayload: Record<string, unknown> = {
      approved_at: postedAt,
      approved_by: input.userId,
      posted_at: postedAt,
      posted_by: input.userId,
      inventory_value_posted: inventoryValuePosted,
      quality_status: 'APPROVED',
      status: 'POSTED',
      stock_posted: true,
    };
  let updateResult = await service
    .from('goods_received_notes')
    .update(updatePayload)
    .eq('id', input.grnId)
    .select()
    .single();

  if (updateResult.error && isMissingColumnError(updateResult.error, 'goods_received_notes', 'inventory_value_posted')) {
    updatePayload = { ...updatePayload };
    delete updatePayload.inventory_value_posted;
    updateResult = await service
      .from('goods_received_notes')
      .update(updatePayload)
      .eq('id', input.grnId)
      .select()
      .single();
  }

  if (updateResult.error || !updateResult.data) {
    throw new Error(updateResult.error?.message ?? 'Goods received note could not update inventory. Please check warehouse and item details.');
  }

  return updateResult.data;
}
