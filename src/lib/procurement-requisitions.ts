export function normalizeRequisitionItemId(input: {
  itemId?: unknown;
  item_id?: unknown;
}) {
  const itemId = [input.item_id, input.itemId]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return itemId ?? '';
}

interface RequisitionDraftPayloadInput {
  approverUserId?: string | null;
  department: string;
  items: Array<{
    estimatedUnitCost?: number | null;
    itemId?: string | null;
    item_id?: string | null;
    quantityRequested: number;
    remarks?: string | null;
    unitOfMeasureId: string;
  }>;
  neededByDate?: string | null;
  remarks?: string | null;
}

export function buildRequisitionDraftPayload(input: RequisitionDraftPayloadInput) {
  return {
    approverUserId: input.approverUserId ?? null,
    department: input.department,
    items: input.items.map((item) => {
      const itemId = normalizeRequisitionItemId(item);

      return {
        estimatedUnitCost: item.estimatedUnitCost ?? null,
        itemId,
        item_id: itemId,
        quantityRequested: item.quantityRequested,
        remarks: item.remarks ?? null,
        unitOfMeasureId: item.unitOfMeasureId,
      };
    }),
    neededByDate: input.neededByDate ?? null,
    remarks: input.remarks ?? null,
  };
}
