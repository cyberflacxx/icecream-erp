"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_OUT_MOVEMENT_TYPES = exports.STOCK_IN_MOVEMENT_TYPES = exports.DEFAULT_INVENTORY_WAREHOUSES = exports.INVENTORY_WAREHOUSE_TYPES = exports.INVENTORY_ITEM_TYPES = void 0;
exports.toNumber = toNumber;
exports.getItemReorderQuantity = getItemReorderQuantity;
exports.isMissingTableColumnError = isMissingTableColumnError;
exports.ensurePositiveQuantity = ensurePositiveQuantity;
exports.ensureNonNegative = ensureNonNegative;
exports.isInvoiceApprovedForDispatch = isInvoiceApprovedForDispatch;
exports.normalizeDate = normalizeDate;
exports.normalizeStockMovementType = normalizeStockMovementType;
exports.normalizeWarehouseCode = normalizeWarehouseCode;
exports.normalizeWarehouseType = normalizeWarehouseType;
exports.resolveWarehouseStorageType = resolveWarehouseStorageType;
exports.resolveWarehouseDisplayType = resolveWarehouseDisplayType;
exports.normalizeTransferStatus = normalizeTransferStatus;
exports.resolveTransferWriteStatus = resolveTransferWriteStatus;
exports.calculateAcceptedQuantity = calculateAcceptedQuantity;
exports.calculateShortageQuantity = calculateShortageQuantity;
exports.findMissingDefaultWarehouses = findMissingDefaultWarehouses;
exports.deriveSupplierShortages = deriveSupplierShortages;
exports.summarizeInventoryByType = summarizeInventoryByType;
exports.buildOpeningClosingRows = buildOpeningClosingRows;
exports.toCsv = toCsv;
exports.asArray = asArray;
exports.asObject = asObject;
exports.INVENTORY_ITEM_TYPES = [
    'RAW_MATERIAL',
    'PACKAGING_MATERIAL',
    'FINISHED_GOOD',
    'WORK_IN_PROGRESS',
    'CONSUMABLE',
    'SPARE_PART',
];
exports.INVENTORY_WAREHOUSE_TYPES = [
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
    'PRODUCTION_MATERIALS',
    'GENERAL',
];
exports.DEFAULT_INVENTORY_WAREHOUSES = [
    {
        code: 'RAW_STORE',
        name: 'Raw Materials Store',
        warehouseType: 'RAW_MATERIALS',
    },
    {
        code: 'PROD_MATERIALS',
        name: 'Production Materials Store',
        warehouseType: 'PRODUCTION_MATERIALS',
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
];
exports.STOCK_IN_MOVEMENT_TYPES = new Set([
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
exports.STOCK_OUT_MOVEMENT_TYPES = new Set([
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
const STOCK_MOVEMENT_TYPE_ALIASES = {
    BRANCH_TRANSFER_IN: 'TRANSFER_IN',
    BRANCH_TRANSFER_OUT: 'TRANSFER_OUT',
    CUSTOMER_RETURN: 'RETURN_IN',
    FINISHED_GOODS_RECEIPT: 'PRODUCTION_OUTPUT',
    GRN_RECEIPT: 'PURCHASE_RECEIVE',
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
function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}
function getItemReorderQuantity(row) {
    return toNumber(row?.reorder_quantity ?? row?.reorder_qty, 0);
}
function isMissingTableColumnError(error, table, column) {
    const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
            ? String(error.message ?? '')
            : String(error ?? '');
    return message.toLowerCase().includes(`column ${table}.${column} does not exist`);
}
function ensurePositiveQuantity(quantity, field = 'quantity') {
    const parsed = toNumber(quantity, NaN);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${field} must be greater than zero.`);
    }
    return parsed;
}
function ensureNonNegative(value, field) {
    const parsed = toNumber(value, NaN);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${field} must not be negative.`);
    }
    return parsed;
}
function isInvoiceApprovedForDispatch(status) {
    if (!status)
        return false;
    return ['sent', 'partial_paid', 'paid'].includes(status.toLowerCase());
}
function normalizeDate(value) {
    if (!value)
        return new Date().toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
function normalizeStockMovementType(value) {
    const movementType = String(value ?? '').trim().toUpperCase();
    return STOCK_MOVEMENT_TYPE_ALIASES[movementType] ?? movementType;
}
function normalizeWarehouseCode(value) {
    return String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}
function normalizeWarehouseType(value) {
    const warehouseType = normalizeWarehouseCode(value);
    switch (warehouseType) {
        case 'RAW_STORE':
        case 'RAW_MATERIAL':
        case 'RAW_MATERIALS_STORE':
            return 'RAW_MATERIALS';
        case 'PROD_MATERIALS':
        case 'PRODUCTION_STORE':
        case 'PRODUCTION_MATERIAL':
        case 'PRODUCTION_MATERIALS_STORE':
            return 'PRODUCTION_MATERIALS';
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
function resolveWarehouseStorageType(value) {
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
function resolveWarehouseDisplayType(input) {
    const code = normalizeWarehouseCode(input.code);
    if (code === 'RAW_STORE')
        return 'RAW_MATERIALS';
    if (code === 'PROD_MATERIALS')
        return 'PRODUCTION_MATERIALS';
    if (code === 'PRODUCTION_FINISHED_GOODS')
        return 'FINISHED_GOODS';
    if (code === 'FG_WAREHOUSE')
        return 'FINISHED_GOODS';
    if (code === 'DISPATCH_WAREHOUSE')
        return 'DISPATCH';
    if (code === 'RETURNS_WAREHOUSE')
        return 'RETURNS';
    return normalizeWarehouseType(input.warehouseType ?? input.type);
}
function normalizeTransferStatus(value) {
    const status = normalizeWarehouseCode(value);
    return status === 'POSTED' ? 'COMPLETED' : status;
}
function resolveTransferWriteStatus(value) {
    const status = normalizeTransferStatus(value);
    // Live transfer_status currently supports DRAFT/COMPLETED/CANCELLED only.
    if (status === 'PENDING_APPROVAL' || status === 'APPROVED') {
        return 'DRAFT';
    }
    return status;
}
function calculateAcceptedQuantity(input) {
    const receivedQuantity = ensureNonNegative(input.receivedQuantity, 'receivedQuantity');
    const damagedQuantity = ensureNonNegative(input.damagedQuantity ?? 0, 'damagedQuantity');
    const rejectedQuantity = ensureNonNegative(input.rejectedQuantity ?? 0, 'rejectedQuantity');
    const acceptedQuantity = receivedQuantity - damagedQuantity - rejectedQuantity;
    if (acceptedQuantity < 0) {
        throw new Error('acceptedQuantity must not be negative.');
    }
    return acceptedQuantity;
}
function calculateShortageQuantity(input) {
    const orderedQuantity = ensureNonNegative(input.orderedQuantity, 'orderedQuantity');
    const receivedQuantity = ensureNonNegative(input.receivedQuantity, 'receivedQuantity');
    return Math.max(0, orderedQuantity - receivedQuantity);
}
function findMissingDefaultWarehouses(existingCodes) {
    const existing = new Set(existingCodes.map((code) => normalizeWarehouseCode(code)));
    return exports.DEFAULT_INVENTORY_WAREHOUSES.filter((warehouse) => !existing.has(normalizeWarehouseCode(warehouse.code)));
}
function deriveSupplierShortages(purchaseOrders) {
    const shortages = [];
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
function summarizeInventoryByType(rows) {
    const summary = {
        totalStockValue: 0,
        rawMaterialValue: 0,
        wipValue: 0,
        finishedGoodsValue: 0,
        packagingMaterialValue: 0,
        nonConsumablesValue: 0,
    };
    for (const row of rows) {
        const quantityOnHand = toNumber(row.quantity_on_hand ?? row.quantity);
        const item = asObject(row.items);
        const itemType = String(item?.item_type ?? item?.type ?? '');
        const unitCost = toNumber(item?.unit_cost ?? item?.standard_cost);
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
function buildOpeningClosingRows(movements, startDate, endDate) {
    const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;
    const grouped = new Map();
    for (const movement of movements) {
        const item = asObject(movement.items);
        const warehouse = asObject(movement.warehouses);
        const movementDate = new Date(String(movement.created_at));
        const movementType = normalizeStockMovementType(String(movement.movement_type ?? ''));
        const quantity = toNumber(movement.quantity);
        const unitCost = toNumber(movement.unit_cost ?? item?.unit_cost);
        const direction = exports.STOCK_IN_MOVEMENT_TYPES.has(movementType) ? 'in' :
            exports.STOCK_OUT_MOVEMENT_TYPES.has(movementType) ? 'out' :
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
        const inRange = (!start || movementDate >= start) &&
            (!end || movementDate <= end);
        if (start && movementDate < start) {
            if (direction === 'in')
                entry.openingStock += quantity;
            if (direction === 'out')
                entry.openingStock -= quantity;
        }
        else if (inRange) {
            if (direction === 'in')
                entry.stockIn += quantity;
            if (direction === 'out')
                entry.stockOut += quantity;
        }
        entry.closingStock = entry.openingStock + entry.stockIn - entry.stockOut;
        grouped.set(key, entry);
    }
    return Array.from(grouped.values()).map((row) => ({
        ...row,
        stockValue: row.closingStock * row.unitCost,
    }));
}
function toCsv(rows) {
    if (!rows.length)
        return '';
    const headers = Object.keys(rows[0] ?? {});
    const data = rows.map((row) => headers
        .map((header) => escapeCsvCell(row[header]))
        .join(','));
    return [headers.map(escapeCsvCell).join(','), ...data].join('\n');
}
function asArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => Boolean(item) && typeof item === 'object');
}
function asObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    return value;
}
function escapeCsvCell(value) {
    if (value === null || value === undefined)
        return '';
    const text = String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}
