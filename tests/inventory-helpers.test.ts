import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOpeningClosingRows,
  deriveSupplierShortages,
  isInvoiceApprovedForDispatch,
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
