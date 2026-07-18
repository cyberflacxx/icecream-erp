"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const procurement_1 = require("../src/lib/procurement");
const procurement_purchase_orders_1 = require("../src/lib/procurement-purchase-orders");
const procurement_goods_received_1 = require("../src/lib/procurement-goods-received");
const procurement_requisitions_1 = require("../src/lib/procurement-requisitions");
const procurement_suppliers_1 = require("../src/lib/procurement-suppliers");
(0, node_test_1.default)('validateSupplierCodeUniqueness blocks duplicate supplier codes', () => {
    strict_1.default.equal((0, procurement_1.validateSupplierCodeUniqueness)(['SUP-001', 'SUP-002'], 'SUP-003'), true);
    strict_1.default.equal((0, procurement_1.validateSupplierCodeUniqueness)(['SUP-001', 'SUP-002'], 'sup-001'), false);
});
(0, node_test_1.default)('buildSupplierShortageRows calculates shortage and age', () => {
    const rows = (0, procurement_1.buildSupplierShortageRows)([
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
    strict_1.default.equal(rows.length, 1);
    strict_1.default.equal(rows[0]?.shortageQuantity, 25);
    strict_1.default.equal(rows[0]?.supplierName, 'Kefalos Cheese');
});
(0, node_test_1.default)('buildInvoiceAgeingRows derives balances from payments', () => {
    const rows = (0, procurement_1.buildInvoiceAgeingRows)([
        {
            id: 'inv-1',
            due_date: '2026-06-10',
            invoice_date: '2026-06-01',
            invoice_number: 'SINV-001',
            invoice_total: 1200,
            status: 'PENDING',
            suppliers: { name: 'Kefalos Cheese' },
        },
    ], new Map([['inv-1', 200]]));
    strict_1.default.equal(rows[0]?.balance, 1000);
    strict_1.default.equal(rows[0]?.paidAmount, 200);
});
(0, node_test_1.default)('buildCostVarianceRows returns invoice minus po unit cost', () => {
    const rows = (0, procurement_1.buildCostVarianceRows)([
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
    strict_1.default.equal(rows[0]?.priceVariance, 2);
    strict_1.default.equal(rows[0]?.quantity, 5);
});
(0, node_test_1.default)('canPayInvoice blocks overpayment', () => {
    strict_1.default.equal((0, procurement_1.canPayInvoice)(100, 50), true);
    strict_1.default.equal((0, procurement_1.canPayInvoice)(100, 150), false);
    strict_1.default.equal((0, procurement_1.canPayInvoice)(100, 0), false);
});
(0, node_test_1.default)('supplier import template csv includes the required headers', () => {
    const csv = (0, procurement_1.buildSupplierImportTemplateCsv)();
    const [headerLine] = csv.split('\n');
    strict_1.default.equal(headerLine, procurement_1.SUPPLIER_IMPORT_TEMPLATE_HEADERS.join(','));
});
(0, node_test_1.default)('supplier import validation accepts valid rows and rejects invalid ones', () => {
    const result = (0, procurement_1.validateSupplierImportRows)([
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
    strict_1.default.equal(result.rows.length, 1);
    strict_1.default.equal(result.rows[0]?.code, 'SUP-010');
    strict_1.default.equal(result.errors.length, 5);
    strict_1.default.equal(result.errors.some((error) => error.message.includes('Duplicate supplier code')), true);
    strict_1.default.equal(result.errors.some((error) => error.message.includes('Email Address is invalid')), true);
});
(0, node_test_1.default)('supplier option helpers keep active suppliers and map code/name safely', () => {
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
    ].map((row) => row);
    strict_1.default.equal((0, procurement_suppliers_1.isSupplierActive)(rows[0] ?? {}), true);
    strict_1.default.equal((0, procurement_suppliers_1.isSupplierActive)(rows[1] ?? {}), false);
    const mapped = rows.map(procurement_suppliers_1.mapSupplierOption);
    const filtered = (0, procurement_suppliers_1.filterSupplierOptions)(mapped, { activeOnly: true, search: 'cold' });
    strict_1.default.equal(filtered.length, 1);
    strict_1.default.equal(filtered[0]?.id, 'sup-1');
    strict_1.default.equal(filtered[0]?.code, 'SUP-001');
    strict_1.default.equal(filtered[0]?.contactPerson, 'Joy');
});
(0, node_test_1.default)('normalizePurchaseOrderSupplierId accepts supplier_id and supplierId', () => {
    strict_1.default.equal((0, procurement_purchase_orders_1.normalizePurchaseOrderSupplierId)({ supplier_id: ' sup-1 ' }), 'sup-1');
    strict_1.default.equal((0, procurement_purchase_orders_1.normalizePurchaseOrderSupplierId)({ supplierId: 'sup-2' }), 'sup-2');
    strict_1.default.equal((0, procurement_purchase_orders_1.normalizePurchaseOrderSupplierId)({ supplierId: 'sup-2', supplier_id: 'sup-3' }), 'sup-3');
    strict_1.default.equal((0, procurement_purchase_orders_1.normalizePurchaseOrderSupplierId)({}), '');
});
(0, node_test_1.default)('buildPurchaseOrderDraftPayload stores supplier_id canonically', () => {
    const payload = (0, procurement_purchase_orders_1.buildPurchaseOrderDraftPayload)({
        approverEmail: 'approver@example.com',
        approverName: 'Jane Approver',
        approvalNotes: 'Route through HQ buyer',
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
    strict_1.default.equal(payload.supplierId, 'sup-1');
    strict_1.default.equal(payload.supplier_id, 'sup-1');
    strict_1.default.equal(payload.approverName, 'Jane Approver');
    strict_1.default.equal(payload.approverEmail, 'approver@example.com');
    strict_1.default.equal(payload.approvalNotes, 'Route through HQ buyer');
    strict_1.default.equal(payload.items[0]?.itemId, 'item-1');
});
(0, node_test_1.default)('normalizeRequisitionItemId accepts item_id and itemId', () => {
    strict_1.default.equal((0, procurement_requisitions_1.normalizeRequisitionItemId)({ item_id: ' item-1 ' }), 'item-1');
    strict_1.default.equal((0, procurement_requisitions_1.normalizeRequisitionItemId)({ itemId: 'item-2' }), 'item-2');
    strict_1.default.equal((0, procurement_requisitions_1.normalizeRequisitionItemId)({ itemId: 'item-2', item_id: 'item-3' }), 'item-3');
    strict_1.default.equal((0, procurement_requisitions_1.normalizeRequisitionItemId)({}), '');
});
(0, node_test_1.default)('normalizeRequisitionUnitOfMeasureId accepts unit aliases', () => {
    strict_1.default.equal((0, procurement_requisitions_1.normalizeRequisitionUnitOfMeasureId)({ unit_of_measure_id: ' uom-1 ' }), 'uom-1');
    strict_1.default.equal((0, procurement_requisitions_1.normalizeRequisitionUnitOfMeasureId)({ unitOfMeasureId: 'uom-2' }), 'uom-2');
    strict_1.default.equal((0, procurement_requisitions_1.normalizeRequisitionUnitOfMeasureId)({ uom_id: 'uom-3' }), 'uom-3');
    strict_1.default.equal((0, procurement_requisitions_1.normalizeRequisitionUnitOfMeasureId)({ uomId: 'uom-4' }), 'uom-4');
    strict_1.default.equal((0, procurement_requisitions_1.normalizeRequisitionUnitOfMeasureId)({ uom: 'uom-5' }), 'uom-5');
    strict_1.default.equal((0, procurement_requisitions_1.normalizeRequisitionUnitOfMeasureId)({}), '');
});
(0, node_test_1.default)('buildRequisitionDraftPayload stores item_id canonically', () => {
    const payload = (0, procurement_requisitions_1.buildRequisitionDraftPayload)({
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
    strict_1.default.equal(payload.approverUserId, 'user-1');
    strict_1.default.equal(payload.approverName, 'Jane Approver');
    strict_1.default.equal(payload.approverEmail, 'approver@example.com');
    strict_1.default.equal(payload.approvalNotes, 'Escalate if unavailable');
    strict_1.default.equal(payload.items[0]?.itemId, 'item-1');
    strict_1.default.equal(payload.items[0]?.item_id, 'item-1');
    strict_1.default.equal(payload.items[0]?.unitOfMeasureId, 'uom-1');
    strict_1.default.equal(payload.items[0]?.unit_of_measure_id, 'uom-1');
    strict_1.default.equal(payload.department, 'Production');
});
(0, node_test_1.default)('normalizeGoodsReceivedPurchaseOrderId accepts purchase order aliases', () => {
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedPurchaseOrderId)({ purchase_order_id: ' po-1 ' }), 'po-1');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedPurchaseOrderId)({ purchaseOrderId: 'po-2' }), 'po-2');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedPurchaseOrderId)({ po_id: 'po-3' }), 'po-3');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedPurchaseOrderId)({ poId: 'po-4' }), 'po-4');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedPurchaseOrderId)({ purchaseOrderId: 'po-2', purchase_order_id: 'po-1' }), 'po-1');
});
(0, node_test_1.default)('normalizeGoodsReceivedItemId accepts item aliases', () => {
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedItemId)({ item_id: ' item-1 ' }), 'item-1');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedItemId)({ itemId: 'item-2' }), 'item-2');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedItemId)({ product_id: 'item-3' }), 'item-3');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedItemId)({ rawMaterialId: 'item-4' }), 'item-4');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedItemId)({}), '');
});
(0, node_test_1.default)('normalizeGoodsReceivedUnitOfMeasureId accepts UOM aliases', () => {
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedUnitOfMeasureId)({ unit_of_measure_id: ' uom-1 ' }), 'uom-1');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedUnitOfMeasureId)({ unitOfMeasureId: 'uom-2' }), 'uom-2');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedUnitOfMeasureId)({ uom_id: 'uom-3' }), 'uom-3');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedUnitOfMeasureId)({ uomId: 'uom-4' }), 'uom-4');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedUnitOfMeasureId)({ uom: 'uom-5' }), 'uom-5');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedUnitOfMeasureId)({}), '');
});
(0, node_test_1.default)('normalizeGoodsReceivedWarehouseId accepts warehouse aliases', () => {
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedWarehouseId)({ warehouse_id: ' wh-1 ' }), 'wh-1');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedWarehouseId)({ warehouseId: 'wh-2' }), 'wh-2');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedWarehouseId)({ receiving_warehouse_id: 'wh-3' }), 'wh-3');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedWarehouseId)({ receivingWarehouseId: 'wh-4' }), 'wh-4');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedWarehouseId)({ destination_warehouse_id: 'wh-5' }), 'wh-5');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedWarehouseId)({ destinationWarehouseId: 'wh-6' }), 'wh-6');
    strict_1.default.equal((0, procurement_goods_received_1.normalizeGoodsReceivedWarehouseId)({}), '');
});
(0, node_test_1.default)('buildGoodsReceivedDraftPayload stores purchase order, item, and UOM ids canonically', () => {
    const payload = (0, procurement_goods_received_1.buildGoodsReceivedDraftPayload)({
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
    strict_1.default.equal(payload.purchaseOrderId, 'po-1');
    strict_1.default.equal(payload.purchase_order_id, 'po-1');
    strict_1.default.equal(payload.supplierId, 'sup-1');
    strict_1.default.equal(payload.supplier_id, 'sup-1');
    strict_1.default.equal(payload.warehouseId, 'wh-1');
    strict_1.default.equal(payload.warehouse_id, 'wh-1');
    strict_1.default.equal(payload.receivingWarehouseId, 'wh-1');
    strict_1.default.equal(payload.receiving_warehouse_id, 'wh-1');
    strict_1.default.equal(payload.items[0]?.itemId, 'item-1');
    strict_1.default.equal(payload.items[0]?.item_id, 'item-1');
    strict_1.default.equal(payload.items[0]?.poItemId, 'po-item-1');
    strict_1.default.equal(payload.items[0]?.po_item_id, 'po-item-1');
    strict_1.default.equal(payload.items[0]?.unitOfMeasureId, 'uom-1');
    strict_1.default.equal(payload.items[0]?.unit_of_measure_id, 'uom-1');
    strict_1.default.equal(payload.items[0]?.uomId, 'uom-1');
});
