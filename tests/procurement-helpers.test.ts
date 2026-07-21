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
  normalizeGoodsReceivedItemId,
  normalizeGoodsReceivedPurchaseOrderId,
  normalizeGoodsReceivedUnitOfMeasureId,
  normalizeGoodsReceivedWarehouseId,
} from '../src/lib/procurement-goods-received';
import {
  buildRequisitionDetailItem,
  buildRequisitionDetailLookupCandidates,
  buildRequisitionDraftPayload,
  isUuidLikeRequisitionIdentifier,
  normalizeRequisitionItemId,
  normalizeRequisitionUnitOfMeasureId,
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
