import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  extractRequisitionLineItems,
  isApprovedRequisitionStatus,
  mapRequisitionItemToPurchaseOrderLine,
  normalizePurchaseOrderItemId as normalizePurchaseOrderItemIdForOrders,
  normalizePurchaseOrderQuantity as normalizePurchaseOrderQuantityForOrders,
  normalizePurchaseOrderRequisitionId as normalizePurchaseOrderRequisitionIdForOrders,
  normalizePurchaseOrderSupplierId as normalizePurchaseOrderSupplierIdForOrders,
  normalizePurchaseOrderUnitOfMeasureId as normalizePurchaseOrderUnitOfMeasureIdForOrders,
  normalizePurchaseOrderUnitPrice as normalizePurchaseOrderUnitPriceForOrders,
  resolvePurchaseOrderItemDescription,
  resolvePurchaseOrderItemUnitOfMeasureId,
  resolvePurchaseOrderItemUnitPrice,
} from '../src/lib/procurement-purchase-orders';
import {
  buildGoodsReceivedDraftPayload,
  createOrUpdateStockBalance,
  fetchGoodsReceivedNoteDetail,
  findMatchingGrnReceiveLine,
  isGrnStockPostingError,
  normalizePostableGrnLines,
  normalizeGoodsReceivedItemId,
  normalizeGoodsReceivedPurchaseOrderId,
  normalizeGoodsReceivedUnitOfMeasureId,
  normalizeGoodsReceivedWarehouseId,
  postGoodsReceivedNoteToInventory,
  resolveCompatibleGrnPostedStatus,
} from '../src/lib/procurement-goods-received';
import {
  buildRequisitionDetailItem,
  buildRequisitionDetailLookupCandidates,
  buildRequisitionDraftPayload,
  isUuidLikeRequisitionIdentifier,
  normalizeRequisitionItemId,
  normalizeRequisitionUnitOfMeasureId,
  safeSelectItemsByIds,
} from '../src/lib/procurement-requisitions';
import { filterSupplierOptions, isSupplierActive, mapSupplierOption } from '../src/lib/procurement-suppliers';
import {
  deriveGoodsReceivedWorkflowStatus,
  derivePurchaseOrderWorkflowStatus,
  deriveRequisitionWorkflowStatus,
  getGoodsReceivedActionState,
  getPurchaseOrderActionState,
  getRequisitionActionState,
  normalizeProcurementRoleName,
} from '../src/lib/procurement-workflow';

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

test('purchase order helpers normalize requisition, item, uom, quantity, and price aliases', () => {
  assert.equal(normalizePurchaseOrderRequisitionIdForOrders({ requisition_id: ' req-1 ' }), 'req-1');
  assert.equal(normalizePurchaseOrderItemIdForOrders({ item_id: ' item-1 ' }), 'item-1');
  assert.equal(normalizePurchaseOrderUnitOfMeasureIdForOrders({ uom_id: ' uom-1 ' }), 'uom-1');
  assert.equal(normalizePurchaseOrderQuantityForOrders({ quantity: '4' }), 4);
  assert.equal(normalizePurchaseOrderQuantityForOrders({ quantityOrdered: 3 }), 3);
  assert.equal(normalizePurchaseOrderUnitPriceForOrders({ unit_price: '12.5' }), 12.5);
  assert.equal(normalizePurchaseOrderUnitPriceForOrders({ unitCost: 9 }), 9);
  assert.equal(normalizePurchaseOrderUnitPriceForOrders({ cost: 7 }), 7);
});

test('resolvePurchaseOrderItemUnitPrice follows purchase price fallback order', () => {
  assert.equal(resolvePurchaseOrderItemUnitPrice({ purchase_price: 17, cost_price: 12 }), 17);
  assert.equal(resolvePurchaseOrderItemUnitPrice({ cost_price: 12, unit_cost: 10 }), 12);
  assert.equal(resolvePurchaseOrderItemUnitPrice({ unit_cost: 10, default_purchase_price: 8 }), 10);
  assert.equal(resolvePurchaseOrderItemUnitPrice({ default_purchase_price: 8, selling_price: 7 }), 8);
  assert.equal(resolvePurchaseOrderItemUnitPrice({}), 0);
});

test('purchase order item helpers resolve requisition-ready aliases', () => {
  assert.equal(resolvePurchaseOrderItemDescription({ item_description: 'Chocolate cone' }), 'Chocolate cone');
  assert.equal(resolvePurchaseOrderItemDescription({ itemDescription: 'Chocolate cone spec' }), 'Chocolate cone spec');
  assert.equal(resolvePurchaseOrderItemDescription({ specification: 'Frozen bucket spec' }), 'Frozen bucket spec');
  assert.equal(resolvePurchaseOrderItemDescription({ name: 'Vanilla mix' }), 'Vanilla mix');
  assert.equal(resolvePurchaseOrderItemUnitOfMeasureId({ uom_id: 'uom-1' }), 'uom-1');
  assert.equal(resolvePurchaseOrderItemUnitOfMeasureId({ unitOfMeasureId: 'uom-2' }), 'uom-2');
  assert.equal(resolvePurchaseOrderItemUnitOfMeasureId({}), null);
});

test('extractRequisitionLineItems accepts all launch response aliases', () => {
  const row = {
    id: 'req-line-1',
    itemId: 'item-1',
    itemCode: 'VAN-MIX',
    itemName: 'Vanilla Mix',
    quantity: 50,
    requisitionItemId: 'req-line-1',
    specification: '50 bucket launch order',
    unitOfMeasureId: 'uom-1',
    uomName: 'Bucket',
    unitPrice: 2,
  };

  for (const key of ['items', 'line_items', 'lineItems', 'requisition_items', 'requisitionItems'] as const) {
    const extracted = extractRequisitionLineItems({ data: { [key]: [row] } });
    assert.equal(extracted.length, 1);
    assert.equal(extracted[0]?.itemId, 'item-1');
    assert.equal(extracted[0]?.requisitionItemId, 'req-line-1');
    assert.equal(extracted[0]?.quantity, 50);
    assert.equal(extracted[0]?.unitOfMeasureId, 'uom-1');
    assert.equal(extracted[0]?.unitPrice, 2);
  }
});

test('mapRequisitionItemToPurchaseOrderLine preserves item, UOM, quantity, price, and stable row id', () => {
  const line = mapRequisitionItemToPurchaseOrderLine({
    description: 'Vanilla Mix',
    item_id: 'item-1',
    quantity: 50,
    requisition_item_id: 'req-line-1',
    tax_rate: 0,
    unit_of_measure_id: 'uom-1',
    unit_price: 2,
  });

  assert.equal(line?.rowId, 'req-line-1');
  assert.equal(line?.itemId, 'item-1');
  assert.equal(line?.quantityOrdered, '50');
  assert.equal(line?.unitCost, '2');
  assert.equal(line?.unitOfMeasureId, 'uom-1');
  assert.equal(line?.taxRate, '0');
});

test('mapRequisitionItemToPurchaseOrderLine uses remaining approved quantity for PO conversion', () => {
  const line = mapRequisitionItemToPurchaseOrderLine({
    item_id: 'item-1',
    quantity_approved: 50,
    quantityConvertedToPurchaseOrders: 30,
    requisition_item_id: 'req-line-remaining',
    unit_price: 2,
  });

  assert.equal(line?.quantityOrdered, '20');
  assert.equal(line?.requisitionItemId, 'req-line-remaining');

  const fullyConverted = extractRequisitionLineItems({
    data: {
      items: [
        {
          item_id: 'item-1',
          remainingApprovedQuantity: 0,
          requisition_item_id: 'req-line-complete',
        },
      ],
    },
  });

  assert.equal(fullyConverted[0]?.quantityRemainingForPurchaseOrder, 0);
});

test('approved requisition status helper accepts live procurement variants', () => {
  assert.equal(isApprovedRequisitionStatus('approved', null), true);
  assert.equal(isApprovedRequisitionStatus('submitted', null), true);
  assert.equal(isApprovedRequisitionStatus('draft', 'approved_for_po'), true);
  assert.equal(isApprovedRequisitionStatus('draft', 'pending_approval'), true);
  assert.equal(isApprovedRequisitionStatus('draft', null), false);
});

test('buildPurchaseOrderDraftPayload stores supplier_id canonically', () => {
  const payload = buildPurchaseOrderDraftPayloadForOrders({
    approverEmail: 'approver@example.com',
    approverName: 'Jane Approver',
    approvalNotes: 'Route through HQ buyer',
    discountAmount: 0,
    items: [
      {
        item_id: 'item-1',
        quantity: 2,
        unit_price: 10,
        uom_id: 'uom-1',
      },
    ],
    requisition_id: 'req-1',
    supplierId: 'sup-1',
    taxAmount: 0,
  });

  assert.equal(payload.supplierId, 'sup-1');
  assert.equal(payload.supplier_id, 'sup-1');
  assert.equal(payload.requisitionId, 'req-1');
  assert.equal(payload.requisition_id, 'req-1');
  assert.equal(payload.approverName, 'Jane Approver');
  assert.equal(payload.approverEmail, 'approver@example.com');
  assert.equal(payload.approvalNotes, 'Route through HQ buyer');
  assert.equal(payload.items[0]?.itemId, 'item-1');
  assert.equal(payload.items[0]?.item_id, 'item-1');
  assert.equal(payload.items[0]?.quantityOrdered, 2);
  assert.equal(payload.items[0]?.quantity, 2);
  assert.equal(payload.items[0]?.unitCost, 10);
  assert.equal(payload.items[0]?.unit_price, 10);
  assert.equal(payload.items[0]?.unitOfMeasureId, 'uom-1');
});

test('buildPurchaseOrderDraftPayload preserves requisition line ids and descriptions', () => {
  const payload = buildPurchaseOrderDraftPayloadForOrders({
    discountAmount: 0,
    items: [
      {
        description: 'Vanilla Mix 20L bucket',
        itemId: 'item-1',
        quantity: 50,
        requisitionItemId: 'req-item-1',
        taxRate: 5,
        lineTotal: 100,
        unitPrice: 2,
      },
    ],
    supplierId: 'sup-1',
    taxAmount: 0,
  });

  assert.equal(payload.items[0]?.description, 'Vanilla Mix 20L bucket');
  assert.equal(payload.items[0]?.requisitionItemId, 'req-item-1');
  assert.equal(payload.items[0]?.requisition_item_id, 'req-item-1');
  assert.equal(payload.items[0]?.tax_rate, 5);
  assert.equal(payload.items[0]?.line_total, 100);
  assert.equal(payload.items[0]?.unit_price, 2);
});

test('normalizeRequisitionItemId accepts item_id and itemId', () => {
  assert.equal(normalizeRequisitionItemId({ item_id: ' item-1 ' }), 'item-1');
  assert.equal(normalizeRequisitionItemId({ itemId: 'item-2' }), 'item-2');
  assert.equal(normalizeRequisitionItemId({ itemId: 'item-2', item_id: 'item-3' }), 'item-3');
  assert.equal(normalizeRequisitionItemId({}), '');
});

test('normalizeRequisitionUnitOfMeasureId accepts unit aliases', () => {
  assert.equal(normalizeRequisitionUnitOfMeasureId({ unit_of_measure_id: ' uom-1 ' }), 'uom-1');
  assert.equal(normalizeRequisitionUnitOfMeasureId({ unitOfMeasureId: 'uom-2' }), 'uom-2');
  assert.equal(normalizeRequisitionUnitOfMeasureId({ uom_id: 'uom-3' }), 'uom-3');
  assert.equal(normalizeRequisitionUnitOfMeasureId({ uomId: 'uom-4' }), 'uom-4');
  assert.equal(normalizeRequisitionUnitOfMeasureId({ uom: 'uom-5' }), 'uom-5');
  assert.equal(normalizeRequisitionUnitOfMeasureId({}), '');
});

test('buildRequisitionDraftPayload stores item_id canonically', () => {
  const payload = buildRequisitionDraftPayload({
    approverEmail: 'approver@example.com',
    approverName: 'Jane Approver',
    approverUserId: 'user-1',
    approvalNotes: 'Escalate if unavailable',
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
  assert.equal(payload.approverName, 'Jane Approver');
  assert.equal(payload.approverEmail, 'approver@example.com');
  assert.equal(payload.approvalNotes, 'Escalate if unavailable');
  assert.equal(payload.items[0]?.itemId, 'item-1');
  assert.equal(payload.items[0]?.item_id, 'item-1');
  assert.equal(payload.items[0]?.unitOfMeasureId, 'uom-1');
  assert.equal(payload.items[0]?.unit_of_measure_id, 'uom-1');
  assert.equal(payload.department, 'Production');
});

test('requisition detail lookup candidates prefer id for UUIDs and requisition number for human refs', () => {
  assert.equal(isUuidLikeRequisitionIdentifier('e2122874-f414-4117-9358-6f60b333bba1'), true);
  assert.deepEqual(
    buildRequisitionDetailLookupCandidates('e2122874-f414-4117-9358-6f60b333bba1'),
    [
      { column: 'id', value: 'e2122874-f414-4117-9358-6f60b333bba1' },
      { column: 'requisition_id', value: 'e2122874-f414-4117-9358-6f60b333bba1' },
      { column: 'purchase_requisition_id', value: 'e2122874-f414-4117-9358-6f60b333bba1' },
    ],
  );
  assert.deepEqual(
    buildRequisitionDetailLookupCandidates('REQ-00014'),
    [
      { column: 'id', value: 'REQ-00014' },
      { column: 'requisition_number', value: 'REQ-00014' },
    ],
  );
});

test('buildRequisitionDetailItem returns the required launch aliases', () => {
  const item = buildRequisitionDetailItem(
    {
      id: 'line-1',
      item_id: 'item-1',
      quantity_requested: 50,
      remarks: '50 bucket launch order',
      tax_rate: 5,
      unit_of_measure_id: 'uom-1',
      estimated_unit_cost: 2,
    },
    {
      item: {
        code: 'VAN-MIX',
        description: 'Vanilla Mix',
        id: 'item-1',
        name: 'Vanilla Mix',
        purchase_price: 2,
      },
      unit: {
        abbreviation: 'BKT',
        id: 'uom-1',
        name: 'Bucket',
      },
    },
  );

  assert.equal(item.id, 'line-1');
  assert.equal(item.requisition_item_id, 'line-1');
  assert.equal(item.requisitionItemId, 'line-1');
  assert.equal(item.item_id, 'item-1');
  assert.equal(item.itemId, 'item-1');
  assert.equal(item.item_code, 'VAN-MIX');
  assert.equal(item.itemCode, 'VAN-MIX');
  assert.equal(item.item_name, 'Vanilla Mix');
  assert.equal(item.itemName, 'Vanilla Mix');
  assert.equal(item.description, '50 bucket launch order');
  assert.equal(item.specification, '50 bucket launch order');
  assert.equal(item.quantity, 50);
  assert.equal(item.qty, 50);
  assert.equal(item.unit_of_measure_id, 'uom-1');
  assert.equal(item.unitOfMeasureId, 'uom-1');
  assert.equal(item.uom_id, 'uom-1');
  assert.equal(item.uomId, 'uom-1');
  assert.equal(item.unit_of_measure_name, 'Bucket');
  assert.equal(item.uomName, 'BKT');
  assert.equal(item.unit_price, 2);
  assert.equal(item.unitPrice, 2);
  assert.equal(item.tax_rate, 5);
  assert.equal(item.taxRate, 5);
});

test('buildRequisitionDetailItem succeeds with minimal item metadata and line-level price fallback', () => {
  const item = buildRequisitionDetailItem(
    {
      id: 'line-2',
      item_id: 'item-2',
      quantity_requested: 12,
      unit_of_measure_id: 'uom-2',
      unit_price: 7.5,
    },
    {
      item: {
        code: 'CHOCO',
        id: 'item-2',
        name: 'Chocolate Mix',
      },
      unit: {
        id: 'uom-2',
        name: 'Kg',
      },
    },
  );

  assert.equal(item.item_code, 'CHOCO');
  assert.equal(item.item_name, 'Chocolate Mix');
  assert.equal(item.description, 'Chocolate Mix');
  assert.equal(item.unit_price, 7.5);
  assert.equal(item.unitPrice, 7.5);
  assert.equal(item.quantity, 12);
});

test('safeSelectItemsByIds retries smaller item selects and never requires purchase_price', async () => {
  const selects: string[] = [];
  const service = {
    from(table: string) {
      assert.equal(table, 'items');
      return {
        select(columns: string) {
          selects.push(columns);
          return {
            eq(_column: string, _value: string) {
              return {
                in(_idColumn: string, _values: string[]) {
                  if (columns.includes('unit_of_measure_id')) {
                    return Promise.resolve({
                      error: { message: "column items.unit_of_measure_id does not exist" },
                    });
                  }
                  if (columns.includes('item_code')) {
                    return Promise.resolve({
                      error: { message: "column items.item_code does not exist" },
                    });
                  }
                  return Promise.resolve({
                    data: [{ id: 'item-3', code: 'VAN', name: 'Vanilla Base' }],
                    error: null,
                  });
                },
              };
            },
            in(_idColumn: string, _values: string[]) {
              return Promise.resolve({
                data: [{ id: 'item-3', code: 'VAN', name: 'Vanilla Base' }],
                error: null,
              });
            },
          };
        },
      };
    },
  };

  const items = await safeSelectItemsByIds(service as any, ['item-3'], 'org-1');

  assert.equal(selects.some((entry) => entry.includes('purchase_price')), false);
  assert.equal(items.get('item-3')?.itemCode, 'VAN');
  assert.equal(items.get('item-3')?.itemName, 'Vanilla Base');
});

test('normalizeGoodsReceivedPurchaseOrderId accepts purchase order aliases', () => {
  assert.equal(normalizeGoodsReceivedPurchaseOrderId({ purchase_order_id: ' po-1 ' }), 'po-1');
  assert.equal(normalizeGoodsReceivedPurchaseOrderId({ purchaseOrderId: 'po-2' }), 'po-2');
  assert.equal(normalizeGoodsReceivedPurchaseOrderId({ po_id: 'po-3' }), 'po-3');
  assert.equal(normalizeGoodsReceivedPurchaseOrderId({ poId: 'po-4' }), 'po-4');
  assert.equal(
    normalizeGoodsReceivedPurchaseOrderId({ purchaseOrderId: 'po-2', purchase_order_id: 'po-1' }),
    'po-1',
  );
});

test('normalizeGoodsReceivedItemId accepts item aliases', () => {
  assert.equal(normalizeGoodsReceivedItemId({ item_id: ' item-1 ' }), 'item-1');
  assert.equal(normalizeGoodsReceivedItemId({ itemId: 'item-2' }), 'item-2');
  assert.equal(normalizeGoodsReceivedItemId({ product_id: 'item-3' }), 'item-3');
  assert.equal(normalizeGoodsReceivedItemId({ rawMaterialId: 'item-4' }), 'item-4');
  assert.equal(normalizeGoodsReceivedItemId({}), '');
});

test('normalizeGoodsReceivedUnitOfMeasureId accepts UOM aliases', () => {
  assert.equal(normalizeGoodsReceivedUnitOfMeasureId({ unit_of_measure_id: ' uom-1 ' }), 'uom-1');
  assert.equal(normalizeGoodsReceivedUnitOfMeasureId({ unitOfMeasureId: 'uom-2' }), 'uom-2');
  assert.equal(normalizeGoodsReceivedUnitOfMeasureId({ uom_id: 'uom-3' }), 'uom-3');
  assert.equal(normalizeGoodsReceivedUnitOfMeasureId({ uomId: 'uom-4' }), 'uom-4');
  assert.equal(normalizeGoodsReceivedUnitOfMeasureId({ uom: 'uom-5' }), 'uom-5');
  assert.equal(normalizeGoodsReceivedUnitOfMeasureId({}), '');
});

test('normalizeGoodsReceivedWarehouseId accepts warehouse aliases', () => {
  assert.equal(normalizeGoodsReceivedWarehouseId({ warehouse_id: ' wh-1 ' }), 'wh-1');
  assert.equal(normalizeGoodsReceivedWarehouseId({ warehouseId: 'wh-2' }), 'wh-2');
  assert.equal(normalizeGoodsReceivedWarehouseId({ receiving_warehouse_id: 'wh-3' }), 'wh-3');
  assert.equal(normalizeGoodsReceivedWarehouseId({ receivingWarehouseId: 'wh-4' }), 'wh-4');
  assert.equal(normalizeGoodsReceivedWarehouseId({ destination_warehouse_id: 'wh-5' }), 'wh-5');
  assert.equal(normalizeGoodsReceivedWarehouseId({ destinationWarehouseId: 'wh-6' }), 'wh-6');
  assert.equal(normalizeGoodsReceivedWarehouseId({}), '');
});

test('buildGoodsReceivedDraftPayload stores purchase order, item, and UOM ids canonically', () => {
  const payload = buildGoodsReceivedDraftPayload({
    entryMode: 'manual',
    items: [
      {
        damagedQuantity: 2,
        itemId: 'item-1',
        poItemId: 'po-item-1',
        quantityExpected: 4,
        quantityReceived: 4,
        quantityRejected: 0,
        reason: null,
        unitCost: 12,
        unitOfMeasureId: 'uom-1',
      },
    ],
    notes: 'Receive now',
    purchaseOrderId: 'po-1',
    qualityNotes: 'Checked',
    receivingWarehouseId: 'wh-1',
    supplierId: 'sup-1',
  });

  assert.equal(payload.purchaseOrderId, 'po-1');
  assert.equal(payload.purchase_order_id, 'po-1');
  assert.equal(payload.supplierId, 'sup-1');
  assert.equal(payload.supplier_id, 'sup-1');
  assert.equal(payload.warehouseId, 'wh-1');
  assert.equal(payload.warehouse_id, 'wh-1');
  assert.equal(payload.receivingWarehouseId, 'wh-1');
  assert.equal(payload.receiving_warehouse_id, 'wh-1');
  assert.equal(payload.items[0]?.itemId, 'item-1');
  assert.equal(payload.items[0]?.item_id, 'item-1');
  assert.equal(payload.items[0]?.poItemId, 'po-item-1');
  assert.equal(payload.items[0]?.po_item_id, 'po-item-1');
  assert.equal(payload.items[0]?.unitOfMeasureId, 'uom-1');
  assert.equal(payload.items[0]?.unit_of_measure_id, 'uom-1');
  assert.equal(payload.items[0]?.uomId, 'uom-1');
  assert.equal(payload.items[0]?.damagedQuantity, 2);
  assert.equal(payload.items[0]?.damaged_quantity, 2);
});

test('workflow helper normalizes live role names for procurement access fallbacks', () => {
  assert.equal(normalizeProcurementRoleName(' Super_Admin '), 'super admin');
  assert.equal(normalizeProcurementRoleName('SYSTEM-ADMIN'), 'system admin');
  assert.equal(normalizeProcurementRoleName('Procurement_Manager'), 'procurement manager');
});

test('requisition workflow helper prefers approval status over stale draft status', () => {
  const status = deriveRequisitionWorkflowStatus({
    approvalStatus: 'PENDING_APPROVAL',
    status: 'DRAFT',
  });
  const actions = getRequisitionActionState(
    {
      approvalStatus: 'PENDING_APPROVAL',
      approverName: 'HQ Buyer',
      status: 'DRAFT',
    },
    {
      roleNames: ['Super Admin'],
    },
  );

  assert.equal(status, 'PENDING_APPROVAL');
  assert.equal(actions.canApprove, true);
  assert.equal(actions.canReject, true);
  assert.equal(actions.canSubmit, false);
});

test('purchase order workflow helper upgrades legacy draft rows with approval timestamps', () => {
  const status = derivePurchaseOrderWorkflowStatus({
    approvedAt: '2026-07-20T10:00:00Z',
    status: 'DRAFT',
  });
  const actions = getPurchaseOrderActionState(
    {
      approvedAt: '2026-07-20T10:00:00Z',
      status: 'DRAFT',
    },
    {
      roleNames: ['Procurement Lead'],
    },
  );

  assert.equal(status, 'APPROVED');
  assert.equal(actions.canSend, true);
  assert.equal(actions.canRecordGrn, true);
  assert.equal(actions.canApprove, false);
});

test('goods received workflow helper derives pending approval from quality status and exposes open PO', () => {
  const status = deriveGoodsReceivedWorkflowStatus({
    qualityStatus: 'PENDING_APPROVAL',
    status: 'DRAFT',
  });
  const actions = getGoodsReceivedActionState(
    {
      purchaseOrder: { id: 'po-1' },
      qualityStatus: 'PENDING_APPROVAL',
      status: 'DRAFT',
    },
    {
      roleNames: ['Stores Supervisor'],
    },
  );

  assert.equal(status, 'PENDING_APPROVAL');
  assert.equal(actions.canApprove, true);
  assert.equal(actions.canReject, true);
  assert.equal(actions.canOpenPurchaseOrder, true);
  assert.equal(actions.canPost, false);
});

test('resolveCompatibleGrnPostedStatus never returns APPROVED and prefers POSTED-compatible statuses', () => {
  assert.equal(resolveCompatibleGrnPostedStatus('APPROVED'), 'POSTED');
  assert.equal(resolveCompatibleGrnPostedStatus('received'), 'RECEIVED');
  assert.equal(resolveCompatibleGrnPostedStatus('completed'), 'COMPLETED');
  assert.equal(resolveCompatibleGrnPostedStatus('draft'), 'POSTED');
});

test('findMatchingGrnReceiveLine reuses an existing item line when the seed line has no purchase order item id', () => {
  const existingItems = [
    {
      id: 'seed-line',
      item_id: 'item-dup',
      po_item_id: null,
      quantity_expected: 50,
      unit_cost: 2,
    },
  ] as Array<Record<string, unknown>>;

  const match = findMatchingGrnReceiveLine(existingItems, {
    itemId: 'item-dup',
    poItemId: 'po-item-dup',
  });

  assert.equal(match?.id, 'seed-line');
});

test('normalizePostableGrnLines prefers accepted quantity and drops duplicate GRN seed lines', () => {
  const normalized = normalizePostableGrnLines({
    fallbackOrganizationId: 'org-dup',
    grn: {
      id: 'grn-dup',
      organization_id: 'org-dup',
      receiving_warehouse_id: 'wh-dup',
    },
    itemMastersById: new Map([
      ['item-dup', { id: 'item-dup', organization_id: 'org-dup', purchase_price: 2 }],
    ]),
    poItemsById: new Map([
      ['po-item-dup', { id: 'po-item-dup', item_id: 'item-dup', organization_id: 'org-dup', unit_price: 2 }],
    ]),
    rawLines: [
      {
        accepted_quantity: 0,
        id: 'seed-line',
        item_id: 'item-dup',
        quantity_received: 50,
        unit_cost: 2,
        warehouse_id: 'wh-dup',
      },
      {
        accepted_quantity: 50,
        id: 'receive-line',
        item_id: 'item-dup',
        po_item_id: 'po-item-dup',
        quantity_received: 50,
        unit_cost: 2,
        warehouse_id: 'wh-dup',
      },
    ],
  });

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0]?.lineId, 'receive-line');
  assert.equal(normalized[0]?.purchaseOrderItemId, 'po-item-dup');
  assert.equal(normalized[0]?.quantity, 50);
});

test('postGoodsReceivedNoteToInventory posts duplicate GRN lines once and recovers from duplicate movement guard', async () => {
  const noteUpdates: Array<Record<string, unknown>> = [];
  const poItemUpdates: Array<Record<string, unknown>> = [];
  const stockBalanceInserts: Array<Record<string, unknown>> = [];
  const movementInsertAttempts: Array<Record<string, unknown>> = [];
  let movementLookupCount = 0;

  const service = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              if (table === 'goods_received_notes') {
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(column, 'organization_id');
                    assert.equal(nextColumn, 'id');
                    assert.equal(nextValue, 'grn-dup');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'grn-dup',
                            organization_id: 'org-dup',
                            status: 'DRAFT',
                            quality_status: 'APPROVED',
                            receiving_warehouse_id: 'wh-dup',
                            purchase_order_id: 'po-dup',
                            notes: 'Approved',
                            approval_notes: 'Approved',
                            stock_posted: false,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                  maybeSingle() {
                    assert.equal(value, 'grn-dup');
                    return Promise.resolve({
                      data: {
                        id: 'grn-dup',
                        organization_id: 'org-dup',
                        status: 'DRAFT',
                        quality_status: 'APPROVED',
                        receiving_warehouse_id: 'wh-dup',
                        purchase_order_id: 'po-dup',
                        notes: 'Approved',
                        approval_notes: 'Approved',
                        stock_posted: false,
                      },
                      error: null,
                    });
                  },
                };
              }

              if (table === 'goods_received_note_items') {
                assert.equal(column, 'grn_id');
                assert.equal(value, 'grn-dup');
                return Promise.resolve({
                  data: [
                    {
                      accepted_quantity: 0,
                      id: 'seed-line',
                      item_id: 'item-dup',
                      po_item_id: null,
                      quantity_received: 50,
                      unit_cost: 2,
                      warehouse_id: 'wh-dup',
                    },
                    {
                      accepted_quantity: 50,
                      id: 'receive-line',
                      item_id: 'item-dup',
                      po_item_id: 'po-item-dup',
                      quantity_received: 50,
                      unit_cost: 2,
                      warehouse_id: 'wh-dup',
                    },
                  ],
                  error: null,
                });
              }

              if (table === 'stock_movements' && columns === '*') {
                assert.equal(column, 'source_document_type');
                assert.equal(value, 'GRN');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'source_document_id');
                    assert.equal(nextValue, 'grn-dup');
                    return {
                      eq(finalColumn: string, finalValue: string) {
                        assert.equal(finalColumn, 'item_id');
                        assert.equal(finalValue, 'item-dup');
                        return {
                          eq(lastColumn: string, lastValue: string) {
                            assert.equal(lastColumn, 'warehouse_id');
                            assert.equal(lastValue, 'wh-dup');
                            return {
                              limit(limitValue: number) {
                                assert.equal(limitValue, 1);
                                movementLookupCount += 1;
                                return Promise.resolve({
                                  data: movementLookupCount >= 2 ? [{ id: 'move-existing', item_id: 'item-dup' }] : [],
                                  error: null,
                                });
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              }

              if (table === 'stock_balances') {
                assert.equal(column, 'item_id');
                assert.equal(value, 'item-dup');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'warehouse_id');
                    assert.equal(nextValue, 'wh-dup');
                    return {
                      maybeSingle() {
                        return Promise.resolve({ data: null, error: null });
                      },
                    };
                  },
                };
              }

              if (table === 'purchase_order_items' && columns === '*') {
                if (column === 'purchase_order_id') {
                  assert.equal(value, 'po-dup');
                  return Promise.resolve({
                    data: [{ id: 'po-item-dup', item_id: 'item-dup', unit_price: 2, unit_cost: 2, quantity_ordered: 50, quantity_received: 0 }],
                    error: null,
                  });
                }
                if (column === 'id') {
                  assert.equal(value, 'po-item-dup');
                  return {
                    maybeSingle() {
                      return Promise.resolve({
                        data: { id: 'po-item-dup', quantity_received: 0 },
                        error: null,
                      });
                    },
                  };
                }
              }

              throw new Error(`Unhandled select().eq() for ${table} ${columns}`);
            },
            in(column: string, values: string[]) {
              if (table === 'purchase_order_items') {
                assert.equal(column, 'id');
                assert.deepEqual(values, ['po-item-dup']);
                return Promise.resolve({
                  data: [{ id: 'po-item-dup', item_id: 'item-dup', unit_price: 2, unit_cost: 2, quantity_ordered: 50, quantity_received: 0, organization_id: 'org-dup' }],
                  error: null,
                });
              }
              if (table === 'items') {
                assert.equal(column, 'id');
                assert.deepEqual(values, ['item-dup']);
                return Promise.resolve({
                  data: [{ id: 'item-dup', purchase_price: 2, organization_id: 'org-dup' }],
                  error: null,
                });
              }
              throw new Error(`Unhandled select().in() for ${table} ${columns}`);
            },
            or(filter: string) {
              if (table !== 'stock_movements') {
                throw new Error(`Unhandled select().or() for ${table}`);
              }
              assert.equal(filter, 'reference_id.eq.grn-dup,source_document_id.eq.grn-dup');
              return {
                limit(limitValue: number) {
                  assert.equal(limitValue, 1);
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          if (table === 'stock_balances') {
            stockBalanceInserts.push(payload);
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      data: { id: 'bal-dup', quantity_on_hand: 50, ...payload },
                      error: null,
                    });
                  },
                };
              },
            };
          }

          if (table === 'stock_movements') {
            movementInsertAttempts.push(payload);
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      data: null,
                      error: {
                        message: 'duplicate key value violates unique constraint "idx_stock_movements_reference_guard"',
                      },
                    });
                  },
                };
              },
            };
          }

          throw new Error(`Unhandled insert for ${table}`);
        },
        update(payload: Record<string, unknown>) {
          if (table === 'goods_received_notes') {
            noteUpdates.push(payload);
          }
          if (table === 'purchase_order_items') {
            poItemUpdates.push(payload);
          }
          return {
            eq() {
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({ data: { id: `${table}-dup`, ...payload }, error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await postGoodsReceivedNoteToInventory(service as any, {
    grnId: 'grn-dup',
    organizationId: 'org-dup',
    userId: 'user-dup',
  });

  assert.equal(stockBalanceInserts.length, 1);
  assert.equal(stockBalanceInserts[0]?.quantity_on_hand, 50);
  assert.equal(movementInsertAttempts.length, 1);
  assert.equal(movementInsertAttempts[0]?.quantity, 50);
  assert.equal(movementLookupCount, 2);
  assert.equal(poItemUpdates.length, 1);
  assert.equal(noteUpdates.some((payload) => payload.stock_posted === true), true);
  assert.equal(result.stock_posted, true);
});

test('postGoodsReceivedNoteToInventory prefers POSTED, falls back safely, and records GRN stock movement', async () => {
  const noteUpdates: Array<Record<string, unknown>> = [];
  const movementInserts: Array<Record<string, unknown>> = [];
  const stockBalanceInserts: Array<Record<string, unknown>> = [];
  const poItemUpdates: Array<Record<string, unknown>> = [];
  let stockMovementExists = false;

  const service = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              if (table === 'goods_received_notes') {
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(column, 'organization_id');
                    assert.equal(nextColumn, 'id');
                    assert.equal(nextValue, 'grn-1');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'grn-1',
                            organization_id: 'org-header-1',
                            status: 'DRAFT',
                            quality_status: 'APPROVED',
                            warehouse_id: 'wh-1',
                            receiving_warehouse_id: 'wh-1',
                            purchase_order_id: 'po-1',
                            notes: 'Approved',
                            approval_notes: 'Approved',
                            stock_posted: false,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                  maybeSingle() {
                    assert.equal(value, 'grn-1');
                    return Promise.resolve({
                      data: {
                        id: 'grn-1',
                        organization_id: 'org-header-1',
                        status: 'DRAFT',
                        quality_status: 'APPROVED',
                        warehouse_id: 'wh-1',
                        receiving_warehouse_id: 'wh-1',
                        purchase_order_id: 'po-1',
                        notes: 'Approved',
                        approval_notes: 'Approved',
                        stock_posted: false,
                      },
                      error: null,
                    });
                  },
                };
              }

              if (table === 'goods_received_note_items') {
                assert.equal(column, 'grn_id');
                assert.equal(value, 'grn-1');
                return Promise.resolve({
                  data: [
                    {
                      id: 'grn-line-1',
                      item_id: 'item-1',
                      purchase_order_item_id: 'po-item-1',
                      quantity_received: 50,
                      quantity_rejected: 0,
                      unit_cost: 2.5,
                      warehouse_id: 'wh-1',
                      batch_number: null,
                    },
                  ],
                  error: null,
                });
              }

              if (table === 'stock_movements' && columns === '*') {
                assert.equal(column, 'source_document_type');
                assert.equal(value, 'GRN');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'source_document_id');
                    assert.equal(nextValue, 'grn-1');
                    return {
                      eq(finalColumn: string, finalValue: string) {
                        assert.equal(finalColumn, 'item_id');
                        assert.equal(finalValue, 'item-1');
                        return {
                          eq(lastColumn: string, lastValue: string) {
                            assert.equal(lastColumn, 'warehouse_id');
                            assert.equal(lastValue, 'wh-1');
                            return {
                              limit(limitValue: number) {
                                assert.equal(limitValue, 1);
                                return Promise.resolve({
                                  data: stockMovementExists ? [{ id: 'move-1' }] : [],
                                  error: null,
                                });
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              }

              if (table === 'stock_balances') {
                assert.equal(column, 'item_id');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'warehouse_id');
                    assert.equal(nextValue, 'wh-1');
                    return {
                      maybeSingle() {
                        return Promise.resolve({ data: null, error: null });
                      },
                    };
                  },
                };
              }

              if (table === 'items' && columns.includes('deleted_at')) {
                assert.equal(column, 'id');
                return {
                  is(nextColumn: string, nextValue: null) {
                    assert.equal(nextColumn, 'deleted_at');
                    assert.equal(nextValue, null);
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'item-1',
                            code: 'RAW-1',
                            name: 'Raw Item',
                            item_type: 'RAW_MATERIAL',
                            unit_cost: 2.5,
                            organization_id: 'org-1',
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              }

              if (table === 'purchase_order_items' && columns === 'id, quantity_received') {
                assert.equal(column, 'id');
                assert.equal(value, 'po-item-1');
                return {
                  maybeSingle() {
                    return Promise.resolve({
                      data: { id: 'po-item-1', quantity_received: 0 },
                      error: null,
                    });
                  },
                };
              }

              if (table === 'purchase_order_items' && columns === 'quantity_ordered, quantity_received') {
                assert.equal(column, 'purchase_order_id');
                assert.equal(value, 'po-1');
                    return Promise.resolve({
                      data: [{ quantity_ordered: 50, quantity_received: 50 }],
                      error: null,
                    });
              }

              if (table === 'purchase_order_items' && columns === '*') {
                if (column === 'purchase_order_id') {
                  assert.equal(value, 'po-1');
                  return Promise.resolve({
                    data: [{ id: 'po-item-1', unit_price: 2.5, unit_cost: 2.5, quantity_ordered: 50, quantity_received: 50 }],
                    error: null,
                  });
                }
                if (column === 'id') {
                  assert.equal(value, 'po-item-1');
                  return {
                    maybeSingle() {
                      return Promise.resolve({
                        data: { id: 'po-item-1', quantity_received: 0 },
                        error: null,
                      });
                    },
                  };
                }
              }

              throw new Error(`Unhandled select().eq() for ${table} ${columns}`);
            },
            in(column: string, values: string[]) {
              if (table === 'purchase_order_items') {
                assert.equal(column, 'id');
                assert.deepEqual(values, ['po-item-1']);
                return Promise.resolve({
                  data: [{ id: 'po-item-1', unit_price: 2.5, unit_cost: 2.5 }],
                  error: null,
                });
              }
              if (table === 'items') {
                assert.equal(column, 'id');
                assert.deepEqual(values, ['item-1']);
                return Promise.resolve({
                  data: [{ id: 'item-1', purchase_price: 2.5 }],
                  error: null,
                });
              }
              throw new Error(`Unhandled select().in() for ${table} ${columns}`);
            },
            or(filter: string) {
              if (table !== 'stock_movements') {
                throw new Error(`Unhandled select().or() for ${table}`);
              }
              assert.equal(filter, 'reference_id.eq.grn-1,source_document_id.eq.grn-1');
              return {
                limit(limitValue: number) {
                  assert.equal(limitValue, 1);
                  return Promise.resolve({
                    data: stockMovementExists ? [{ id: 'move-1' }] : [],
                    error: null,
                  });
                },
              };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          if (table === 'stock_balances') {
            stockBalanceInserts.push(payload);
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      data: { id: 'bal-1', ...payload },
                      error: null,
                    });
                  },
                };
              },
            };
          }

          if (table === 'stock_movements') {
            movementInserts.push(payload);
            stockMovementExists = true;
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      data: { id: 'move-1', ...payload },
                      error: null,
                    });
                  },
                };
              },
            };
          }

          throw new Error(`Unhandled insert for ${table}`);
        },
        update(payload: Record<string, unknown>) {
          if (table === 'goods_received_notes') {
            noteUpdates.push(payload);
            return {
              eq(column: string, value: string) {
                assert.equal(column, 'id');
                assert.equal(value, 'grn-1');
                return {
                  select() {
                    return {
                      single() {
                        if (payload.status === 'POSTED') {
                          return Promise.resolve({
                            data: null,
                            error: { message: 'invalid input value for enum grn_status: "POSTED"' },
                          });
                        }
                        return Promise.resolve({
                          data: { id: 'grn-1', status: payload.status ?? 'DRAFT', stock_posted: payload.stock_posted ?? true },
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          }

          if (table === 'purchase_order_items') {
            poItemUpdates.push(payload);
            return {
              eq(column: string, value: string) {
                assert.equal(column, 'id');
                assert.equal(value, 'po-item-1');
                return {
                  select() {
                    return {
                      single() {
                        return Promise.resolve({
                          data: { id: 'po-item-1', ...payload },
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          }

          if (table === 'purchase_orders') {
            return {
              eq(column: string, value: string) {
                assert.equal(column, 'id');
                assert.equal(value, 'po-1');
                return {
                  select() {
                    return {
                      single() {
                        return Promise.resolve({
                          data: { id: 'po-1', ...payload },
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          }

          throw new Error(`Unhandled update for ${table}`);
        },
      };
    },
  };

  const result = await postGoodsReceivedNoteToInventory(service as any, {
    grnId: 'grn-1',
    organizationId: 'org-1',
    userId: 'user-1',
  });

  assert.equal(noteUpdates.some((payload) => payload.status === 'APPROVED'), false);
  assert.equal(noteUpdates.some((payload) => payload.status === 'POSTED'), true);
  assert.equal(noteUpdates.some((payload) => payload.status === 'RECEIVED'), true);
  assert.equal(result.status, 'RECEIVED');
  assert.equal(stockBalanceInserts.length, 1);
  assert.equal(poItemUpdates.length, 1);
  assert.equal(movementInserts.length, 1);
  assert.equal(stockBalanceInserts[0]?.organization_id, 'org-header-1');
  assert.equal(stockBalanceInserts[0]?.total_value, 125);
  assert.equal(movementInserts[0]?.organization_id, 'org-header-1');
  assert.equal(movementInserts[0]?.source_document_type, 'GRN');
  assert.equal(movementInserts[0]?.source_document_id, 'grn-1');
  assert.equal(movementInserts[0]?.reference_type, 'goods_received_note');
  assert.equal(movementInserts[0]?.unit_cost, 2.5);
  assert.equal(movementInserts[0]?.total_value, 125);
  assert.equal(noteUpdates.some((payload) => payload.inventory_value_posted === 125), true);
});

test('postGoodsReceivedNoteToInventory remains idempotent when stock movement already exists', async () => {
  const noteUpdates: Array<Record<string, unknown>> = [];

  const service = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              if (table === 'goods_received_notes') {
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(column, 'organization_id');
                    assert.equal(nextColumn, 'id');
                    assert.equal(nextValue, 'grn-2');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'grn-2',
                            organization_id: 'org-1',
                            status: 'RECEIVED',
                            quality_status: 'APPROVED',
                            warehouse_id: 'wh-1',
                            receiving_warehouse_id: 'wh-1',
                            notes: 'Approved',
                            approval_notes: 'Approved',
                            stock_posted: false,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              }

              if (table === 'goods_received_note_items') {
                assert.equal(column, 'grn_id');
                assert.equal(value, 'grn-2');
                return Promise.resolve({
                  data: [
                    {
                      id: 'line-2',
                      item_id: 'item-2',
                      quantity_received: 50,
                      unit_cost: 2,
                      warehouse_id: 'wh-1',
                    },
                  ],
                  error: null,
                });
              }

              if (table === 'stock_movements' && columns === '*') {
                assert.equal(column, 'source_document_type');
                assert.equal(value, 'GRN');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'source_document_id');
                    assert.equal(nextValue, 'grn-2');
                    return {
                      eq(finalColumn: string, finalValue: string) {
                        assert.equal(finalColumn, 'item_id');
                        assert.equal(finalValue, 'item-2');
                        return {
                          eq(lastColumn: string, lastValue: string) {
                            assert.equal(lastColumn, 'warehouse_id');
                            assert.equal(lastValue, 'wh-1');
                            return {
                              limit(limitValue: number) {
                                assert.equal(limitValue, 1);
                                return Promise.resolve({
                                  data: [{ id: 'move-existing' }],
                                  error: null,
                                });
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              }

              if (table === 'items') {
                throw new Error('Item master lookup should not run when line movement already exists.');
              }

              throw new Error(`Unhandled select().eq() for ${table} ${columns}`);
            },
            in(column: string, values: string[]) {
              if (table === 'items') {
                assert.equal(column, 'id');
                assert.deepEqual(values, ['item-2']);
                return Promise.resolve({
                  data: [{ id: 'item-2', organization_id: 'org-1', unit_cost: 2 }],
                  error: null,
                });
              }
              throw new Error(`Unhandled select().in() for ${table} ${columns}`);
            },
            or(filter: string) {
              if (table !== 'stock_movements') {
                throw new Error(`Unhandled select().or() for ${table}`);
              }
              assert.equal(filter, 'reference_id.eq.grn-2,source_document_id.eq.grn-2');
              return {
                limit(limitValue: number) {
                  assert.equal(limitValue, 1);
                  return Promise.resolve({
                    data: [{ id: 'move-existing' }],
                    error: null,
                  });
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          if (table !== 'goods_received_notes') {
            throw new Error(`Unhandled update for ${table}`);
          }
          noteUpdates.push(payload);
          return {
            eq(column: string, value: string) {
              assert.equal(column, 'id');
              assert.equal(value, 'grn-2');
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({
                        data: { id: 'grn-2', status: payload.status ?? 'RECEIVED', stock_posted: payload.stock_posted ?? true },
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await postGoodsReceivedNoteToInventory(service as any, {
    grnId: 'grn-2',
    organizationId: 'org-1',
    userId: 'user-1',
  });

  assert.equal(noteUpdates.length, 1);
  assert.equal(noteUpdates[0]?.stock_posted, true);
  assert.equal(noteUpdates[0]?.status, 'RECEIVED');
  assert.equal(result.status, 'RECEIVED');
});

test('postGoodsReceivedNoteToInventory resolves warehouse from warehouse_id when receiving warehouse is absent', async () => {
  const stockBalanceInserts: Array<Record<string, unknown>> = [];

  const service = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              if (table === 'goods_received_notes') {
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(column, 'organization_id');
                    assert.equal(nextColumn, 'id');
                    assert.equal(nextValue, 'grn-3');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'grn-3',
                            status: 'DRAFT',
                            quality_status: 'APPROVED',
                            warehouse_id: 'wh-main',
                            purchase_order_id: null,
                            stock_posted: false,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              }

              if (table === 'goods_received_note_items') {
                assert.equal(column, 'grn_id');
                assert.equal(value, 'grn-3');
                return Promise.resolve({
                  data: [
                    {
                      id: 'line-3',
                      item_id: 'item-3',
                      quantity_received: 10,
                      unit_cost: 4,
                    },
                  ],
                  error: null,
                });
              }

              if (table === 'stock_movements' && columns === '*') {
                assert.equal(column, 'source_document_type');
                assert.equal(value, 'GRN');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'source_document_id');
                    assert.equal(nextValue, 'grn-3');
                    return {
                      eq(finalColumn: string, finalValue: string) {
                        assert.equal(finalColumn, 'item_id');
                        assert.equal(finalValue, 'item-3');
                        return {
                          eq(lastColumn: string, lastValue: string) {
                            assert.equal(lastColumn, 'warehouse_id');
                            assert.equal(lastValue, 'wh-main');
                            return {
                              limit(limitValue: number) {
                                assert.equal(limitValue, 1);
                                return Promise.resolve({ data: [], error: null });
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              }

              if (table === 'stock_balances') {
                assert.equal(column, 'item_id');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'warehouse_id');
                    assert.equal(nextValue, 'wh-main');
                    return {
                      maybeSingle() {
                        return Promise.resolve({ data: null, error: null });
                      },
                    };
                  },
                };
              }

              throw new Error(`Unhandled select().eq() for ${table} ${columns}`);
            },
            in(column: string, values: string[]) {
              if (table === 'items') {
                assert.equal(column, 'id');
                assert.deepEqual(values, ['item-3']);
                return Promise.resolve({
                  data: [{ id: 'item-3', unit_cost: 4 }],
                  error: null,
                });
              }
              throw new Error(`Unhandled select().in() for ${table} ${columns}`);
            },
            or() {
              return {
                limit() {
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          if (table === 'stock_balances') {
            stockBalanceInserts.push(payload);
          }
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: { id: `${table}-1`, ...payload }, error: null });
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          return {
            eq() {
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({ data: { id: `${table}-1`, ...payload }, error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  await postGoodsReceivedNoteToInventory(service as any, {
    grnId: 'grn-3',
    organizationId: 'org-1',
    userId: 'user-1',
  });

  assert.equal(stockBalanceInserts.length, 1);
  assert.equal(stockBalanceInserts[0]?.warehouse_id, 'wh-main');
});

test('postGoodsReceivedNoteToInventory resolves item_id from linked purchase order item when GRN line item_id is missing', async () => {
  const movementInserts: Array<Record<string, unknown>> = [];

  const service = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              if (table === 'goods_received_notes') {
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(column, 'organization_id');
                    assert.equal(nextColumn, 'id');
                    assert.equal(nextValue, 'grn-4');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'grn-4',
                            status: 'DRAFT',
                            quality_status: 'APPROVED',
                            receiving_warehouse_id: 'wh-4',
                            purchase_order_id: 'po-4',
                            stock_posted: false,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              }

              if (table === 'goods_received_note_items') {
                assert.equal(column, 'grn_id');
                assert.equal(value, 'grn-4');
                return Promise.resolve({
                  data: [
                    {
                      id: 'line-4',
                      purchase_order_item_id: 'po-item-4',
                      quantity_received: 5,
                      unit_cost: 3,
                    },
                  ],
                  error: null,
                });
              }

              if (table === 'stock_movements' && columns === '*') {
                assert.equal(column, 'source_document_type');
                assert.equal(value, 'GRN');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'source_document_id');
                    assert.equal(nextValue, 'grn-4');
                    return {
                      eq(finalColumn: string, finalValue: string) {
                        assert.equal(finalColumn, 'item_id');
                        assert.equal(finalValue, 'item-4');
                        return {
                          eq(lastColumn: string, lastValue: string) {
                            assert.equal(lastColumn, 'warehouse_id');
                            assert.equal(lastValue, 'wh-4');
                            return {
                              limit(limitValue: number) {
                                assert.equal(limitValue, 1);
                                return Promise.resolve({ data: [], error: null });
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              }

              if (table === 'stock_balances') {
                return {
                  eq() {
                    return {
                      maybeSingle() {
                        return Promise.resolve({ data: null, error: null });
                      },
                    };
                  },
                };
              }

              if (table === 'purchase_order_items' && columns === '*') {
                if (column === 'purchase_order_id') {
                  assert.equal(value, 'po-4');
                  return Promise.resolve({
                    data: [{ id: 'po-item-4', item_id: 'item-4', unit_price: 3, quantity_ordered: 5, quantity_received: 0 }],
                    error: null,
                  });
                }
                if (column === 'id') {
                  assert.equal(value, 'po-item-4');
                  return {
                    maybeSingle() {
                      return Promise.resolve({
                        data: { id: 'po-item-4', quantity_received: 0 },
                        error: null,
                      });
                    },
                  };
                }
              }

              throw new Error(`Unhandled select().eq() for ${table} ${columns}`);
            },
            in(column: string, values: string[]) {
              if (table === 'purchase_order_items') {
                assert.equal(column, 'id');
                assert.deepEqual(values, ['po-item-4']);
                return Promise.resolve({
                  data: [{ id: 'po-item-4', item_id: 'item-4', unit_price: 3, quantity_ordered: 5, quantity_received: 0 }],
                  error: null,
                });
              }
              if (table === 'items') {
                assert.equal(column, 'id');
                assert.deepEqual(values, ['item-4']);
                return Promise.resolve({
                  data: [{ id: 'item-4', unit_cost: 3 }],
                  error: null,
                });
              }
              throw new Error(`Unhandled select().in() for ${table} ${columns}`);
            },
            or() {
              return {
                limit() {
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          if (table === 'stock_movements') {
            movementInserts.push(payload);
          }
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: { id: `${table}-1`, ...payload }, error: null });
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          return {
            eq() {
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({ data: { id: `${table}-1`, ...payload }, error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  await postGoodsReceivedNoteToInventory(service as any, {
    grnId: 'grn-4',
    organizationId: 'org-1',
    userId: 'user-1',
  });

  assert.equal(movementInserts.length, 1);
  assert.equal(movementInserts[0]?.item_id, 'item-4');
});

test('postGoodsReceivedNoteToInventory updates existing stock balance quantity, value, and average cost when balance exists', async () => {
  const stockBalanceUpdates: Array<Record<string, unknown>> = [];

  const service = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              if (table === 'goods_received_notes') {
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(column, 'organization_id');
                    assert.equal(nextColumn, 'id');
                    assert.equal(nextValue, 'grn-5');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'grn-5',
                            status: 'DRAFT',
                            quality_status: 'APPROVED',
                            receiving_warehouse_id: 'wh-5',
                            stock_posted: false,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              }

              if (table === 'goods_received_note_items') {
                assert.equal(column, 'grn_id');
                assert.equal(value, 'grn-5');
                return Promise.resolve({
                  data: [
                    {
                      id: 'line-5',
                      item_id: 'item-5',
                      quantity_received: 50,
                      unit_cost: 2,
                    },
                  ],
                  error: null,
                });
              }

              if (table === 'stock_movements' && columns === '*') {
                assert.equal(column, 'source_document_type');
                assert.equal(value, 'GRN');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'source_document_id');
                    assert.equal(nextValue, 'grn-5');
                    return {
                      eq(finalColumn: string, finalValue: string) {
                        assert.equal(finalColumn, 'item_id');
                        assert.equal(finalValue, 'item-5');
                        return {
                          eq(lastColumn: string, lastValue: string) {
                            assert.equal(lastColumn, 'warehouse_id');
                            assert.equal(lastValue, 'wh-5');
                            return {
                              limit(limitValue: number) {
                                assert.equal(limitValue, 1);
                                return Promise.resolve({ data: [], error: null });
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              }

              if (table === 'stock_balances') {
                assert.equal(column, 'item_id');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'warehouse_id');
                    assert.equal(nextValue, 'wh-5');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'bal-5',
                            quantity_on_hand: 20,
                            quantity_available: 20,
                            quantity_reserved: 0,
                            average_cost: 1,
                            total_value: 20,
                            quantity: 20,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              }

              throw new Error(`Unhandled select().eq() for ${table} ${columns}`);
            },
            in(column: string, values: string[]) {
              if (table === 'items') {
                assert.equal(column, 'id');
                assert.deepEqual(values, ['item-5']);
                return Promise.resolve({
                  data: [{ id: 'item-5', unit_cost: 2 }],
                  error: null,
                });
              }
              throw new Error(`Unhandled select().in() for ${table} ${columns}`);
            },
            or() {
              return {
                limit() {
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: { id: `${table}-1`, ...payload }, error: null });
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          if (table === 'stock_balances') {
            stockBalanceUpdates.push(payload);
          }
          return {
            eq() {
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({ data: { id: `${table}-1`, ...payload }, error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  await postGoodsReceivedNoteToInventory(service as any, {
    grnId: 'grn-5',
    organizationId: 'org-1',
    userId: 'user-1',
  });

  assert.equal(stockBalanceUpdates.length, 1);
  assert.equal(stockBalanceUpdates[0]?.quantity_on_hand, 70);
  assert.equal(stockBalanceUpdates[0]?.total_value, 120);
  assert.equal(Math.abs(Number(stockBalanceUpdates[0]?.average_cost) - (120 / 70)) < 0.0001, true);
});

test('postGoodsReceivedNoteToInventory returns stage-specific stock balance read failures', async () => {
  const service = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              if (table === 'goods_received_notes') {
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(column, 'organization_id');
                    assert.equal(nextColumn, 'id');
                    assert.equal(nextValue, 'grn-6');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'grn-6',
                            status: 'DRAFT',
                            quality_status: 'APPROVED',
                            receiving_warehouse_id: 'wh-6',
                            stock_posted: false,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              }

              if (table === 'goods_received_note_items') {
                assert.equal(column, 'grn_id');
                assert.equal(value, 'grn-6');
                return Promise.resolve({
                  data: [
                    {
                      id: 'line-6',
                      item_id: 'item-6',
                      quantity_received: 10,
                      unit_cost: 2,
                    },
                  ],
                  error: null,
                });
              }

              if (table === 'stock_movements' && columns === '*') {
                assert.equal(column, 'source_document_type');
                assert.equal(value, 'GRN');
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(nextColumn, 'source_document_id');
                    assert.equal(nextValue, 'grn-6');
                    return {
                      eq(finalColumn: string, finalValue: string) {
                        assert.equal(finalColumn, 'item_id');
                        assert.equal(finalValue, 'item-6');
                        return {
                          eq(lastColumn: string, lastValue: string) {
                            assert.equal(lastColumn, 'warehouse_id');
                            assert.equal(lastValue, 'wh-6');
                            return {
                              limit(limitValue: number) {
                                assert.equal(limitValue, 1);
                                return Promise.resolve({ data: [], error: null });
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              }

              if (table === 'stock_balances') {
                return {
                  eq() {
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: null,
                          error: { message: 'permission denied for table stock_balances' },
                        });
                      },
                    };
                  },
                };
              }

              throw new Error(`Unhandled select().eq() for ${table} ${columns}`);
            },
            in(column: string, values: string[]) {
              if (table === 'items') {
                assert.equal(column, 'id');
                assert.deepEqual(values, ['item-6']);
                return Promise.resolve({
                  data: [{ id: 'item-6', unit_cost: 2 }],
                  error: null,
                });
              }
              throw new Error(`Unhandled select().in() for ${table} ${columns}`);
            },
            or() {
              return {
                limit() {
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  try {
    await postGoodsReceivedNoteToInventory(service as any, {
      grnId: 'grn-6',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    assert.fail('Expected postGoodsReceivedNoteToInventory to throw.');
  } catch (error) {
    assert.equal(isGrnStockPostingError(error), true);
    assert.equal((error as { details?: { stage?: string } }).details?.stage, 'GRN_STOCK_BALANCE_READ_FAILED');
  }
});

test('createOrUpdateStockBalance retries down to a minimal insert payload when optional columns fail', async () => {
  const insertPayloads: Array<Record<string, unknown>> = [];

  const service = {
    from(table: string) {
      assert.equal(table, 'stock_balances');
      return {
        select(columns?: string) {
          if (columns !== undefined) {
            assert.equal(columns, '*');
          }
          return {
            eq(column: string, value: string) {
              assert.equal(column, 'item_id');
              assert.equal(value, 'item-7');
              return {
                eq(nextColumn: string, nextValue: string) {
                  assert.equal(nextColumn, 'warehouse_id');
                  assert.equal(nextValue, 'wh-7');
                  return {
                    maybeSingle() {
                      return Promise.resolve({ data: null, error: null });
                    },
                  };
                },
              };
            },
            single() {
              return Promise.resolve({ data: { id: 'bal-7' }, error: null });
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          insertPayloads.push({ ...payload });
          return {
            select() {
              return {
                single() {
                  for (const optionalColumn of [
                    'quantity_available',
                    'average_cost',
                    'total_value',
                    'updated_at',
                  ]) {
                    if (optionalColumn in payload) {
                      return Promise.resolve({
                        data: null,
                        error: { message: `column stock_balances.${optionalColumn} does not exist` },
                      });
                    }
                  }

                  return Promise.resolve({
                    data: { id: 'bal-7', ...payload },
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await createOrUpdateStockBalance(service as any, {
    grnId: 'grn-7',
    itemId: 'item-7',
    organizationId: 'org-7',
    quantity: 50,
    receivedValue: 0,
    unitCost: 0,
    warehouseId: 'wh-7',
  });

  assert.equal(String(result.id), 'bal-7');
  assert.equal(insertPayloads.length > 1, true);
  assert.deepEqual(
    Object.keys(insertPayloads[0] ?? {}).sort(),
    ['average_cost', 'item_id', 'organization_id', 'quantity_available', 'quantity_on_hand', 'total_value', 'updated_at', 'warehouse_id'],
  );
  assert.equal(insertPayloads.some((payload) => 'balance_quantity' in payload), false);
  assert.deepEqual(
    Object.keys(insertPayloads.at(-1) ?? {}).sort(),
    ['item_id', 'organization_id', 'quantity_on_hand', 'warehouse_id'],
  );
  assert.equal(insertPayloads.every((payload) => payload.organization_id === 'org-7'), true);
});

test('createOrUpdateStockBalance handles PostgREST schema-cache missing-column messages while retrying inserts', async () => {
  const insertPayloads: Array<Record<string, unknown>> = [];

  const service = {
    from(table: string) {
      assert.equal(table, 'stock_balances');
      return {
        select(columns?: string) {
          if (columns !== undefined) {
            assert.equal(columns, '*');
          }
          return {
            eq() {
              return {
                eq() {
                  return {
                    maybeSingle() {
                      return Promise.resolve({ data: null, error: null });
                    },
                  };
                },
              };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          insertPayloads.push({ ...payload });
          return {
            select() {
              return {
                single() {
                  if ('updated_at' in payload) {
                    return Promise.resolve({
                      data: null,
                      error: { message: "Could not find the 'updated_at' column of 'stock_balances' in the schema cache" },
                    });
                  }

                  return Promise.resolve({
                    data: { id: 'bal-7b', ...payload },
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await createOrUpdateStockBalance(service as any, {
    grnId: 'grn-7b',
    itemId: 'item-7b',
    organizationId: 'org-7b',
    quantity: 50,
    receivedValue: 0,
    unitCost: 0,
    warehouseId: 'wh-7b',
  });

  assert.equal(String(result.id), 'bal-7b');
  assert.equal(insertPayloads.length >= 2, true);
  assert.equal(insertPayloads.some((payload) => 'balance_quantity' in payload), false);
  assert.equal(insertPayloads.every((payload) => payload.organization_id === 'org-7b'), true);
});

test('createOrUpdateStockBalance surfaces operation and dbMessage when insert still fails', async () => {
  const service = {
    from(table: string) {
      assert.equal(table, 'stock_balances');
      return {
        select(columns?: string) {
          if (columns !== undefined) {
            assert.equal(columns, '*');
          }
          return {
            eq() {
              return {
                eq() {
                  return {
                    maybeSingle() {
                      return Promise.resolve({ data: null, error: null });
                    },
                  };
                },
              };
            },
          };
        },
        insert() {
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({
                    data: null,
                    error: { message: 'null value in column "inventory_id" violates not-null constraint' },
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    () =>
      createOrUpdateStockBalance(service as any, {
        grnId: 'grn-8',
        itemId: 'item-8',
        organizationId: 'org-8',
        quantity: 50,
        receivedValue: 0,
        unitCost: 0,
        warehouseId: 'wh-8',
      }),
    (error: unknown) => {
      assert.equal(isGrnStockPostingError(error), true);
      assert.equal((error as { details?: { operation?: string } }).details?.operation, 'insert_stock_balance');
      assert.match(String((error as { details?: { dbMessage?: string } }).details?.dbMessage ?? ''), /not-null constraint/);
      assert.equal((error as { details?: { quantity?: number } }).details?.quantity, 50);
      return true;
    },
  );
});

test('createOrUpdateStockBalance updates stock balances with only safe core write columns', async () => {
  const updatePayloads: Array<Record<string, unknown>> = [];

  const service = {
    from(table: string) {
      assert.equal(table, 'stock_balances');
      return {
        select(columns?: string) {
          if (columns !== undefined) {
            assert.equal(columns, '*');
          }
          return {
            eq(column: string, value: string) {
              assert.equal(column, 'item_id');
              assert.equal(value, 'item-8b');
              return {
                eq(nextColumn: string, nextValue: string) {
                  assert.equal(nextColumn, 'warehouse_id');
                  assert.equal(nextValue, 'wh-8b');
                  return {
                    maybeSingle() {
                      return Promise.resolve({
                        data: {
                          id: 'bal-8b',
                          quantity_on_hand: 10,
                          quantity_available: 10,
                          average_cost: 1,
                          total_value: 10,
                        },
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          updatePayloads.push({ ...payload });
          return {
            eq(column: string, value: string) {
              assert.equal(column, 'id');
              assert.equal(value, 'bal-8b');
              return {
                select() {
                  return {
                    single() {
                      if ('updated_at' in payload) {
                        return Promise.resolve({
                          data: null,
                          error: { message: "Could not find the 'updated_at' column of 'stock_balances' in the schema cache" },
                        });
                      }

                      return Promise.resolve({
                        data: { id: 'bal-8b', ...payload },
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await createOrUpdateStockBalance(service as any, {
    grnId: 'grn-8b',
    itemId: 'item-8b',
    organizationId: 'org-8b',
    quantity: 50,
    receivedValue: 0,
    unitCost: 0,
    warehouseId: 'wh-8b',
  });

  assert.equal(String(result.id), 'bal-8b');
  assert.deepEqual(
    Object.keys(updatePayloads[0] ?? {}).sort(),
    ['average_cost', 'quantity_available', 'quantity_on_hand', 'total_value', 'updated_at'],
  );
  assert.equal(updatePayloads.some((payload) => 'balance_quantity' in payload), false);
  assert.equal(updatePayloads.some((payload) => 'unit_cost' in payload), false);
});

test('postGoodsReceivedNoteToInventory returns GRN_ORGANIZATION_MISSING when no organization_id can be resolved', async () => {
  const service = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              if (table === 'goods_received_notes') {
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(column, 'organization_id');
                    assert.equal(nextColumn, 'id');
                    assert.equal(nextValue, 'grn-org-missing');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'grn-org-missing',
                            status: 'DRAFT',
                            receiving_warehouse_id: 'wh-org-missing',
                            stock_posted: false,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              }

              if (table === 'goods_received_note_items') {
                assert.equal(column, 'grn_id');
                assert.equal(value, 'grn-org-missing');
                return Promise.resolve({
                  data: [
                    {
                      id: 'line-org-missing',
                      item_id: 'item-org-missing',
                      quantity_received: 50,
                      unit_cost: 0,
                    },
                  ],
                  error: null,
                });
              }

              if (table === 'stock_balances') {
                return {
                  eq() {
                    return {
                      maybeSingle() {
                        return Promise.resolve({ data: null, error: null });
                      },
                    };
                  },
                };
              }

              throw new Error(`Unhandled select().eq() for ${table} ${columns}`);
            },
            in(column: string, values: string[]) {
              if (table === 'items') {
                assert.equal(column, 'id');
                assert.deepEqual(values, ['item-org-missing']);
                return Promise.resolve({
                  data: [{ id: 'item-org-missing', unit_cost: 0 }],
                  error: null,
                });
              }
              throw new Error(`Unhandled select().in() for ${table} ${columns}`);
            },
            or() {
              return {
                limit() {
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    () =>
      postGoodsReceivedNoteToInventory(service as any, {
        grnId: 'grn-org-missing',
        organizationId: '',
        userId: 'user-1',
      }),
    (error: unknown) => {
      assert.equal(isGrnStockPostingError(error), true);
      assert.equal((error as { details?: { stage?: string } }).details?.stage, 'GRN_ORGANIZATION_MISSING');
      assert.equal((error as { details?: { operation?: string } }).details?.operation, 'resolve_organization_id');
      return true;
    },
  );
});

test('fetchGoodsReceivedNoteDetail loads GRN header and items separately without embed ambiguity', async () => {
  const selects: Array<{ columns: string; table: string }> = [];
  const detail = await fetchGoodsReceivedNoteDetail({
    from(table: string) {
      return {
        select(columns: string) {
          selects.push({ columns, table });
          return {
            eq(column: string, value: string) {
              if (table === 'goods_received_notes') {
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(column, 'organization_id');
                    assert.equal(value, 'org-detail');
                    assert.equal(nextColumn, 'id');
                    assert.equal(nextValue, 'grn-detail');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'grn-detail',
                            grn_number: 'GRN-00077',
                            purchase_order_id: 'po-detail',
                            receiving_warehouse_id: 'wh-detail',
                            status: 'RECEIVED',
                            stock_posted: false,
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              }

              if (table === 'goods_received_note_items') {
                assert.equal(column, 'grn_id');
                assert.equal(value, 'grn-detail');
                return Promise.resolve({
                  data: [
                    {
                      id: 'line-detail',
                      goods_received_note_id: 'grn-detail',
                      purchase_order_item_id: 'po-line-detail',
                      item_id: 'item-detail',
                      quantity_received: 50,
                      unit_cost: 4,
                      line_total: 200,
                    },
                  ],
                  error: null,
                });
              }

              throw new Error(`Unhandled select().eq() for ${table} ${columns}`);
            },
          };
        },
      };
    },
  } as any, {
    grnId: 'grn-detail',
    organizationId: 'org-detail',
  });

  assert.equal(selects[0]?.table, 'goods_received_notes');
  assert.equal(selects[0]?.columns, '*');
  assert.equal(selects[1]?.table, 'goods_received_note_items');
  assert.equal(selects[1]?.columns, '*');
  assert.equal(detail.grnNumber, 'GRN-00077');
  assert.equal(detail.purchaseOrderId, 'po-detail');
  assert.equal(detail.receivingWarehouseId, 'wh-detail');
  assert.equal(detail.items.length, 1);
  assert.equal(detail.lineItems[0]?.goods_received_note_id, 'grn-detail');
  assert.equal(detail.lineItems[0]?.purchaseOrderItemId, 'po-line-detail');
  assert.equal(detail.lineItems[0]?.quantityReceived, 50);
});

test('fetchGoodsReceivedNoteDetail still returns header data when item loading fails', async () => {
  const detail = await fetchGoodsReceivedNoteDetail({
    from(table: string) {
      return {
        select() {
          return {
            eq(column: string, value: string) {
              if (table === 'goods_received_notes') {
                return {
                  eq(nextColumn: string, nextValue: string) {
                    assert.equal(column, 'organization_id');
                    assert.equal(value, 'org-9');
                    assert.equal(nextColumn, 'id');
                    assert.equal(nextValue, 'grn-9');
                    return {
                      maybeSingle() {
                        return Promise.resolve({
                          data: {
                            id: 'grn-9',
                            grn_number: 'GRN-00009',
                            warehouse_id: 'wh-9',
                            status: 'DRAFT',
                          },
                          error: null,
                        });
                      },
                    };
                  },
                };
              }

              if (table === 'goods_received_note_items' || table === 'grn_items') {
                return Promise.resolve({
                  data: null,
                  error: { message: `permission denied for table ${table}` },
                });
              }

              throw new Error(`Unhandled select().eq() for ${table}`);
            },
          };
        },
      };
    },
  } as any, {
    grnId: 'grn-9',
    organizationId: 'org-9',
  });

  assert.equal((detail as Record<string, unknown>).id, 'grn-9');
  assert.deepEqual(detail.items, []);
  assert.deepEqual(detail.line_items, []);
  assert.deepEqual(detail.lineItems, []);
});

test('procurement requisitions, purchase orders, and GRNs use the shared item selector controls', () => {
  const requisitionsPage = fs.readFileSync('src/app/(dashboard)/procurement/requisitions/page.tsx', 'utf8');
  const purchaseOrdersPage = fs.readFileSync('src/app/(dashboard)/procurement/purchase-orders/page.tsx', 'utf8');
  const goodsReceivedPage = fs.readFileSync('src/app/(dashboard)/procurement/goods-received/page.tsx', 'utf8');

  for (const page of [requisitionsPage, purchaseOrdersPage, goodsReceivedPage]) {
    assert.match(page, /useItemSelectorOptions/);
    assert.match(page, /ItemSelectorField/);
  }

  assert.match(goodsReceivedPage, /Select a warehouse first\./);
  assert.match(purchaseOrdersPage, /Search item/);
});
