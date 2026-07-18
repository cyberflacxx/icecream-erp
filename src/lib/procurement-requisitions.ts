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
