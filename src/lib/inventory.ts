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
] as const;

export const STOCK_IN_MOVEMENT_TYPES = new Set([
  'PURCHASE_RECEIVE',
  'PURCHASE_RECEIPT',
  'PRODUCTION_OUTPUT',
  'PRODUCTION_RETURN',
  'WIP_TRANSFER',
  'TRANSFER_IN',
  'WAREHOUSE_TRANSFER_IN',
  'BRANCH_TRANSFER_IN',
  'RETURN_IN',
  'ADJUSTMENT_IN',
  'FINISHED_GOODS_RECEIPT',
  'CUSTOMER_RETURN',
  'STOCK_ADJUSTMENT_IN',
]);

export const STOCK_OUT_MOVEMENT_TYPES = new Set([
  'PRODUCTION_ISSUE',
  'TRANSFER_OUT',
  'WAREHOUSE_TRANSFER_OUT',
  'BRANCH_TRANSFER_OUT',
  'SALES_ISSUE',
  'SALES_DISPATCH',
  'ADJUSTMENT_OUT',
  'STOCK_ADJUSTMENT_OUT',
  'DAMAGE',
  'DAMAGED_GOODS_TRANSFER',
  'EXPIRY_WRITE_OFF',
  'WASTAGE',
  'SPILLAGE',
  'MACHINE_LOSS',
  'PACKAGING_LOSS',
]);

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

export type CsvRow = Record<string, string | number | boolean | null | undefined>;

export function toNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
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

export function deriveSupplierShortages(
  purchaseOrders: Array<Record<string, unknown>>,
): SupplierShortageRow[] {
  const shortages: SupplierShortageRow[] = [];

  for (const order of purchaseOrders) {
    const supplier = asObject(order.suppliers);
    const items = asArray(order.purchase_order_items);

    for (const row of items) {
      const item = asObject(row.items);
      const orderedQuantity = toNumber(row.quantity_ordered);
      const receivedQuantity = toNumber(row.quantity_received);
      const shortageQuantity = Math.max(0, orderedQuantity - receivedQuantity);

      if (shortageQuantity <= 0) {
        continue;
      }

      shortages.push({
        expectedResolutionDate: order.expected_delivery_date
          ? String(order.expected_delivery_date)
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
    const quantityOnHand = toNumber(row.quantity_on_hand);
    const item = asObject(row.items);
    const itemType = String(item?.item_type ?? '');
    const unitCost = toNumber(item?.unit_cost);
    const value = quantityOnHand * unitCost;

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
    const movementType = String(movement.movement_type ?? '');
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
