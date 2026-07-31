import { getErrorMessage, isMissingColumnError } from './postgrest-compat';

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

type ServiceLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          in: (column: string, values: string[]) => Promise<{ data?: unknown[] | null; error?: unknown }>;
        };
        in: (column: string, values: string[]) => Promise<{ data?: unknown[] | null; error?: unknown }>;
      };
      in: (column: string, values: string[]) => Promise<{ data?: unknown[] | null; error?: unknown }>;
    };
  };
};

const SAFE_ITEM_SELECT_LEVELS = [
  ['id', 'code', 'name', 'description', 'unit_of_measure_id'],
  ['id', 'item_code', 'item_name', 'description'],
  ['id', 'code', 'name'],
  ['id'],
] as const;

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

function mapSafeItemMetadata(row: Record<string, unknown>) {
  const id = String(row.id ?? '').trim();
  const code = String(row.code ?? row.item_code ?? '').trim() || null;
  const name = String(row.name ?? row.item_name ?? '').trim() || null;
  const description = String(row.description ?? name ?? '').trim() || '';
  const unitOfMeasureId = String(row.unit_of_measure_id ?? row.uom_id ?? '').trim() || null;

  return {
    code,
    description,
    id,
    item_code: code,
    item_name: name,
    itemCode: code,
    itemName: name,
    name,
    unit_of_measure_id: unitOfMeasureId,
    unitOfMeasureId,
    uom_id: unitOfMeasureId,
    uomId: unitOfMeasureId,
  };
}

export async function safeSelectItemsByIds(
  service: ServiceLike,
  itemIds: string[],
  organizationId?: string | null,
) {
  if (!itemIds.length) {
    return new Map<string, Record<string, unknown>>();
  }

  const uniqueIds = [...new Set(itemIds.map((value) => String(value ?? '').trim()).filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map<string, Record<string, unknown>>();
  }

  for (const columns of SAFE_ITEM_SELECT_LEVELS) {
    const selectClause = columns.join(', ');
    let response: { data?: unknown[] | null; error?: unknown };

    if (organizationId) {
      response = await service
        .from('items')
        .select(selectClause)
        .eq('organization_id', organizationId)
        .in('id', uniqueIds);
    } else {
      response = await service
        .from('items')
        .select(selectClause)
        .in('id', uniqueIds);
    }

    if (!response.error) {
      return new Map(
        ((response.data ?? []) as Record<string, unknown>[])
          .map((row) => mapSafeItemMetadata(row))
          .filter((row) => row.id)
          .map((row) => [row.id, row]),
      );
    }

    const missingSelectedColumn = columns.find((column) => isMissingColumnError(response.error, 'items', column));
    if (missingSelectedColumn) {
      console.warn('Procurement requisition item metadata fallback.', {
        table: 'items',
        missingColumn: missingSelectedColumn,
        attemptedSelect: selectClause,
      });
      continue;
    }

    if (organizationId && isMissingColumnError(response.error, 'items', 'organization_id')) {
      console.warn('Procurement requisition item metadata fallback.', {
        table: 'items',
        missingColumn: 'organization_id',
        attemptedSelect: selectClause,
      });
      return safeSelectItemsByIds(service, uniqueIds, null);
    }

    console.warn('Procurement requisition item metadata lookup failed.', {
      itemCount: uniqueIds.length,
      message: getErrorMessage(response.error),
      table: 'items',
    });
    return new Map<string, Record<string, unknown>>();
  }

  return new Map<string, Record<string, unknown>>();
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
  const quantityRequested = firstFiniteNumber(row.quantity_requested, row.quantityRequested, row.quantity, row.qty);
  const quantityApproved = firstFiniteNumber(row.quantity_approved, row.quantityApproved, quantityRequested);
  const quantity = quantityApproved || quantityRequested;
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
    quantity_approved: quantityApproved,
    quantityApproved,
    quantity_requested: quantityRequested,
    quantityRequested,
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
