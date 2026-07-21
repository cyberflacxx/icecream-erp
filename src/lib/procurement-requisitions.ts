export function normalizeRequisitionItemId(input: {
  itemId?: unknown;
  item_id?: unknown;
}) {
  const itemId = [input.item_id, input.itemId]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return itemId ?? '';
}

export function normalizeRequisitionUnitOfMeasureId(input: {
  unitOfMeasureId?: unknown;
  unit_of_measure_id?: unknown;
  uomId?: unknown;
  uom_id?: unknown;
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

export interface RequisitionDetailLookupCandidate {
  column: 'id' | 'purchase_requisition_id' | 'requisition_id' | 'requisition_number';
  value: string;
}

export function isUuidLikeRequisitionIdentifier(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? '').trim());
}

export function buildRequisitionDetailLookupCandidates(value: unknown): RequisitionDetailLookupCandidate[] {
  const normalized = String(value ?? '').trim();
  if (!normalized) return [];

  if (isUuidLikeRequisitionIdentifier(normalized)) {
    return [
      { column: 'id', value: normalized },
      { column: 'requisition_id', value: normalized },
      { column: 'purchase_requisition_id', value: normalized },
    ];
  }

  return [
    { column: 'id', value: normalized },
    { column: 'requisition_number', value: normalized },
  ];
}

function firstFiniteNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

export function buildRequisitionDetailItem(
  input: Record<string, unknown>,
  related?: {
    item?: Record<string, unknown> | null;
    unit?: Record<string, unknown> | null;
  },
) {
  const row = input ?? {};
  const item = related?.item ?? null;
  const unit = related?.unit ?? null;
  const id = String(row.id ?? row.requisition_item_id ?? '').trim();
  const requisitionItemId = String(row.requisition_item_id ?? row.id ?? '').trim();
  const itemId = String(row.item_id ?? row.itemId ?? item?.id ?? '').trim();
  const itemCode = String(row.item_code ?? row.itemCode ?? item?.code ?? '').trim() || null;
  const itemName = String(row.item_name ?? row.itemName ?? item?.name ?? '').trim() || null;
  const description = String(
    row.description ??
      row.specification ??
      row.remarks ??
      row.notes ??
      item?.description ??
      item?.name ??
      '',
  ).trim();
  const specification = String(
    row.specification ??
      row.description ??
      row.remarks ??
      row.notes ??
      item?.description ??
      item?.name ??
      '',
  ).trim();
  const quantity = firstFiniteNumber(row.quantity, row.qty, row.quantity_requested, row.quantityRequested, row.quantity_approved, row.quantityApproved);
  const unitOfMeasureId = String(
    row.unit_of_measure_id ??
      row.unitOfMeasureId ??
      row.uom_id ??
      row.uomId ??
      unit?.id ??
      '',
  ).trim() || null;
  const unitOfMeasureName = String(row.unit_of_measure_name ?? row.unitOfMeasureName ?? unit?.name ?? '').trim() || null;
  const uomName = String(row.uomName ?? row.unit_of_measure_name ?? unit?.abbreviation ?? unit?.name ?? '').trim() || null;
  const unitPrice = firstFiniteNumber(
    row.unit_price,
    row.unitPrice,
    row.estimated_unit_cost,
    row.estimatedUnitCost,
    row.estimated_cost,
    row.estimatedCost,
    item?.purchase_price,
    item?.purchasePrice,
    item?.cost_price,
    item?.costPrice,
    item?.unit_cost,
    item?.unitCost,
    item?.standard_cost,
    item?.standardCost,
    item?.default_purchase_price,
    item?.defaultPurchasePrice,
    item?.price,
    item?.selling_price,
    item?.sellingPrice,
  );
  const taxRate = firstFiniteNumber(row.tax_rate, row.taxRate);

  return {
    id,
    requisition_item_id: requisitionItemId || id,
    requisitionItemId: requisitionItemId || id,
    item_id: itemId,
    itemId,
    item_code: itemCode,
    itemCode,
    item_name: itemName,
    itemName,
    description,
    specification,
    quantity,
    qty: quantity,
    unit_of_measure_id: unitOfMeasureId,
    unitOfMeasureId: unitOfMeasureId,
    uom_id: unitOfMeasureId,
    uomId: unitOfMeasureId,
    unit_of_measure_name: unitOfMeasureName,
    unitOfMeasureName,
    uomName,
    unit_price: unitPrice,
    unitPrice: unitPrice,
    tax_rate: taxRate,
    taxRate,
  };
}

interface RequisitionDraftPayloadInput {
  approverUserId?: string | null;
  approverEmail?: string | null;
  approverName?: string | null;
  approvalNotes?: string | null;
  department: string;
  items: Array<{
    estimatedUnitCost?: number | null;
    itemId?: string | null;
    item_id?: string | null;
    quantityRequested: number;
    remarks?: string | null;
    unitOfMeasureId?: string | null;
    unit_of_measure_id?: string | null;
    uomId?: string | null;
    uom_id?: string | null;
    uom?: string | null;
  }>;
  neededByDate?: string | null;
  remarks?: string | null;
}

export function buildRequisitionDraftPayload(input: RequisitionDraftPayloadInput) {
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
