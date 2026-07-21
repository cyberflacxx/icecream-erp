type RawStatus = 'approved' | 'cancelled' | 'draft' | 'sent_to_supplier';

const APPROVED_REQUISITION_STATUSES = [
  'APPROVED',
  'APPROVED_FOR_PO',
  'OPEN',
  'LEVEL1_APPROVED',
  'LEVEL2_APPROVED',
  'PENDING_APPROVAL',
  'SUBMITTED',
] as const;

const STATUS_LABELS: Record<string, string> = {
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

export function normalizePurchaseOrderStatus(status: unknown) {
  return String(status ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase();
}

export function isApprovedRequisitionStatus(status: unknown, approvalStatus?: unknown) {
  const candidates = [status, approvalStatus].map(normalizePurchaseOrderStatus);
  return candidates.some((value) =>
    APPROVED_REQUISITION_STATUSES.includes(value as (typeof APPROVED_REQUISITION_STATUSES)[number]),
  );
}

export function derivePurchaseOrderStatus(input: {
  rejectedAt?: unknown;
  sentAt?: unknown;
  status?: unknown;
}) {
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

export function formatPurchaseOrderStatusLabel(status: unknown) {
  const normalized = normalizePurchaseOrderStatus(status);
  return STATUS_LABELS[normalized] ?? (normalized.replace(/_/g, ' ').trim() || 'Draft');
}

export function formatPurchaseOrderDbStatus(target: RawStatus, sampleStatus: unknown) {
  const useUppercase = String(sampleStatus ?? '') === String(sampleStatus ?? '').toUpperCase();
  const nextStatus = useUppercase ? target.toUpperCase() : target;
  return nextStatus;
}

export function isPurchaseOrderSentLike(status: unknown) {
  const normalized = normalizePurchaseOrderStatus(status);
  return (
    normalized === 'APPROVED' ||
    normalized === 'CREATED' ||
    normalized === 'DRAFT' ||
    normalized === 'OPEN' ||
    normalized === 'SUBMITTED' ||
    normalized === 'SENT' ||
    normalized === 'SENT_TO_SUPPLIER' ||
    normalized === 'PARTIAL_RECEIVED' ||
    normalized === 'PARTIALLY_RECEIVED'
  );
}

export function isPurchaseOrderRejectable(status: unknown) {
  const normalized = normalizePurchaseOrderStatus(status);
  return normalized === 'DRAFT' || normalized === 'APPROVED';
}

export function isPurchaseOrderApprovable(status: unknown) {
  return normalizePurchaseOrderStatus(status) === 'DRAFT';
}

export function normalizePurchaseOrderSupplierId(input: {
  supplierId?: unknown;
  supplier_id?: unknown;
}) {
  const supplierId = [input.supplier_id, input.supplierId]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return supplierId ?? '';
}

export function normalizePurchaseOrderRequisitionId(input: {
  requisitionId?: unknown;
  requisition_id?: unknown;
}) {
  const requisitionId = [input.requisition_id, input.requisitionId]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return requisitionId ?? '';
}

export function normalizePurchaseOrderItemId(input: {
  itemId?: unknown;
  item_id?: unknown;
}) {
  const itemId = [input.item_id, input.itemId]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return itemId ?? '';
}

export function normalizePurchaseOrderUnitOfMeasureId(input: {
  unitOfMeasureId?: unknown;
  unit_of_measure_id?: unknown;
  uomId?: unknown;
  uom_id?: unknown;
}) {
  const unitOfMeasureId = [input.unit_of_measure_id, input.unitOfMeasureId, input.uom_id, input.uomId]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);

  return unitOfMeasureId ?? '';
}

export function normalizePurchaseOrderUnitPrice(input: {
  cost?: unknown;
  unitCost?: unknown;
  unit_cost?: unknown;
  unitPrice?: unknown;
  unit_price?: unknown;
  price?: unknown;
}) {
  const rawValue = [
    input.unit_price,
    input.unitPrice,
    input.cost,
    input.unit_cost,
    input.unitCost,
    input.price,
  ].find((value) => value !== undefined && value !== null && String(value).trim() !== '');

  const parsed = Number(rawValue ?? 0);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function normalizePurchaseOrderQuantity(input: {
  quantityOrdered?: unknown;
  quantity_ordered?: unknown;
  quantity?: unknown;
  qty?: unknown;
}) {
  const rawValue = [input.quantity, input.qty, input.quantity_ordered, input.quantityOrdered]
    .find((value) => value !== undefined && value !== null && String(value).trim() !== '');

  const parsed = Number(rawValue ?? 0);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function resolvePurchaseOrderItemUnitPrice(input: Record<string, unknown> | null | undefined) {
  const raw = input ?? {};
  const priceFields = [
    raw.unit_price,
    raw.unitPrice,
    raw.purchase_price,
    raw.purchasePrice,
    raw.cost_price,
    raw.costPrice,
    raw.unit_cost,
    raw.unitCost,
    raw.standard_cost,
    raw.standardCost,
    raw.default_purchase_price,
    raw.defaultPurchasePrice,
    raw.price,
    raw.selling_price,
    raw.sellingPrice,
  ];

  for (const value of priceFields) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function resolvePurchaseOrderItemUnitOfMeasureId(input: Record<string, unknown> | null | undefined) {
  const raw = input ?? {};
  const aliases = [raw.unit_of_measure_id, raw.unitOfMeasureId, raw.uom_id, raw.uomId];
  for (const value of aliases) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return null;
}

export function resolvePurchaseOrderItemDescription(input: Record<string, unknown> | null | undefined) {
  const raw = input ?? {};
  const aliases = [
    raw.description,
    raw.item_description,
    raw.itemDescription,
    raw.specification,
    raw.name,
    raw.item_name,
    raw.itemName,
  ];
  for (const value of aliases) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

export function normalizePurchaseOrderTaxRate(input: {
  taxRate?: unknown;
  tax_rate?: unknown;
}) {
  const rawValue = [input.tax_rate, input.taxRate]
    .find((value) => value !== undefined && value !== null && String(value).trim() !== '');

  const parsed = Number(rawValue ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizePurchaseOrderLineTotal(input: {
  lineTotal?: unknown;
  line_total?: unknown;
}) {
  const rawValue = [input.line_total, input.lineTotal]
    .find((value) => value !== undefined && value !== null && String(value).trim() !== '');

  const parsed = Number(rawValue ?? NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface NormalizedRequisitionLineItem {
  description: string;
  id: string;
  item_code: string | null;
  itemCode: string | null;
  item_id: string;
  itemId: string;
  item_name: string | null;
  itemName: string | null;
  quantity: number;
  qty: number;
  requisition_item_id: string;
  requisitionItemId: string;
  specification: string;
  tax_rate: number;
  taxRate: number;
  unit_of_measure_id: string | null;
  unitOfMeasureId: string | null;
  unit_of_measure_name: string | null;
  uom_id: string | null;
  uomId: string | null;
  uomName: string | null;
  unit_price: number;
  unitPrice: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstArray(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function normalizeRequisitionLineItem(input: unknown): NormalizedRequisitionLineItem | null {
  const row = asRecord(input);
  if (!row) return null;

  const nestedItem = asRecord(row.items) ?? asRecord(row.item);
  const nestedUnit = asRecord(row.units_of_measure) ?? asRecord(row.unitOfMeasure) ?? asRecord(row.uom);
  const id = String(row.id ?? row.requisition_item_id ?? row.requisitionItemId ?? '').trim();
  const requisitionItemId = String(row.requisition_item_id ?? row.requisitionItemId ?? id).trim();
  const itemId = String(row.item_id ?? row.itemId ?? nestedItem?.id ?? '').trim();
  const itemCode = String(row.item_code ?? row.itemCode ?? nestedItem?.code ?? '').trim() || null;
  const itemName = String(row.item_name ?? row.itemName ?? nestedItem?.name ?? '').trim() || null;
  const quantity = normalizePurchaseOrderQuantity({
    quantity: row.quantity ?? row.quantity_requested ?? row.quantityApproved,
    quantity_ordered: row.quantity_approved ?? row.quantityApproved,
    quantityOrdered: row.quantityRequested,
    qty: row.qty,
  });
  const unitOfMeasureId = String(
    row.unit_of_measure_id ??
      row.unitOfMeasureId ??
      row.uom_id ??
      row.uomId ??
      nestedUnit?.id ??
      '',
  ).trim() || null;
  const uomName = String(
    row.unit_of_measure_name ??
      row.unitOfMeasureName ??
      row.uomName ??
      nestedUnit?.abbreviation ??
      nestedUnit?.name ??
      '',
  ).trim() || null;
  const unitPrice = resolvePurchaseOrderItemUnitPrice({
    ...row,
    purchase_price: row.unit_price ?? row.purchase_price ?? nestedItem?.purchase_price,
    purchasePrice: row.unitPrice ?? row.purchasePrice ?? nestedItem?.purchasePrice,
    cost_price: row.estimated_unit_cost ?? row.cost_price ?? nestedItem?.cost_price,
    unit_cost: row.unit_cost ?? nestedItem?.unit_cost,
    standard_cost: row.standard_cost ?? nestedItem?.standard_cost,
    default_purchase_price: row.default_purchase_price ?? nestedItem?.default_purchase_price,
    price: row.price ?? nestedItem?.price,
    selling_price: row.selling_price ?? nestedItem?.selling_price,
  });
  const description = resolvePurchaseOrderItemDescription({
    ...row,
    description: row.description ?? nestedItem?.description,
    name: itemName,
  });
  const specification = String(row.specification ?? row.remarks ?? '').trim();

  return {
    description,
    id,
    item_code: itemCode,
    itemCode,
    item_id: itemId,
    itemId,
    item_name: itemName,
    itemName,
    quantity,
    qty: quantity,
    requisition_item_id: requisitionItemId,
    requisitionItemId,
    specification,
    tax_rate: normalizePurchaseOrderTaxRate(row),
    taxRate: normalizePurchaseOrderTaxRate(row),
    unit_of_measure_id: unitOfMeasureId,
    unitOfMeasureId: unitOfMeasureId,
    unit_of_measure_name: uomName,
    uom_id: unitOfMeasureId,
    uomId: unitOfMeasureId,
    uomName,
    unit_price: unitPrice,
    unitPrice,
  };
}

export function extractRequisitionLineItems(input: unknown) {
  const container = asRecord(input);
  const data = asRecord(container?.data) ?? container;
  const source = firstArray(
    data?.items,
    data?.line_items,
    data?.lineItems,
    data?.requisition_items,
    data?.requisitionItems,
    data?.purchase_requisition_items,
  );

  return source
    .map(normalizeRequisitionLineItem)
    .filter((item): item is NormalizedRequisitionLineItem => Boolean(item));
}

export function mapRequisitionItemToPurchaseOrderLine(input: unknown) {
  const item = normalizeRequisitionLineItem(input);
  if (!item) return null;

  return {
    description: item.description,
    itemCode: item.itemCode,
    itemId: item.itemId,
    itemName: item.itemName,
    quantityOrdered: String(item.quantity || 1),
    requisitionItemId: item.requisitionItemId,
    rowId: item.requisitionItemId || item.id || `req-line-${item.itemId}`,
    specification: item.specification,
    taxRate: String(item.taxRate),
    unitCost: String(item.unitPrice),
    unitOfMeasureId: item.unitOfMeasureId ?? '',
    unitOfMeasureName: item.uomName,
  };
}

interface PurchaseOrderDraftPayloadInput {
  approverEmail?: string | null;
  approverName?: string | null;
  approverUserId?: string | null;
  approvalNotes?: string | null;
  discountAmount: number;
  expectedDeliveryDate?: string | null;
  items: Array<{
    description?: string | null;
    itemId?: string | null;
    item_id?: string | null;
    quantityOrdered?: number;
    quantity_ordered?: number;
    quantity?: number;
    qty?: number;
    unitCost?: number;
    unit_cost?: number;
    unitPrice?: number;
    unit_price?: number;
    price?: number;
    cost?: number;
    taxRate?: number;
    tax_rate?: number;
    lineTotal?: number;
    line_total?: number;
    unitOfMeasureId?: string | null;
    unit_of_measure_id?: string | null;
    uomId?: string | null;
    uom_id?: string | null;
    requisitionItemId?: string | null;
    requisition_item_id?: string | null;
  }>;
  notes?: string | null;
  orderDate?: string | null;
  requisitionId?: string | null;
  requisition_id?: string | null;
  supplierId?: string | null;
  supplier_id?: string | null;
  taxAmount: number;
}

export function buildPurchaseOrderDraftPayload(input: PurchaseOrderDraftPayloadInput) {
  const supplierId = normalizePurchaseOrderSupplierId(input);
  const requisitionId = normalizePurchaseOrderRequisitionId(input);

  return {
    approverEmail: input.approverEmail?.trim() || null,
    approverName: input.approverName?.trim() || null,
    approverUserId: input.approverUserId ?? null,
    approvalNotes: input.approvalNotes?.trim() || null,
    discountAmount: input.discountAmount,
    expectedDeliveryDate: input.expectedDeliveryDate ?? null,
    items: input.items.map((item) => {
      const itemId = normalizePurchaseOrderItemId(item);
      const unitOfMeasureId = normalizePurchaseOrderUnitOfMeasureId(item);
      const quantityOrdered = normalizePurchaseOrderQuantity(item);
      const unitPrice = normalizePurchaseOrderUnitPrice(item);

      return {
        itemId,
        item_id: itemId,
        description: item.description ?? null,
        lineTotal: normalizePurchaseOrderLineTotal(item),
        line_total: normalizePurchaseOrderLineTotal(item),
        quantity: quantityOrdered,
        quantityOrdered,
        quantity_ordered: quantityOrdered,
        qty: quantityOrdered,
        requisitionItemId: item.requisitionItemId ?? item.requisition_item_id ?? null,
        requisition_item_id: item.requisitionItemId ?? item.requisition_item_id ?? null,
        taxRate: normalizePurchaseOrderTaxRate(item),
        tax_rate: normalizePurchaseOrderTaxRate(item),
        unitCost: unitPrice,
        unitPrice,
        unit_cost: unitPrice,
        unit_price: unitPrice,
        unitOfMeasureId: unitOfMeasureId || null,
        unit_of_measure_id: unitOfMeasureId || null,
        uomId: unitOfMeasureId || null,
        uom_id: unitOfMeasureId || null,
      };
    }),
    notes: input.notes ?? null,
    orderDate: input.orderDate ?? null,
    requisitionId: requisitionId || null,
    requisition_id: requisitionId || null,
    supplierId,
    supplier_id: supplierId,
    taxAmount: input.taxAmount,
  };
}
