import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOpeningClosingRows,
  calculateAcceptedQuantity,
  calculateShortageQuantity,
  deriveSupplierShortages,
  findMissingDefaultWarehouses,
  getItemReorderQuantity,
  isMissingTableColumnError,
  isInvoiceApprovedForDispatch,
  normalizeStockMovementType,
  normalizeTransferStatus,
  normalizeWarehouseCode,
  normalizeWarehouseType,
  resolveWarehouseDisplayType,
  resolveWarehouseStorageType,
  summarizeInventoryByType,
} from '../src/lib/inventory';

test('deriveSupplierShortages returns open shortages from ordered versus received quantities', () => {
  const rows = deriveSupplierShortages([
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

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.shortageQuantity, 20);
  assert.equal(rows[0]?.supplierName, 'Cold Chain Supplies');
});

test('buildOpeningClosingRows derives period movement totals', () => {
  const rows = buildOpeningClosingRows([
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

  assert.equal(rows[0]?.openingStock, 10);
  assert.equal(rows[0]?.stockOut, 3);
  assert.equal(rows[0]?.closingStock, 7);
});

test('isInvoiceApprovedForDispatch only allows non-draft invoice statuses', () => {
  assert.equal(isInvoiceApprovedForDispatch('draft'), false);
  assert.equal(isInvoiceApprovedForDispatch('sent'), true);
  assert.equal(isInvoiceApprovedForDispatch('paid'), true);
});

test('normalizeStockMovementType maps legacy aliases onto schema enums', () => {
  assert.equal(normalizeStockMovementType('purchase_receipt'), 'PURCHASE_RECEIVE');
  assert.equal(normalizeStockMovementType('finished_goods_receipt'), 'PRODUCTION_OUTPUT');
  assert.equal(normalizeStockMovementType('sales_dispatch'), 'SALES_ISSUE');
  assert.equal(normalizeStockMovementType('transfer_out'), 'TRANSFER_OUT');
});

test('warehouse helpers normalize codes and types expected by inventory stores', () => {
  assert.equal(normalizeWarehouseCode(' Raw Store '), 'RAW_STORE');
  assert.equal(normalizeWarehouseType('raw_store'), 'RAW_MATERIALS');
  assert.equal(resolveWarehouseStorageType('raw_store'), 'MAIN');
  assert.equal(resolveWarehouseDisplayType({ code: 'RAW_STORE', type: 'MAIN' }), 'RAW_MATERIALS');
  assert.equal(normalizeWarehouseType('fg warehouse'), 'FINISHED_GOODS');
  assert.equal(normalizeTransferStatus('posted'), 'COMPLETED');
});

test('GRN quantity helpers derive accepted and shortage quantities safely', () => {
  assert.equal(
    calculateAcceptedQuantity({
      damagedQuantity: 3,
      receivedQuantity: 20,
      rejectedQuantity: 2,
    }),
    15,
  );
  assert.equal(
    calculateShortageQuantity({
      orderedQuantity: 30,
      receivedQuantity: 24,
    }),
    6,
  );
  assert.throws(
    () =>
      calculateAcceptedQuantity({
        damagedQuantity: 12,
        receivedQuantity: 10,
        rejectedQuantity: 0,
      }),
    /acceptedQuantity must not be negative/,
  );
});

test('findMissingDefaultWarehouses returns only missing warehouse seeds', () => {
  const missing = findMissingDefaultWarehouses(['RAW_STORE', 'FG_WAREHOUSE']);

  assert.deepEqual(
    missing.map((warehouse) => warehouse.code),
    ['PROD_MATERIALS', 'PRODUCTION_FINISHED_GOODS', 'DISPATCH_WAREHOUSE', 'RETURNS_WAREHOUSE'],
  );
});

test('legacy reorder helpers use reorder_qty and detect missing modern column errors', () => {
  assert.equal(getItemReorderQuantity({ reorder_qty: 24 }), 24);
  assert.equal(getItemReorderQuantity({ reorder_quantity: 18, reorder_qty: 24 }), 18);
  assert.equal(
    isMissingTableColumnError(
      new Error('column items.reorder_quantity does not exist'),
      'items',
      'reorder_quantity',
    ),
    true,
  );
  assert.equal(
    isMissingTableColumnError(
      new Error('column items.standard_cost does not exist'),
      'items',
      'reorder_quantity',
    ),
    false,
  );
});

test('inventory valuation summaries prefer posted total_value and average_cost aliases', () => {
  const summary = summarizeInventoryByType([
    {
      average_cost: 2,
      quantity_on_hand: 50,
      total_value: 100,
      items: {
        item_type: 'RAW_MATERIAL',
        unit_cost: 0,
      },
    },
    {
      avg_cost: 3,
      quantity: 10,
      items: {
        item_type: 'PACKAGING_MATERIAL',
      },
    },
  ]);

  assert.equal(summary.rawMaterialValue, 100);
  assert.equal(summary.packagingMaterialValue, 30);
  assert.equal(summary.totalStockValue, 130);
});
