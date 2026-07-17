import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPLIER_IMPORT_TEMPLATE_HEADERS,
  buildCostVarianceRows,
  buildInvoiceAgeingRows,
  buildSupplierShortageRows,
  buildSupplierImportTemplateCsv,
  canPayInvoice,
  validateSupplierImportRows,
  validateSupplierCodeUniqueness,
} from '../src/lib/procurement';
import {
  buildPurchaseOrderDraftPayload as buildPurchaseOrderDraftPayloadForOrders,
  normalizePurchaseOrderSupplierId as normalizePurchaseOrderSupplierIdForOrders,
} from '../src/lib/procurement-purchase-orders';
import {
  buildRequisitionDraftPayload,
  normalizeRequisitionItemId,
} from '../src/lib/procurement-requisitions';
import { filterSupplierOptions, isSupplierActive, mapSupplierOption } from '../src/lib/procurement-suppliers';

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

test('supplier import template csv includes the required headers', () => {
  const csv = buildSupplierImportTemplateCsv();
  const [headerLine] = csv.split('\n');

  assert.equal(headerLine, SUPPLIER_IMPORT_TEMPLATE_HEADERS.join(','));
});

test('supplier import validation accepts valid rows and rejects invalid ones', () => {
  const result = validateSupplierImportRows([
    {
      'Supplier Code': 'SUP-010',
      'Supplier Name': 'Cold Chain Supplies',
      'Contact Person': 'Joy',
      'Email Address': 'joy@example.com',
      'Telephone Number': '+263700000001',
      'Physical Address': 'Harare',
      'VAT/Tax Number': 'VAT-01',
      'Payment Terms': '30 DAYS',
      'Credit Limit': '1200',
      'Currency': 'USD',
      'Status': 'ACTIVE',
    },
    {
      'Supplier Code': 'SUP-010',
      'Supplier Name': '',
      'Email Address': 'bad-email',
      'Credit Limit': '-1',
      'Currency': '',
      'Status': 'INACTIVE',
    },
  ], ['SUP-001']);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.code, 'SUP-010');
  assert.equal(result.errors.length, 5);
  assert.equal(result.errors.some((error) => error.message.includes('Duplicate supplier code')), true);
  assert.equal(result.errors.some((error) => error.message.includes('Email Address is invalid')), true);
});

test('supplier option helpers keep active suppliers and map code/name safely', () => {
  const rows = [
    {
      code: 'SUP-001',
      contact_person: 'Joy',
      credit_limit: 1200,
      email: 'joy@example.com',
      id: 'sup-1',
      is_active: true,
      name: 'Cold Chain Supplies',
      payment_terms: '30 DAYS',
      phone: '+263700000001',
      status: 'ACTIVE',
    },
    {
      code: null,
      id: 'sup-2',
      name: 'Dormant Supplier',
      status: 'INACTIVE',
    },
  ].map((row) => row as Record<string, unknown>);

  assert.equal(isSupplierActive(rows[0] ?? {}), true);
  assert.equal(isSupplierActive(rows[1] ?? {}), false);

  const mapped = rows.map(mapSupplierOption);
  const filtered = filterSupplierOptions(mapped, { activeOnly: true, search: 'cold' });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'sup-1');
  assert.equal(filtered[0]?.code, 'SUP-001');
  assert.equal(filtered[0]?.contactPerson, 'Joy');
});

test('normalizePurchaseOrderSupplierId accepts supplier_id and supplierId', () => {
  assert.equal(normalizePurchaseOrderSupplierIdForOrders({ supplier_id: ' sup-1 ' }), 'sup-1');
  assert.equal(normalizePurchaseOrderSupplierIdForOrders({ supplierId: 'sup-2' }), 'sup-2');
  assert.equal(
    normalizePurchaseOrderSupplierIdForOrders({ supplierId: 'sup-2', supplier_id: 'sup-3' }),
    'sup-3',
  );
  assert.equal(normalizePurchaseOrderSupplierIdForOrders({}), '');
});

test('buildPurchaseOrderDraftPayload stores supplier_id canonically', () => {
  const payload = buildPurchaseOrderDraftPayloadForOrders({
    discountAmount: 0,
    items: [
      {
        itemId: 'item-1',
        quantityOrdered: 2,
        unitCost: 10,
        unitOfMeasureId: 'uom-1',
      },
    ],
    supplierId: 'sup-1',
    taxAmount: 0,
  });

  assert.equal(payload.supplierId, 'sup-1');
  assert.equal(payload.supplier_id, 'sup-1');
  assert.equal(payload.items[0]?.itemId, 'item-1');
});

test('normalizeRequisitionItemId accepts item_id and itemId', () => {
  assert.equal(normalizeRequisitionItemId({ item_id: ' item-1 ' }), 'item-1');
  assert.equal(normalizeRequisitionItemId({ itemId: 'item-2' }), 'item-2');
  assert.equal(normalizeRequisitionItemId({ itemId: 'item-2', item_id: 'item-3' }), 'item-3');
  assert.equal(normalizeRequisitionItemId({}), '');
});

test('buildRequisitionDraftPayload stores item_id canonically', () => {
  const payload = buildRequisitionDraftPayload({
    approverUserId: 'user-1',
    department: 'Production',
    items: [
      {
        estimatedUnitCost: 12,
        itemId: 'item-1',
        quantityRequested: 4,
        unitOfMeasureId: 'uom-1',
      },
    ],
    neededByDate: '2026-07-20',
    remarks: 'Urgent',
  });

  assert.equal(payload.approverUserId, 'user-1');
  assert.equal(payload.items[0]?.itemId, 'item-1');
  assert.equal(payload.items[0]?.item_id, 'item-1');
  assert.equal(payload.department, 'Production');
});
