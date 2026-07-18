"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const inventory_1 = require("../src/lib/inventory");
(0, node_test_1.default)('deriveSupplierShortages returns open shortages from ordered versus received quantities', () => {
    const rows = (0, inventory_1.deriveSupplierShortages)([
        {
            id: 'po-1',
            po_number: 'PO-001',
            suppliers: { id: 'sup-1', name: 'Cold Chain Supplies' },
            purchase_order_items: [
                {
                    item_id: 'item-1',
                    quantity_ordered: 100,
                    quantity_received: 80,
                    items: { id: 'item-1', code: 'MIX-001', name: 'Ice cream mix' },
                },
            ],
        },
    ]);
    strict_1.default.equal(rows.length, 1);
    strict_1.default.equal(rows[0]?.shortageQuantity, 20);
    strict_1.default.equal(rows[0]?.supplierName, 'Cold Chain Supplies');
});
(0, node_test_1.default)('buildOpeningClosingRows derives period movement totals', () => {
    const rows = (0, inventory_1.buildOpeningClosingRows)([
        {
            item_id: 'item-1',
            warehouse_id: 'wh-1',
            movement_type: 'PURCHASE_RECEIPT',
            quantity: 10,
            unit_cost: 2,
            created_at: '2026-06-01T08:00:00.000Z',
            items: { code: 'MIX-001', name: 'Ice cream mix', item_type: 'RAW_MATERIAL', unit_cost: 2 },
            warehouses: { name: 'Main Stores' },
        },
        {
            item_id: 'item-1',
            warehouse_id: 'wh-1',
            movement_type: 'PRODUCTION_ISSUE',
            quantity: 3,
            unit_cost: 2,
            created_at: '2026-06-03T08:00:00.000Z',
            items: { code: 'MIX-001', name: 'Ice cream mix', item_type: 'RAW_MATERIAL', unit_cost: 2 },
            warehouses: { name: 'Main Stores' },
        },
    ], '2026-06-02', '2026-06-30');
    strict_1.default.equal(rows[0]?.openingStock, 10);
    strict_1.default.equal(rows[0]?.stockOut, 3);
    strict_1.default.equal(rows[0]?.closingStock, 7);
});
(0, node_test_1.default)('isInvoiceApprovedForDispatch only allows non-draft invoice statuses', () => {
    strict_1.default.equal((0, inventory_1.isInvoiceApprovedForDispatch)('draft'), false);
    strict_1.default.equal((0, inventory_1.isInvoiceApprovedForDispatch)('sent'), true);
    strict_1.default.equal((0, inventory_1.isInvoiceApprovedForDispatch)('paid'), true);
});
(0, node_test_1.default)('normalizeStockMovementType maps legacy aliases onto schema enums', () => {
    strict_1.default.equal((0, inventory_1.normalizeStockMovementType)('purchase_receipt'), 'PURCHASE_RECEIVE');
    strict_1.default.equal((0, inventory_1.normalizeStockMovementType)('finished_goods_receipt'), 'PRODUCTION_OUTPUT');
    strict_1.default.equal((0, inventory_1.normalizeStockMovementType)('sales_dispatch'), 'SALES_ISSUE');
    strict_1.default.equal((0, inventory_1.normalizeStockMovementType)('transfer_out'), 'TRANSFER_OUT');
});
(0, node_test_1.default)('warehouse helpers normalize codes and types expected by inventory stores', () => {
    strict_1.default.equal((0, inventory_1.normalizeWarehouseCode)(' Raw Store '), 'RAW_STORE');
    strict_1.default.equal((0, inventory_1.normalizeWarehouseType)('raw_store'), 'RAW_MATERIALS');
    strict_1.default.equal((0, inventory_1.resolveWarehouseStorageType)('raw_store'), 'MAIN');
    strict_1.default.equal((0, inventory_1.resolveWarehouseDisplayType)({ code: 'RAW_STORE', type: 'MAIN' }), 'RAW_MATERIALS');
    strict_1.default.equal((0, inventory_1.normalizeWarehouseType)('fg warehouse'), 'FINISHED_GOODS');
    strict_1.default.equal((0, inventory_1.normalizeTransferStatus)('posted'), 'COMPLETED');
});
(0, node_test_1.default)('GRN quantity helpers derive accepted and shortage quantities safely', () => {
    strict_1.default.equal((0, inventory_1.calculateAcceptedQuantity)({
        damagedQuantity: 3,
        receivedQuantity: 20,
        rejectedQuantity: 2,
    }), 15);
    strict_1.default.equal((0, inventory_1.calculateShortageQuantity)({
        orderedQuantity: 30,
        receivedQuantity: 24,
    }), 6);
    strict_1.default.throws(() => (0, inventory_1.calculateAcceptedQuantity)({
        damagedQuantity: 12,
        receivedQuantity: 10,
        rejectedQuantity: 0,
    }), /acceptedQuantity must not be negative/);
});
(0, node_test_1.default)('findMissingDefaultWarehouses returns only missing warehouse seeds', () => {
    const missing = (0, inventory_1.findMissingDefaultWarehouses)(['RAW_STORE', 'FG_WAREHOUSE']);
    strict_1.default.deepEqual(missing.map((warehouse) => warehouse.code), ['PROD_MATERIALS', 'PRODUCTION_FINISHED_GOODS', 'DISPATCH_WAREHOUSE', 'RETURNS_WAREHOUSE']);
});
(0, node_test_1.default)('legacy reorder helpers use reorder_qty and detect missing modern column errors', () => {
    strict_1.default.equal((0, inventory_1.getItemReorderQuantity)({ reorder_qty: 24 }), 24);
    strict_1.default.equal((0, inventory_1.getItemReorderQuantity)({ reorder_quantity: 18, reorder_qty: 24 }), 18);
    strict_1.default.equal((0, inventory_1.isMissingTableColumnError)(new Error('column items.reorder_quantity does not exist'), 'items', 'reorder_quantity'), true);
    strict_1.default.equal((0, inventory_1.isMissingTableColumnError)(new Error('column items.standard_cost does not exist'), 'items', 'reorder_quantity'), false);
});
