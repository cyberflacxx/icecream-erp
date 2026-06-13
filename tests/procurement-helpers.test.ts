import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCostVarianceRows,
  buildInvoiceAgeingRows,
  buildSupplierShortageRows,
  canPayInvoice,
  validateSupplierCodeUniqueness,
} from '../src/lib/procurement';

test('validateSupplierCodeUniqueness blocks duplicate supplier codes', () => {
  assert.equal(validateSupplierCodeUniqueness(['SUP-001', 'SUP-002'], 'SUP-003'), true);
  assert.equal(validateSupplierCodeUniqueness(['SUP-001', 'SUP-002'], 'sup-001'), false);
});

test('buildSupplierShortageRows calculates shortage and age', () => {
  const rows = buildSupplierShortageRows([
    {
      expected_delivery_date: '2026-06-01',
      po_number: 'PO-001',
      suppliers: { name: 'Kefalos Cheese' },
      purchase_order_items: [
        {
          items: { name: 'Ice cream mix' },
          quantity_ordered: 100,
          quantity_received: 75,
        },
      ],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.shortageQuantity, 25);
  assert.equal(rows[0]?.supplierName, 'Kefalos Cheese');
});

test('buildInvoiceAgeingRows derives balances from payments', () => {
  const rows = buildInvoiceAgeingRows(
    [
      {
        id: 'inv-1',
        due_date: '2026-06-10',
        invoice_date: '2026-06-01',
        invoice_number: 'SINV-001',
        invoice_total: 1200,
        status: 'PENDING',
        suppliers: { name: 'Kefalos Cheese' },
      },
    ],
    new Map([['inv-1', 200]]),
  );

  assert.equal(rows[0]?.balance, 1000);
  assert.equal(rows[0]?.paidAmount, 200);
});

test('buildCostVarianceRows returns invoice minus po unit cost', () => {
  const rows = buildCostVarianceRows([
    {
      invoice_number: 'SINV-001',
      suppliers: { name: 'Kefalos Cheese' },
      purchase_orders: { po_number: 'PO-001' },
      supplier_invoice_items: [
        {
          items: { name: 'Ice cream mix' },
          po_unit_cost: 10,
          quantity_invoiced: 5,
          unit_cost: 12,
        },
      ],
    },
  ]);

  assert.equal(rows[0]?.priceVariance, 2);
  assert.equal(rows[0]?.quantity, 5);
});

test('canPayInvoice blocks overpayment', () => {
  assert.equal(canPayInvoice(100, 50), true);
  assert.equal(canPayInvoice(100, 150), false);
  assert.equal(canPayInvoice(100, 0), false);
});
