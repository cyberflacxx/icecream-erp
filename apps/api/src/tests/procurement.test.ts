import assert from 'node:assert/strict';
import test from 'node:test';

import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { InventoryService } from '../modules/inventory/inventory.service';
import {
  GRNStatus,
  PurchaseOrderStatus,
  PurchaseRequisitionStatus
} from '../modules/procurement/procurement.constants';
import { ProcurementService } from '../modules/procurement/procurement.service';
import { SupplierBalanceUpdateType } from '../modules/suppliers/suppliers.constants';
import { SuppliersService } from '../modules/suppliers/suppliers.service';

interface MockItem {
  deletedAt: Date | null;
  id: string;
  organizationId: string;
}

interface MockUnit {
  id: string;
  organizationId: string;
}

interface MockSupplier {
  currentBalance: Decimal;
  deletedAt: Date | null;
  id: string;
  name: string;
  organizationId: string;
}

interface MockWarehouse {
  branchId: string | null;
  id: string;
  isActive: boolean;
  name: string;
  organizationId: string;
}

interface MockRequisition {
  approvalStatus: string;
  approvedAt: Date | null;
  approvedBy: string | null;
  deletedAt: Date | null;
  department: string;
  id: string;
  neededByDate: Date | null;
  organizationId: string;
  remarks: string | null;
  requestDate: Date;
  requestedBy: string;
  requisitionNumber: string;
  status: string;
}

interface MockRequisitionItem {
  estimatedUnitCost: number | null;
  id: string;
  itemId: string;
  quantityApproved: Decimal | null;
  quantityRequested: Decimal;
  remarks: string | null;
  requisitionId: string;
  unitOfMeasureId: string;
}

interface MockPurchaseOrder {
  approvedAt: Date | null;
  approvedBy: string | null;
  createdBy: string;
  deletedAt: Date | null;
  discountAmount: Decimal;
  expectedDeliveryDate: Date | null;
  id: string;
  notes: string | null;
  orderDate: Date;
  organizationId: string;
  poNumber: string;
  requisitionId: string | null;
  status: string;
  subtotal: Decimal;
  supplierId: string;
  taxAmount: Decimal;
  total: Decimal;
}

interface MockPurchaseOrderItem {
  id: string;
  itemId: string;
  purchaseOrderId: string;
  quantityOrdered: Decimal;
  quantityReceived: Decimal;
  totalCost: Decimal;
  unitCost: Decimal;
  unitOfMeasureId: string;
}

interface MockGRN {
  deletedAt: Date | null;
  grnNumber: string;
  id: string;
  notes: string | null;
  organizationId: string;
  purchaseOrderId: string;
  qualityNotes: string | null;
  qualityStatus: string;
  receivedBy: string;
  receivedDate: Date;
  status: string;
  warehouseId: string;
}

interface MockGRNItem {
  batchNumber: string | null;
  expiryDate: Date | null;
  grnId: string;
  id: string;
  itemId: string;
  poItemId: string;
  qualityNotes: string | null;
  quantityExpected: Decimal;
  quantityReceived: Decimal;
  quantityRejected: Decimal;
  unitCost: Decimal;
}

interface MockAuditLog {
  action: string;
  entityId: string;
  entityType: string;
  id: string;
  newValues?: Prisma.InputJsonValue;
  oldValues?: Prisma.InputJsonValue;
  organizationId: string;
  userProfileId: string;
}

interface MockStockBalance {
  itemId: string;
  quantityOnHand: number;
  warehouseId: string;
}

interface MockStockMovement {
  itemId: string;
  quantity: number;
  referenceId: string;
  type: string;
  warehouseId: string;
}

interface MockState {
  auditLogs: MockAuditLog[];
  grnItems: MockGRNItem[];
  grns: MockGRN[];
  items: MockItem[];
  purchaseOrderItems: MockPurchaseOrderItem[];
  purchaseOrders: MockPurchaseOrder[];
  requisitionItems: MockRequisitionItem[];
  requisitions: MockRequisition[];
  stockBalances: MockStockBalance[];
  stockMovements: MockStockMovement[];
  suppliers: MockSupplier[];
  units: MockUnit[];
  warehouses: MockWarehouse[];
}

interface MockPrismaClient {
  $transaction: <T>(callback: (tx: MockPrismaClient) => Promise<T>) => Promise<T>;
  auditLog: Record<string, unknown>;
  getState: () => MockState;
  goodsReceivedNote: Record<string, unknown>;
  goodsReceivedNoteItem: Record<string, unknown>;
  item: Record<string, unknown>;
  purchaseOrder: Record<string, unknown>;
  purchaseOrderItem: Record<string, unknown>;
  purchaseRequisition: Record<string, unknown>;
  purchaseRequisitionItem: Record<string, unknown>;
  supplier: Record<string, unknown>;
  unitOfMeasure: Record<string, unknown>;
  warehouse: Record<string, unknown>;
}

const context = {
  branchId: null,
  isBranchScoped: false,
  organizationId: 'org-1',
  userProfileId: 'user-1'
};

function decimal(value: number | string | Decimal) {
  return value instanceof Decimal ? value : new Decimal(value);
}

function cloneValue<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value instanceof Decimal) {
    return new Decimal(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneValue(item)]),
    ) as T;
  }

  return value;
}

function createBaseState(overrides: Partial<MockState> = {}): MockState {
  return {
    auditLogs: [],
    grnItems: [],
    grns: [],
    items: [{ deletedAt: null, id: 'item-1', organizationId: context.organizationId }],
    purchaseOrderItems: [],
    purchaseOrders: [],
    requisitionItems: [],
    requisitions: [],
    stockBalances: [],
    stockMovements: [],
    suppliers: [
      {
        currentBalance: decimal(0),
        deletedAt: null,
        id: 'supplier-1',
        name: 'Dairy Inputs Limited',
        organizationId: context.organizationId
      }
    ],
    units: [{ id: 'uom-1', organizationId: context.organizationId }],
    warehouses: [
      {
        branchId: null,
        id: 'warehouse-1',
        isActive: true,
        name: 'Main Warehouse',
        organizationId: context.organizationId
      }
    ],
    ...overrides
  };
}

function createMockPrisma(initialState: MockState): MockPrismaClient {
  let state = cloneValue(initialState);
  let idCounter = 1;

  const nextId = (prefix: string) => `${prefix}-${idCounter++}`;
  const findSupplier = (supplierId: string) => state.suppliers.find((supplier) => supplier.id === supplierId);
  const findOrder = (orderId: string) => state.purchaseOrders.find((order) => order.id === orderId);
  const findWarehouse = (warehouseId: string) => state.warehouses.find((warehouse) => warehouse.id === warehouseId);

  const mock: MockPrismaClient = {
    auditLog: {
      create: async ({ data }: { data: Omit<MockAuditLog, 'id'> }) => {
        const entry: MockAuditLog = { id: nextId('audit'), ...cloneValue(data) };

        state.auditLogs.push(entry);

        return cloneValue(entry);
      }
    },
    goodsReceivedNote: {
      findFirst: async ({
        include,
        where
      }: {
        include?: {
          items?: boolean;
          purchaseOrder?: { include?: { items?: boolean; supplier?: boolean } };
          warehouse?: boolean;
        };
        where: { deletedAt?: null; id?: string; organizationId?: string };
      }) => {
        const grn = state.grns.find(
          (row) =>
            (!where.id || row.id === where.id) &&
            (!where.organizationId || row.organizationId === where.organizationId) &&
            (where.deletedAt === undefined ? true : row.deletedAt === where.deletedAt),
        );

        if (!grn) {
          return null;
        }

        const result = cloneValue(grn) as unknown as Record<string, unknown>;

        if (include?.items) {
          result.items = state.grnItems.filter((item) => item.grnId === grn.id).map((item) => cloneValue(item));
        }

        if (include?.purchaseOrder) {
          const order = findOrder(grn.purchaseOrderId);

          if (!order) {
            throw new Error('Purchase order missing for GRN.');
          }

          const orderResult = cloneValue(order) as unknown as Record<string, unknown>;

          if (include.purchaseOrder.include?.items) {
            orderResult.items = state.purchaseOrderItems
              .filter((item) => item.purchaseOrderId === order.id)
              .map((item) => cloneValue(item));
          }

          if (include.purchaseOrder.include?.supplier) {
            const supplier = findSupplier(order.supplierId);

            if (!supplier) {
              throw new Error('Supplier missing for purchase order.');
            }

            orderResult.supplier = cloneValue(supplier);
          }

          result.purchaseOrder = orderResult;
        }

        if (include?.warehouse) {
          const warehouse = findWarehouse(grn.warehouseId);

          if (!warehouse) {
            throw new Error('Warehouse missing for GRN.');
          }

          result.warehouse = cloneValue(warehouse);
        }

        return result;
      },
      update: async ({
        data,
        include,
        where
      }: {
        data: Partial<MockGRN>;
        include?: { items?: boolean; purchaseOrder?: boolean };
        where: { id: string };
      }) => {
        const grn = state.grns.find((row) => row.id === where.id);

        if (!grn) {
          throw new Error('GRN not found.');
        }

        Object.assign(grn, cloneValue(data));
        const result = cloneValue(grn) as unknown as Record<string, unknown>;

        if (include?.items) {
          result.items = state.grnItems.filter((item) => item.grnId === grn.id).map((item) => cloneValue(item));
        }

        if (include?.purchaseOrder) {
          const order = findOrder(grn.purchaseOrderId);

          if (!order) {
            throw new Error('Purchase order not found.');
          }

          result.purchaseOrder = cloneValue(order);
        }

        return result;
      }
    },
    goodsReceivedNoteItem: {
      create: async ({ data }: { data: Omit<MockGRNItem, 'id'> }) => {
        const row: MockGRNItem = {
          id: nextId('grn-item'),
          ...cloneValue(data)
        };

        state.grnItems.push(row);

        return cloneValue(row);
      },
      findFirst: async ({ where }: { where: { grnId?: string; poItemId?: string } }) =>
        cloneValue(
          state.grnItems.find(
            (row) =>
              (!where.grnId || row.grnId === where.grnId) &&
              (!where.poItemId || row.poItemId === where.poItemId),
          ) ?? null,
        ),
      update: async ({
        data,
        where
      }: {
        data: Partial<MockGRNItem>;
        where: { id: string };
      }) => {
        const row = state.grnItems.find((item) => item.id === where.id);

        if (!row) {
          throw new Error('GRN line not found.');
        }

        Object.assign(row, cloneValue(data));

        return cloneValue(row);
      }
    },
    item: {
      findMany: async ({
        where
      }: {
        where: { deletedAt?: null; id?: { in: string[] }; organizationId?: string };
      }) =>
        cloneValue(
          state.items.filter(
            (item) =>
              (!where.organizationId || item.organizationId === where.organizationId) &&
              (!where.id?.in || where.id.in.includes(item.id)) &&
              (where.deletedAt === undefined ? true : item.deletedAt === where.deletedAt),
          ),
        )
    },
    purchaseOrder: {
      count: async ({ where }: { where: { organizationId?: string } }) =>
        state.purchaseOrders.filter(
          (row) => !where.organizationId || row.organizationId === where.organizationId,
        ).length,
      create: async ({ data }: { data: Omit<MockPurchaseOrder, 'deletedAt' | 'id'> & { deletedAt?: Date | null } }) => {
        const row: MockPurchaseOrder = {
          deletedAt: data.deletedAt ?? null,
          id: nextId('po'),
          ...cloneValue(data)
        };

        state.purchaseOrders.push(row);

        return cloneValue(row);
      },
      findFirst: async ({
        include,
        where
      }: {
        include?: { items?: boolean };
        where: { deletedAt?: null; id?: string; organizationId?: string };
      }) => {
        const order = state.purchaseOrders.find(
          (row) =>
            (!where.id || row.id === where.id) &&
            (!where.organizationId || row.organizationId === where.organizationId) &&
            (where.deletedAt === undefined ? true : row.deletedAt === where.deletedAt),
        );

        if (!order) {
          return null;
        }

        if (!include?.items) {
          return cloneValue(order);
        }

        return cloneValue({
          ...order,
          items: state.purchaseOrderItems.filter((item) => item.purchaseOrderId === order.id)
        });
      },
      update: async ({
        data,
        where
      }: {
        data: Partial<MockPurchaseOrder>;
        where: { id: string };
      }) => {
        const order = state.purchaseOrders.find((row) => row.id === where.id);

        if (!order) {
          throw new Error('Purchase order not found.');
        }

        Object.assign(order, cloneValue(data));

        return cloneValue(order);
      }
    },
    purchaseOrderItem: {
      createMany: async ({
        data
      }: {
        data: Array<Omit<MockPurchaseOrderItem, 'id'>>;
      }) => {
        data.forEach((row) => {
          state.purchaseOrderItems.push({
            id: nextId('po-item'),
            ...cloneValue(row)
          });
        });

        return {
          count: data.length
        };
      },
      findMany: async ({ where }: { where: { purchaseOrderId?: string } }) =>
        cloneValue(
          state.purchaseOrderItems.filter(
            (row) => !where.purchaseOrderId || row.purchaseOrderId === where.purchaseOrderId,
          ),
        ),
      update: async ({
        data,
        where
      }: {
        data: Partial<MockPurchaseOrderItem>;
        where: { id: string };
      }) => {
        const row = state.purchaseOrderItems.find((item) => item.id === where.id);

        if (!row) {
          throw new Error('Purchase order item not found.');
        }

        Object.assign(row, cloneValue(data));

        return cloneValue(row);
      }
    },
    purchaseRequisition: {
      count: async ({ where }: { where: { organizationId?: string } }) =>
        state.requisitions.filter(
          (row) => !where.organizationId || row.organizationId === where.organizationId,
        ).length,
      create: async ({ data }: { data: Omit<MockRequisition, 'deletedAt' | 'id'> & { deletedAt?: Date | null } }) => {
        const row: MockRequisition = {
          deletedAt: data.deletedAt ?? null,
          id: nextId('req'),
          ...cloneValue(data)
        };

        state.requisitions.push(row);

        return cloneValue(row);
      },
      findFirst: async ({
        include,
        where
      }: {
        include?: { items?: boolean };
        where: { deletedAt?: null; id?: string; organizationId?: string };
      }) => {
        const requisition = state.requisitions.find(
          (row) =>
            (!where.id || row.id === where.id) &&
            (!where.organizationId || row.organizationId === where.organizationId) &&
            (where.deletedAt === undefined ? true : row.deletedAt === where.deletedAt),
        );

        if (!requisition) {
          return null;
        }

        if (!include?.items) {
          return cloneValue(requisition);
        }

        return cloneValue({
          ...requisition,
          items: state.requisitionItems.filter((item) => item.requisitionId === requisition.id)
        });
      },
      findUniqueOrThrow: async ({
        include,
        where
      }: {
        include?: { items?: boolean };
        where: { id: string };
      }) => {
        const requisition = state.requisitions.find((row) => row.id === where.id);

        if (!requisition) {
          throw new Error('Purchase requisition not found.');
        }

        if (!include?.items) {
          return cloneValue(requisition);
        }

        return cloneValue({
          ...requisition,
          items: state.requisitionItems.filter((item) => item.requisitionId === requisition.id)
        });
      },
      update: async ({
        data,
        where
      }: {
        data: Partial<MockRequisition>;
        where: { id: string };
      }) => {
        const requisition = state.requisitions.find((row) => row.id === where.id);

        if (!requisition) {
          throw new Error('Purchase requisition not found.');
        }

        Object.assign(requisition, cloneValue(data));

        return cloneValue(requisition);
      }
    },
    purchaseRequisitionItem: {
      createMany: async ({
        data
      }: {
        data: Array<Omit<MockRequisitionItem, 'id'>>;
      }) => {
        data.forEach((row) => {
          state.requisitionItems.push({
            id: nextId('req-item'),
            ...cloneValue(row)
          });
        });

        return {
          count: data.length
        };
      },
      findMany: async ({ where }: { where: { requisitionId?: string } }) =>
        cloneValue(
          state.requisitionItems.filter(
            (row) => !where.requisitionId || row.requisitionId === where.requisitionId,
          ),
        ),
      update: async ({
        data,
        where
      }: {
        data: Partial<MockRequisitionItem>;
        where: { id: string };
      }) => {
        const row = state.requisitionItems.find((item) => item.id === where.id);

        if (!row) {
          throw new Error('Requisition item not found.');
        }

        Object.assign(row, cloneValue(data));

        return cloneValue(row);
      }
    },
    supplier: {
      findFirst: async ({
        where
      }: {
        where: { deletedAt?: null; id?: string; organizationId?: string };
      }) =>
        cloneValue(
          state.suppliers.find(
            (supplier) =>
              (!where.id || supplier.id === where.id) &&
              (!where.organizationId || supplier.organizationId === where.organizationId) &&
              (where.deletedAt === undefined ? true : supplier.deletedAt === where.deletedAt),
          ) ?? null,
        ),
      update: async ({
        data,
        where
      }: {
        data: Partial<MockSupplier>;
        where: { id: string };
      }) => {
        const supplier = state.suppliers.find((row) => row.id === where.id);

        if (!supplier) {
          throw new Error('Supplier not found.');
        }

        Object.assign(supplier, cloneValue(data));

        return cloneValue(supplier);
      }
    },
    unitOfMeasure: {
      findMany: async ({
        where
      }: {
        where: { id?: { in: string[] }; organizationId?: string };
      }) =>
        cloneValue(
          state.units.filter(
            (unit) =>
              (!where.organizationId || unit.organizationId === where.organizationId) &&
              (!where.id?.in || where.id.in.includes(unit.id)),
          ),
        )
    },
    warehouse: {
      findFirst: async ({
        where
      }: {
        where: { id?: string; isActive?: boolean; organizationId?: string };
      }) =>
        cloneValue(
          state.warehouses.find(
            (warehouse) =>
              (!where.id || warehouse.id === where.id) &&
              (where.isActive === undefined ? true : warehouse.isActive === where.isActive) &&
              (!where.organizationId || warehouse.organizationId === where.organizationId),
          ) ?? null,
        )
    },
    $transaction: async <T>(callback: (tx: MockPrismaClient) => Promise<T>) => {
      const snapshot = cloneValue(state);

      try {
        return await callback(mock);
      } catch (error) {
        state = snapshot;
        throw error;
      }
    },
    getState: () => cloneValue(state)
  };

  return mock;
}

async function withMockState<T>(
  initialState: MockState,
  callback: (mock: MockPrismaClient) => Promise<T>,
) {
  const prismaAny = prisma as unknown as Record<string, unknown>;
  const mock = createMockPrisma(initialState);
  const original = {
    $transaction: prismaAny.$transaction,
    auditLog: prismaAny.auditLog,
    goodsReceivedNote: prismaAny.goodsReceivedNote,
    goodsReceivedNoteItem: prismaAny.goodsReceivedNoteItem,
    item: prismaAny.item,
    purchaseOrder: prismaAny.purchaseOrder,
    purchaseOrderItem: prismaAny.purchaseOrderItem,
    purchaseRequisition: prismaAny.purchaseRequisition,
    purchaseRequisitionItem: prismaAny.purchaseRequisitionItem,
    supplier: prismaAny.supplier,
    unitOfMeasure: prismaAny.unitOfMeasure,
    warehouse: prismaAny.warehouse
  };

  Object.assign(prismaAny, {
    $transaction: mock.$transaction,
    auditLog: mock.auditLog,
    goodsReceivedNote: mock.goodsReceivedNote,
    goodsReceivedNoteItem: mock.goodsReceivedNoteItem,
    item: mock.item,
    purchaseOrder: mock.purchaseOrder,
    purchaseOrderItem: mock.purchaseOrderItem,
    purchaseRequisition: mock.purchaseRequisition,
    purchaseRequisitionItem: mock.purchaseRequisitionItem,
    supplier: mock.supplier,
    unitOfMeasure: mock.unitOfMeasure,
    warehouse: mock.warehouse
  });

  try {
    return await callback(mock);
  } finally {
    Object.assign(prismaAny, original);
  }
}

test('requisition approval flow updates status and approved quantities', async () => {
  await withMockState(createBaseState(), async (mock) => {
    const requisition = await ProcurementService.createRequisition(context, {
      department: 'Production',
      items: [
        {
          estimatedUnitCost: 12.5,
          itemId: 'item-1',
          quantityRequested: 80,
          remarks: null,
          unitOfMeasureId: 'uom-1'
        }
      ],
      neededByDate: '2026-06-15',
      remarks: 'Milk powder replenishment'
    });

    const submitted = await ProcurementService.submitRequisition(context, requisition.id);
    const approved = await ProcurementService.approveRequisition(
      context,
      requisition.id,
      'Approved for immediate ordering',
    );

    const state = mock.getState();
    const updatedItem = state.requisitionItems.find((item) => item.requisitionId === requisition.id);

    assert.equal(submitted.status, PurchaseRequisitionStatus.SUBMITTED);
    assert.equal(approved.status, PurchaseRequisitionStatus.LEVEL1_APPROVED);
    assert.equal(updatedItem?.quantityApproved?.toNumber(), 80);
    assert.ok(state.auditLogs.some((log) => log.action === 'REQUISITION_APPROVED'));
  });
});

test('purchase order is created from approved requisition only', async () => {
  await withMockState(
    createBaseState({
      requisitions: [
        {
          approvalStatus: PurchaseRequisitionStatus.LEVEL1_APPROVED,
          approvedAt: new Date('2026-05-20T00:00:00.000Z'),
          approvedBy: context.userProfileId,
          deletedAt: null,
          department: 'Production',
          id: 'req-approved',
          neededByDate: null,
          organizationId: context.organizationId,
          remarks: null,
          requestDate: new Date('2026-05-18T00:00:00.000Z'),
          requestedBy: context.userProfileId,
          requisitionNumber: 'REQ-00001',
          status: PurchaseRequisitionStatus.LEVEL1_APPROVED
        }
      ]
    }),
    async (mock) => {
      const order = await ProcurementService.createPurchaseOrder(context, {
        discountAmount: 0,
        expectedDeliveryDate: '2026-06-20',
        items: [
          {
            itemId: 'item-1',
            quantityOrdered: 100,
            unitCost: 9.5,
            unitOfMeasureId: 'uom-1'
          }
        ],
        notes: 'Create from approved requisition',
        orderDate: '2026-05-30',
        requisitionId: 'req-approved',
        supplierId: 'supplier-1',
        taxAmount: 0
      });

      const state = mock.getState();

      assert.equal(order.status, PurchaseOrderStatus.DRAFT);
      assert.equal(order.requisitionId, 'req-approved');
      assert.equal(state.purchaseOrders.length, 1);
      assert.ok(state.auditLogs.some((log) => log.action === 'PURCHASE_ORDER_CREATED'));
    },
  );
});

test('GRN receive updates stock balances', async () => {
  const grnState = createBaseState({
    grnItems: [
      {
        batchNumber: null,
        expiryDate: null,
        grnId: 'grn-1',
        id: 'grn-item-1',
        itemId: 'item-1',
        poItemId: 'po-item-1',
        qualityNotes: null,
        quantityExpected: decimal(50),
        quantityReceived: decimal(0),
        quantityRejected: decimal(0),
        unitCost: decimal(8)
      }
    ],
    grns: [
      {
        deletedAt: null,
        grnNumber: 'GRN-00001',
        id: 'grn-1',
        notes: null,
        organizationId: context.organizationId,
        purchaseOrderId: 'po-1',
        qualityNotes: null,
        qualityStatus: 'PENDING',
        receivedBy: context.userProfileId,
        receivedDate: new Date('2026-05-30T00:00:00.000Z'),
        status: GRNStatus.DRAFT,
        warehouseId: 'warehouse-1'
      }
    ],
    purchaseOrderItems: [
      {
        id: 'po-item-1',
        itemId: 'item-1',
        purchaseOrderId: 'po-1',
        quantityOrdered: decimal(50),
        quantityReceived: decimal(0),
        totalCost: decimal(400),
        unitCost: decimal(8),
        unitOfMeasureId: 'uom-1'
      }
    ],
    purchaseOrders: [
      {
        approvedAt: new Date('2026-05-20T00:00:00.000Z'),
        approvedBy: context.userProfileId,
        createdBy: context.userProfileId,
        deletedAt: null,
        discountAmount: decimal(0),
        expectedDeliveryDate: null,
        id: 'po-1',
        notes: null,
        orderDate: new Date('2026-05-20T00:00:00.000Z'),
        organizationId: context.organizationId,
        poNumber: 'PO-00001',
        requisitionId: null,
        status: PurchaseOrderStatus.SENT_TO_SUPPLIER,
        subtotal: decimal(400),
        supplierId: 'supplier-1',
        taxAmount: decimal(0),
        total: decimal(400)
      }
    ]
  });

  await withMockState(grnState, async (mock) => {
    const inventoryServiceAny = InventoryService as unknown as { receiveStock: any };
    const originalReceiveStock = inventoryServiceAny.receiveStock;
    const receivedBalances: MockStockBalance[] = [];
    const movementRecords: MockStockMovement[] = [];

    inventoryServiceAny.receiveStock = async (
      _inventoryContext: unknown,
      payload: {
        itemId: string;
        quantity: number;
        reference: { id: string };
        warehouseId: string;
      },
    ) => {
      const existing = receivedBalances.find(
        (balance) => balance.itemId === payload.itemId && balance.warehouseId === payload.warehouseId,
      );

      if (existing) {
        existing.quantityOnHand += payload.quantity;
      } else {
        receivedBalances.push({
          itemId: payload.itemId,
          quantityOnHand: payload.quantity,
          warehouseId: payload.warehouseId
        });
      }

      movementRecords.push({
        itemId: payload.itemId,
        quantity: payload.quantity,
        referenceId: payload.reference.id,
        type: 'PURCHASE_RECEIVE',
        warehouseId: payload.warehouseId
      });

      return {
        id: 'balance-1',
        item: { id: payload.itemId },
        quantityAvailable: payload.quantity,
        quantityOnHand: payload.quantity,
        quantityReserved: 0,
        warehouse: { id: payload.warehouseId }
      };
    };

    try {
      await ProcurementService.receiveGRN(context, 'grn-1', {
        items: [
          {
            batchNumber: 'BATCH-001',
            expiryDate: '2026-12-31',
            itemId: 'item-1',
            overReceiveReason: null,
            poItemId: 'po-item-1',
            qualityNotes: null,
            quantityReceived: 50,
            quantityRejected: 0
          }
        ],
        notes: 'Received in full'
      });

      const state = mock.getState();
      const balance = receivedBalances.find(
        (row) => row.itemId === 'item-1' && row.warehouseId === 'warehouse-1',
      );

      assert.equal(balance?.quantityOnHand, 50);
      assert.equal(movementRecords.length, 1);
      assert.equal(state.purchaseOrders[0]?.status, PurchaseOrderStatus.FULLY_RECEIVED);
      assert.ok(state.auditLogs.some((log) => log.action === 'GRN_RECEIVED'));
    } finally {
      inventoryServiceAny.receiveStock = originalReceiveStock;
    }
  });
});

test('GRN receive creates stock movement records', async () => {
  const state = createBaseState({
    grnItems: [
      {
        batchNumber: null,
        expiryDate: null,
        grnId: 'grn-2',
        id: 'grn-item-2',
        itemId: 'item-1',
        poItemId: 'po-item-2',
        qualityNotes: null,
        quantityExpected: decimal(20),
        quantityReceived: decimal(0),
        quantityRejected: decimal(0),
        unitCost: decimal(7)
      }
    ],
    grns: [
      {
        deletedAt: null,
        grnNumber: 'GRN-00002',
        id: 'grn-2',
        notes: null,
        organizationId: context.organizationId,
        purchaseOrderId: 'po-2',
        qualityNotes: null,
        qualityStatus: 'PENDING',
        receivedBy: context.userProfileId,
        receivedDate: new Date('2026-05-30T00:00:00.000Z'),
        status: GRNStatus.DRAFT,
        warehouseId: 'warehouse-1'
      }
    ],
    purchaseOrderItems: [
      {
        id: 'po-item-2',
        itemId: 'item-1',
        purchaseOrderId: 'po-2',
        quantityOrdered: decimal(20),
        quantityReceived: decimal(0),
        totalCost: decimal(140),
        unitCost: decimal(7),
        unitOfMeasureId: 'uom-1'
      }
    ],
    purchaseOrders: [
      {
        approvedAt: new Date('2026-05-20T00:00:00.000Z'),
        approvedBy: context.userProfileId,
        createdBy: context.userProfileId,
        deletedAt: null,
        discountAmount: decimal(0),
        expectedDeliveryDate: null,
        id: 'po-2',
        notes: null,
        orderDate: new Date('2026-05-20T00:00:00.000Z'),
        organizationId: context.organizationId,
        poNumber: 'PO-00002',
        requisitionId: null,
        status: PurchaseOrderStatus.SENT_TO_SUPPLIER,
        subtotal: decimal(140),
        supplierId: 'supplier-1',
        taxAmount: decimal(0),
        total: decimal(140)
      }
    ]
  });

  await withMockState(state, async (mock) => {
    const inventoryServiceAny = InventoryService as unknown as { receiveStock: any };
    const originalReceiveStock = inventoryServiceAny.receiveStock;
    const movementRecords: MockStockMovement[] = [];

    inventoryServiceAny.receiveStock = async (
      _inventoryContext: unknown,
      payload: {
        itemId: string;
        quantity: number;
        reference: { id: string };
        warehouseId: string;
      },
    ) => {
      movementRecords.push({
        itemId: payload.itemId,
        quantity: payload.quantity,
        referenceId: payload.reference.id,
        type: 'PURCHASE_RECEIVE',
        warehouseId: payload.warehouseId
      });

      return {
        id: 'balance-2',
        item: { id: payload.itemId },
        quantityAvailable: payload.quantity,
        quantityOnHand: payload.quantity,
        quantityReserved: 0,
        warehouse: { id: payload.warehouseId }
      };
    };

    try {
      await ProcurementService.receiveGRN(context, 'grn-2', {
        items: [
          {
            batchNumber: 'BATCH-002',
            expiryDate: null,
            itemId: 'item-1',
            overReceiveReason: null,
            poItemId: 'po-item-2',
            qualityNotes: null,
            quantityReceived: 20,
            quantityRejected: 0
          }
        ],
        notes: 'Received complete'
      });

      assert.equal(movementRecords.length, 1);
      assert.equal(movementRecords[0]?.type, 'PURCHASE_RECEIVE');
      assert.equal(movementRecords[0]?.referenceId, 'grn-2');
    } finally {
      inventoryServiceAny.receiveStock = originalReceiveStock;
    }
  });
});

test('GRN over-receive warns and allows only with reason', async () => {
  const base = createBaseState({
    grnItems: [
      {
        batchNumber: null,
        expiryDate: null,
        grnId: 'grn-3',
        id: 'grn-item-3',
        itemId: 'item-1',
        poItemId: 'po-item-3',
        qualityNotes: null,
        quantityExpected: decimal(10),
        quantityReceived: decimal(0),
        quantityRejected: decimal(0),
        unitCost: decimal(6)
      }
    ],
    grns: [
      {
        deletedAt: null,
        grnNumber: 'GRN-00003',
        id: 'grn-3',
        notes: null,
        organizationId: context.organizationId,
        purchaseOrderId: 'po-3',
        qualityNotes: null,
        qualityStatus: 'PENDING',
        receivedBy: context.userProfileId,
        receivedDate: new Date('2026-05-30T00:00:00.000Z'),
        status: GRNStatus.DRAFT,
        warehouseId: 'warehouse-1'
      }
    ],
    purchaseOrderItems: [
      {
        id: 'po-item-3',
        itemId: 'item-1',
        purchaseOrderId: 'po-3',
        quantityOrdered: decimal(10),
        quantityReceived: decimal(0),
        totalCost: decimal(60),
        unitCost: decimal(6),
        unitOfMeasureId: 'uom-1'
      }
    ],
    purchaseOrders: [
      {
        approvedAt: new Date('2026-05-20T00:00:00.000Z'),
        approvedBy: context.userProfileId,
        createdBy: context.userProfileId,
        deletedAt: null,
        discountAmount: decimal(0),
        expectedDeliveryDate: null,
        id: 'po-3',
        notes: null,
        orderDate: new Date('2026-05-20T00:00:00.000Z'),
        organizationId: context.organizationId,
        poNumber: 'PO-00003',
        requisitionId: null,
        status: PurchaseOrderStatus.SENT_TO_SUPPLIER,
        subtotal: decimal(60),
        supplierId: 'supplier-1',
        taxAmount: decimal(0),
        total: decimal(60)
      }
    ]
  });

  await withMockState(base, async () => {
    const inventoryServiceAny = InventoryService as unknown as { receiveStock: any };
    const originalReceiveStock = inventoryServiceAny.receiveStock;
    inventoryServiceAny.receiveStock = async () =>
      ({
        id: 'balance',
        item: { id: 'item-1' },
        quantityAvailable: 0,
        quantityOnHand: 0,
        quantityReserved: 0,
        warehouse: { id: 'warehouse-1' }
      });

    try {
      await assert.rejects(
        () =>
          ProcurementService.receiveGRN(context, 'grn-3', {
            items: [
              {
                batchNumber: null,
                expiryDate: null,
                itemId: 'item-1',
                overReceiveReason: null,
                poItemId: 'po-item-3',
                qualityNotes: null,
                quantityReceived: 12,
                quantityRejected: 0
              }
            ],
            notes: null
          }),
        /Provide overReceiveReason to continue/,
      );

      const allowed = await ProcurementService.receiveGRN(context, 'grn-3', {
        items: [
          {
            batchNumber: null,
            expiryDate: null,
            itemId: 'item-1',
            overReceiveReason: 'Supplier loaded extra sealed cartons',
            poItemId: 'po-item-3',
            qualityNotes: null,
            quantityReceived: 12,
            quantityRejected: 0
          }
        ],
        notes: null
      });

      assert.equal(allowed.warnings.length, 1);
      assert.match(allowed.warnings[0] ?? '', /Over-received 12/);
    } finally {
      inventoryServiceAny.receiveStock = originalReceiveStock;
    }
  });
});

test('supplier balance updates correctly on payment debit', async () => {
  await withMockState(
    createBaseState({
      suppliers: [
        {
          currentBalance: decimal(1000),
          deletedAt: null,
          id: 'supplier-1',
          name: 'Dairy Inputs Limited',
          organizationId: context.organizationId
        }
      ]
    }),
    async (mock) => {
      const updated = await SuppliersService.updateSupplierBalance(
        {
          organizationId: context.organizationId,
          userProfileId: context.userProfileId
        },
        'supplier-1',
        300,
        SupplierBalanceUpdateType.DEBIT,
      );

      const state = mock.getState();
      const supplier = state.suppliers.find((item) => item.id === 'supplier-1');

      assert.equal(updated.currentBalance, 700);
      assert.equal(supplier?.currentBalance.toNumber(), 700);
      assert.ok(state.auditLogs.some((log) => log.action === 'SUPPLIER_BALANCE_UPDATED'));
    },
  );
});
