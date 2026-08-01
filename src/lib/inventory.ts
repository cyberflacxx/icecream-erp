export const INVENTORY_ITEM_TYPES = [
  'RAW_MATERIAL',
  'PACKAGING_MATERIAL',
  'FINISHED_GOOD',
  'WORK_IN_PROGRESS',
  'CONSUMABLE',
  'SPARE_PART',
] as const;

export const INVENTORY_WAREHOUSE_TYPES = [
  'MAIN',
  'BRANCH',
  'COLD_ROOM',
  'PRODUCTION',
  'WIP',
  'FINISHED_GOODS',
  'DISPATCH',
  'RETURNS',
  'DAMAGED',
  'RAW_MATERIALS',
  'GENERAL',
] as const;

export const DEFAULT_INVENTORY_WAREHOUSES = [
  {
    code: 'RAW_STORE',
    name: 'Raw Materials Store',
    warehouseType: 'RAW_MATERIALS',
  },
  {
    code: 'PROD_MATERIALS',
    name: 'Production Materials Store',
    warehouseType: 'PRODUCTION',
  },
  {
    code: 'PRODUCTION_FINISHED_GOODS',
    name: 'Production Finished Goods Warehouse',
    warehouseType: 'FINISHED_GOODS',
  },
  {
    code: 'FG_WAREHOUSE',
    name: 'Finished Goods Warehouse',
    warehouseType: 'FINISHED_GOODS',
  },
  {
    code: 'DISPATCH_WAREHOUSE',
    name: 'Dispatch Warehouse',
    warehouseType: 'DISPATCH',
  },
  {
    code: 'RETURNS_WAREHOUSE',
    name: 'Returns Warehouse',
    warehouseType: 'RETURNS',
  },
] as const;

export const STOCK_IN_MOVEMENT_TYPES = new Set([
  'OPENING_BALANCE',
  'PURCHASE_RECEIVE',
  'PURCHASE_RECEIPT',
  'PURCHASE_RETURN',
  'PRODUCTION_OUTPUT',
  'PRODUCTION_RECEIPT',
  'PRODUCTION_RETURN',
  'WIP_TRANSFER',
  'TRANSFER_IN',
  'BRANCH_TRANSFER_RECEIPT',
  'WAREHOUSE_TRANSFER_IN',
  'BRANCH_TRANSFER_IN',
  'GOODS_IN_TRANSIT',
  'RETURN_IN',
  'ADJUSTMENT_IN',
  'FINISHED_GOODS_RECEIPT',
  'CUSTOMER_RETURN',
  'STOCK_ADJUSTMENT_IN',
  'STOCK_ADJUSTMENT_GAIN',
  'COST_CORRECTION',
  'REVERSAL',
]);

export const STOCK_OUT_MOVEMENT_TYPES = new Set([
  'PRODUCTION_ISSUE',
  'PURCHASE_RETURN',
  'TRANSFER_OUT',
  'BRANCH_TRANSFER_DISPATCH',
  'WAREHOUSE_TRANSFER_OUT',
  'BRANCH_TRANSFER_OUT',
  'SALES_ISSUE',
  'SALES_DISPATCH',
  'ADJUSTMENT_OUT',
  'STOCK_ADJUSTMENT_OUT',
  'STOCK_ADJUSTMENT_LOSS',
  'DAMAGE',
  'DAMAGED_GOODS_TRANSFER',
  'WRITE_OFF',
  'EXPIRY_WRITE_OFF',
  'WASTAGE',
  'SPILLAGE',
  'MACHINE_LOSS',
  'PACKAGING_LOSS',
]);

const STOCK_MOVEMENT_TYPE_ALIASES: Record<string, string> = {
  BRANCH_TRANSFER_IN: 'TRANSFER_IN',
  BRANCH_TRANSFER_RECEIPT: 'TRANSFER_IN',
  BRANCH_TRANSFER_DISPATCH: 'TRANSFER_OUT',
  BRANCH_TRANSFER_OUT: 'TRANSFER_OUT',
  CUSTOMER_RETURN: 'RETURN_IN',
  FINISHED_GOODS_RECEIPT: 'PRODUCTION_OUTPUT',
  GRN_RECEIPT: 'PURCHASE_RECEIVE',
  GOODS_IN_TRANSIT_CLEARANCE: 'TRANSFER_IN',
  GOODS_IN_TRANSIT_DISPATCH: 'GOODS_IN_TRANSIT',
  PRODUCTION_RECEIPT: 'PRODUCTION_OUTPUT',
  PRODUCTION_RECEIVE: 'PRODUCTION_OUTPUT',
  PRODUCTION_RETURN: 'PRODUCTION_OUTPUT',
  PURCHASE_RECEIPT: 'PURCHASE_RECEIVE',
  SALES_DISPATCH: 'SALES_ISSUE',
  STOCK_ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  STOCK_ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
  WAREHOUSE_TRANSFER_IN: 'TRANSFER_IN',
  WAREHOUSE_TRANSFER_OUT: 'TRANSFER_OUT',
};

export const INVENTORY_PENDING_APPROVAL_STATUSES = [
  'PENDING',
  'PENDING_APPROVAL',
  'SUBMITTED',
  'AWAITING_APPROVAL',
] as const;

const INVENTORY_PENDING_APPROVAL_STATUS_SET = new Set<string>(
  INVENTORY_PENDING_APPROVAL_STATUSES,
);

export type SupplierShortageRow = {
  expectedResolutionDate: string | null;
  itemCode: string | null;
  itemId: string;
  itemName: string;
  orderedQuantity: number;
  poNumber: string;
  purchaseOrderId: string;
  receivedQuantity: number;
  shortageQuantity: number;
  status: 'OPEN' | 'RESOLVED';
  supplierId: string | null;
  supplierName: string;
};

export type InventoryAdjustmentFailure = {
  success: false;
  code: 'INVENTORY_ADJUSTMENT_FAILED';
  stage: string;
  details: {
    dbMessage: string | null;
    itemId: string | null;
    quantity: number | null;
    totalValue: number;
    unitCost: number;
    warehouseId: string | null;
  };
};

export type CsvRow = Record<string, string | number | boolean | null | undefined>;

export function toNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function resolveInventoryValue(
  row: Record<string, unknown> | null | undefined,
  fallback = 0,
) {
  if (!row) {
    return toNumber(fallback);
  }

  for (const candidate of [
    row.total_value,
    row.stock_value,
    row.inventory_value,
    row.inventory_value_posted,
    row.line_total,
    row.value,
    row.totalCost,
    row.totalValue,
    row.stockValue,
    row.total_cost,
  ]) {
    if (candidate !== null && candidate !== undefined && candidate !== '') {
      return toNumber(candidate, toNumber(fallback));
    }
  }

  return toNumber(fallback);
}

export function resolveInventoryUnitCost(
  row: Record<string, unknown> | null | undefined,
  fallback = 0,
) {
  if (!row) {
    return toNumber(fallback);
  }

  for (const candidate of [
    row.unit_cost,
    row.unitCost,
    row.cost,
    row.cost_price,
    row.standard_cost,
    row.standardCost,
  ]) {
    if (candidate !== null && candidate !== undefined && candidate !== '') {
      return toNumber(candidate, toNumber(fallback));
    }
  }

  return toNumber(fallback);
}

export function normalizeInventoryApprovalStatus(value: unknown) {
  return normalizeWarehouseCode(String(value ?? ''));
}

export function isPendingInventoryApprovalStatus(value: unknown) {
  return INVENTORY_PENDING_APPROVAL_STATUS_SET.has(normalizeInventoryApprovalStatus(value));
}

export function isProcessedInventoryApprovalStatus(value: unknown) {
  return ['APPROVED', 'REJECTED'].includes(normalizeInventoryApprovalStatus(value));
}

export function calculateStockBalanceValue(row: Record<string, unknown> | null | undefined) {
  if (!row) return 0;

  const item = asObject(row.items);
  const quantityOnHand = toNumber(row.quantity_on_hand ?? row.quantity);
  const unitCost = toNumber(
    row.average_cost ??
      row.avg_cost ??
      row.unit_cost ??
      row.unitCost ??
      item?.unit_cost ??
      item?.standard_cost,
  );

  return resolveInventoryValue(row, quantityOnHand * unitCost);
}

export function calculateTotalStockValue(
  rows: Array<Record<string, unknown>>,
  filter?: { organizationId?: string | null; warehouseIds?: string[] | null },
) {
  const allowedWarehouses = filter?.warehouseIds ? new Set(filter.warehouseIds) : null;

  return rows.reduce((sum, row) => {
    if (filter?.organizationId && String(row.organization_id ?? '') !== filter.organizationId) {
      return sum;
    }

    if (allowedWarehouses && !allowedWarehouses.has(String(row.warehouse_id ?? ''))) {
      return sum;
    }

    return sum + calculateStockBalanceValue(row);
  }, 0);
}

export function buildInventoryAdjustmentFailure(input: {
  dbMessage?: string | null;
  itemId?: string | null;
  quantity?: number | null;
  stage: string;
  totalValue?: number | null;
  unitCost?: number | null;
  warehouseId?: string | null;
}): InventoryAdjustmentFailure {
  return {
    success: false,
    code: 'INVENTORY_ADJUSTMENT_FAILED',
    stage: input.stage,
    details: {
      dbMessage: input.dbMessage ? String(input.dbMessage) : null,
      itemId: input.itemId ? String(input.itemId) : null,
      quantity: input.quantity == null ? null : toNumber(input.quantity),
      totalValue: toNumber(input.totalValue ?? 0),
      unitCost: toNumber(input.unitCost ?? 0),
      warehouseId: input.warehouseId ? String(input.warehouseId) : null,
    },
  };
}

export function getItemReorderQuantity(row: Record<string, unknown> | null | undefined) {
  return toNumber(row?.reorder_quantity ?? row?.reorder_qty, 0);
}

export function isMissingTableColumnError(error: unknown, table: string, column: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : String(error ?? '');

  return message.toLowerCase().includes(`column ${table}.${column} does not exist`);
}

export function ensurePositiveQuantity(quantity: unknown, field = 'quantity') {
  const parsed = toNumber(quantity, NaN);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${field} must be greater than zero.`);
  }

  return parsed;
}

export function ensureNonNegative(value: unknown, field: string) {
  const parsed = toNumber(value, NaN);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${field} must not be negative.`);
  }

  return parsed;
}

export function isInvoiceApprovedForDispatch(status: string | null | undefined) {
  if (!status) return false;

  return ['sent', 'partial_paid', 'paid'].includes(status.toLowerCase());
}

export function normalizeDate(value: string | null | undefined) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function normalizeStockMovementType(value: string | null | undefined) {
  const movementType = String(value ?? '').trim().toUpperCase();
  return STOCK_MOVEMENT_TYPE_ALIASES[movementType] ?? movementType;
}

export function normalizeWarehouseCode(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeWarehouseType(value: string | null | undefined) {
  const warehouseType = normalizeWarehouseCode(value);

  switch (warehouseType) {
    case 'RAW_STORE':
    case 'RAW_MATERIAL':
    case 'RAW_MATERIALS_STORE':
      return 'RAW_MATERIALS';
    case 'PROD_MATERIALS':
    case 'PRODUCTION_STORE':
    case 'PRODUCTION_MATERIAL':
    case 'PRODUCTION_MATERIALS':
    case 'PRODUCTION_MATERIALS_STORE':
    case 'PRODUCTION_WAREHOUSE':
      return 'PRODUCTION';
    case 'FG':
    case 'FG_STORE':
    case 'FG_WAREHOUSE':
    case 'PRODUCTION_FINISHED_GOODS':
      return 'FINISHED_GOODS';
    case 'DISPATCH_WAREHOUSE':
      return 'DISPATCH';
    case 'RETURNS_WAREHOUSE':
      return 'RETURNS';
    default:
      return warehouseType;
  }
}

export function resolveWarehouseStorageType(value: string | null | undefined) {
  const warehouseType = normalizeWarehouseType(value);

  switch (warehouseType) {
    case 'BRANCH':
    case 'COLD_ROOM':
    case 'MAIN':
      return warehouseType;
    default:
      return 'MAIN';
  }
}

export function resolveWarehouseDisplayType(input: {
  code?: string | null;
  type?: string | null;
  warehouseType?: string | null;
}) {
  const code = normalizeWarehouseCode(input.code);

  if (code === 'RAW_STORE') return 'RAW_MATERIALS';
  if (code === 'PROD_MATERIALS') return 'PRODUCTION';
  if (code === 'PRODUCTION_FINISHED_GOODS') return 'FINISHED_GOODS';
  if (code === 'FG_WAREHOUSE') return 'FINISHED_GOODS';
  if (code === 'DISPATCH_WAREHOUSE') return 'DISPATCH';
  if (code === 'RETURNS_WAREHOUSE') return 'RETURNS';

  return normalizeWarehouseType(input.warehouseType ?? input.type);
}

export function normalizeTransferStatus(value: string | null | undefined) {
  const status = normalizeWarehouseCode(value);
  return status === 'POSTED' ? 'COMPLETED' : status;
}

export function resolveTransferWriteStatus(value: string | null | undefined) {
  return normalizeTransferStatus(value);
}

export function calculateAcceptedQuantity(input: {
  damagedQuantity?: unknown;
  receivedQuantity: unknown;
  rejectedQuantity?: unknown;
}) {
  const receivedQuantity = ensureNonNegative(input.receivedQuantity, 'receivedQuantity');
  const damagedQuantity = ensureNonNegative(input.damagedQuantity ?? 0, 'damagedQuantity');
  const rejectedQuantity = ensureNonNegative(input.rejectedQuantity ?? 0, 'rejectedQuantity');
  const acceptedQuantity = receivedQuantity - damagedQuantity - rejectedQuantity;

  if (acceptedQuantity < 0) {
    throw new Error('acceptedQuantity must not be negative.');
  }

  return acceptedQuantity;
}

export function calculateShortageQuantity(input: {
  orderedQuantity: unknown;
  receivedQuantity: unknown;
}) {
  const orderedQuantity = ensureNonNegative(input.orderedQuantity, 'orderedQuantity');
  const receivedQuantity = ensureNonNegative(input.receivedQuantity, 'receivedQuantity');
  return Math.max(0, orderedQuantity - receivedQuantity);
}

export function findMissingDefaultWarehouses(existingCodes: string[]) {
  const existing = new Set(existingCodes.map((code) => normalizeWarehouseCode(code)));

  return DEFAULT_INVENTORY_WAREHOUSES.filter(
    (warehouse) => !existing.has(normalizeWarehouseCode(warehouse.code)),
  );
}

export function deriveSupplierShortages(
  purchaseOrders: Array<Record<string, unknown>>,
): SupplierShortageRow[] {
  const shortages: SupplierShortageRow[] = [];

  for (const order of purchaseOrders) {
    const supplier = asObject(order.suppliers);
    const items = asArray(order.purchase_order_items);

    for (const row of items) {
      const item = asObject(row.items);
      const orderedQuantity = toNumber(row.quantity_ordered ?? row.quantity);
      const receivedQuantity = toNumber(row.quantity_received ?? row.received_qty);
      const shortageQuantity = Math.max(0, orderedQuantity - receivedQuantity);

      if (shortageQuantity <= 0) {
        continue;
      }

      shortages.push({
        expectedResolutionDate: order.expected_delivery_date || order.expected_date
          ? String(order.expected_delivery_date ?? order.expected_date)
          : null,
        itemCode: item?.code ? String(item.code) : null,
        itemId: String(row.item_id),
        itemName: item?.name ? String(item.name) : 'Unknown item',
        orderedQuantity,
        poNumber: String(order.po_number ?? 'Unknown PO'),
        purchaseOrderId: String(order.id),
        receivedQuantity,
        shortageQuantity,
        status: shortageQuantity === 0 ? 'RESOLVED' : 'OPEN',
        supplierId: supplier?.id ? String(supplier.id) : null,
        supplierName: supplier?.name ? String(supplier.name) : 'Unknown supplier',
      });
    }
  }

  return shortages.sort((a, b) => {
    if (b.shortageQuantity !== a.shortageQuantity) {
      return b.shortageQuantity - a.shortageQuantity;
    }

    return a.supplierName.localeCompare(b.supplierName);
  });
}

export function summarizeInventoryByType(
  rows: Array<Record<string, unknown>>,
) {
  const summary = {
    totalStockValue: 0,
    rawMaterialValue: 0,
    wipValue: 0,
    finishedGoodsValue: 0,
    packagingMaterialValue: 0,
    nonConsumablesValue: 0,
  };

  for (const row of rows) {
    const item = asObject(row.items);
    const itemType = String(item?.item_type ?? item?.type ?? '');
    const value = calculateStockBalanceValue(row);

    summary.totalStockValue += value;

    switch (itemType) {
      case 'RAW_MATERIAL':
        summary.rawMaterialValue += value;
        break;
      case 'WORK_IN_PROGRESS':
        summary.wipValue += value;
        break;
      case 'FINISHED_GOOD':
        summary.finishedGoodsValue += value;
        break;
      case 'PACKAGING_MATERIAL':
        summary.packagingMaterialValue += value;
        break;
      default:
        summary.nonConsumablesValue += value;
        break;
    }
  }

  return summary;
}

export function buildOpeningClosingRows(
  movements: Array<Record<string, unknown>>,
  startDate: string | undefined,
  endDate: string | undefined,
) {
  const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;
  const grouped = new Map<string, {
    closingStock: number;
    itemCode: string;
    itemName: string;
    itemType: string;
    openingStock: number;
    stockIn: number;
    stockOut: number;
    unitCost: number;
    warehouseName: string;
  }>();

  for (const movement of movements) {
    const item = asObject(movement.items);
    const warehouse = asObject(movement.warehouses);
    const movementDate = new Date(String(movement.created_at));
    const movementType = normalizeStockMovementType(String(movement.movement_type ?? ''));
    const quantity = toNumber(movement.quantity);
    const unitCost = toNumber(movement.unit_cost ?? item?.unit_cost);
    const direction =
      STOCK_IN_MOVEMENT_TYPES.has(movementType) ? 'in' :
      STOCK_OUT_MOVEMENT_TYPES.has(movementType) ? 'out' :
      'none';
    const key = `${movement.item_id}:${movement.warehouse_id}`;

    const entry = grouped.get(key) ?? {
      closingStock: 0,
      itemCode: String(item?.code ?? ''),
      itemName: String(item?.name ?? 'Unknown item'),
      itemType: String(item?.item_type ?? ''),
      openingStock: 0,
      stockIn: 0,
      stockOut: 0,
      unitCost,
      warehouseName: String(warehouse?.name ?? 'Unknown warehouse'),
    };

    const inRange =
      (!start || movementDate >= start) &&
      (!end || movementDate <= end);

    if (start && movementDate < start) {
      if (direction === 'in') entry.openingStock += quantity;
      if (direction === 'out') entry.openingStock -= quantity;
    } else if (inRange) {
      if (direction === 'in') entry.stockIn += quantity;
      if (direction === 'out') entry.stockOut += quantity;
    }

    entry.closingStock = entry.openingStock + entry.stockIn - entry.stockOut;
    grouped.set(key, entry);
  }

  return Array.from(grouped.values()).map((row) => ({
    ...row,
    stockValue: row.closingStock * row.unitCost,
  }));
}

export function toCsv(rows: CsvRow[]) {
  if (!rows.length) return '';

  const headers = Object.keys(rows[0] ?? {});
  const data = rows.map((row) =>
    headers
      .map((header) => escapeCsvCell(row[header]))
      .join(','),
  );

  return [headers.map(escapeCsvCell).join(','), ...data].join('\n');
}

export function asArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
}

export function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function escapeCsvCell(value: CsvRow[string] | string) {
  if (value === null || value === undefined) return '';
  const text = String(value);

  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
