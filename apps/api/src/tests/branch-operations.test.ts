import assert from 'node:assert/strict';
import test from 'node:test';

import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { InventoryService } from '../modules/inventory/inventory.service';
import { BranchOperationsService } from '../modules/branch-operations/branch-operations.service';

interface MockBranch {
  deletedAt: Date | null;
  id: string;
  manager?: null;
  organizationId: string;
}

interface MockWarehouse {
  branchId: string | null;
  id: string;
  isActive: boolean;
  organizationId: string;
  type: string;
}

interface MockItem {
  deletedAt: Date | null;
  id: string;
  isActive: boolean;
  itemType: string;
  organizationId: string;
}

interface MockBranchSale {
  branchId: string;
  customerId: string | null;
  deletedAt: Date | null;
  id: string;
  organizationId: string;
  paymentMethod: string;
  paymentReference: string | null;
  saleDate: Date;
  saleNumber: string;
  servedBy: string;
  shift: string;
  totalAmount: Decimal;
}

interface MockBranchSaleItem {
  branchSaleId: string;
  id: string;
  itemId: string;
  quantity: Decimal;
  totalPrice: Decimal;
  unitPrice: Decimal;
}

interface MockBranchExpense {
  amount: Decimal;
  branchId: string;
  deletedAt: Date | null;
  expenseDate: Date;
  id: string;
  organizationId: string;
  paymentMethod: string;
}

interface MockBranchShiftClose {
  actualCash: Decimal;
  approvedAt: Date | null;
  approvedBy: string | null;
  branchId: string;
  cardTotal: Decimal;
  cashVariance: Decimal;
  closedBy: string;
  closingStockValue: Decimal;
  damagedStockValue: Decimal;
  deletedAt: Date | null;
  ecocashTotal: Decimal;
  expectedCash: Decimal;
  expensesTotal: Decimal;
  id: string;
  notes: string | null;
  openingStockValue: Decimal;
  organizationId: string;
  shiftDate: Date;
  shiftType: string;
  status: string;
  stockReceivedValue: Decimal;
  stockSoldValue: Decimal;
  stockVariance: Decimal;
}

interface MockStockMovement {
  createdAt: Date;
  movementType: string;
  organizationId: string;
  totalCost: Decimal | null;
  warehouseId: string;
}

interface MockAuditLog {
  action: string;
  entityId: string;
  entityType: string;
  id: string;
  organizationId: string;
  userProfileId: string;
}

interface MockState {
  auditLogs: MockAuditLog[];
  branchExpenses: MockBranchExpense[];
  branchSaleItems: MockBranchSaleItem[];
  branchSales: MockBranchSale[];
  branchShiftCloses: MockBranchShiftClose[];
  branches: MockBranch[];
  items: MockItem[];
  stockMovements: MockStockMovement[];
  warehouses: MockWarehouse[];
}

interface MockPrismaClient {
  $transaction: <T>(callback: (tx: MockPrismaClient) => Promise<T>) => Promise<T>;
  auditLog: Record<string, unknown>;
  branch: Record<string, unknown>;
  branchExpense: Record<string, unknown>;
  branchSale: Record<string, unknown>;
  branchSaleItem: Record<string, unknown>;
  branchShiftClose: Record<string, unknown>;
  getState: () => MockState;
  item: Record<string, unknown>;
  stockMovement: Record<string, unknown>;
  warehouse: Record<string, unknown>;
}

const context = {
  branchId: 'branch-1',
  isBranchScoped: true,
  organizationId: 'org-1',
  roles: [{ name: 'Branch Manager' }],
  userProfileId: 'user-1'
};

function decimal(value: number | string) {
  return new Decimal(value);
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

function createState(overrides: Partial<MockState> = {}): MockState {
  return {
    auditLogs: [],
    branchExpenses: [],
    branchSaleItems: [],
    branchSales: [],
    branchShiftCloses: [],
    branches: [
      {
        deletedAt: null,
        id: 'branch-1',
        manager: null,
        organizationId: context.organizationId
      }
    ],
    items: [
      {
        deletedAt: null,
        id: 'item-1',
        isActive: true,
        itemType: 'FINISHED_GOOD',
        organizationId: context.organizationId
      }
    ],
    stockMovements: [],
    warehouses: [
      {
        branchId: 'branch-1',
        id: 'warehouse-1',
        isActive: true,
        organizationId: context.organizationId,
        type: 'BRANCH'
      }
    ],
    ...overrides
  };
}

function createMockPrisma(initialState: MockState): MockPrismaClient {
  let state = cloneValue(initialState);
  let idCounter = 1;

  const nextId = (prefix: string) => `${prefix}-${idCounter++}`;

  const mock: MockPrismaClient = {
    auditLog: {
      create: async ({ data }: { data: Omit<MockAuditLog, 'id'> }) => {
        const row: MockAuditLog = {
          id: nextId('audit'),
          ...cloneValue(data)
        };

        state.auditLogs.push(row);

        return cloneValue(row);
      }
    },
    branch: {
      findFirst: async ({ where }: { where: { deletedAt?: null; id?: string; organizationId?: string } }) =>
        cloneValue(
          state.branches.find(
            (branch) =>
              (!where.id || branch.id === where.id) &&
              (!where.organizationId || branch.organizationId === where.organizationId) &&
              (where.deletedAt === undefined ? true : branch.deletedAt === where.deletedAt),
          ) ?? null,
        )
    },
    branchExpense: {
      findMany: async ({
        where
      }: {
        where: {
          branchId?: string;
          deletedAt?: null;
          expenseDate?: { gte?: Date; lte?: Date };
          organizationId?: string;
          paymentMethod?: string;
        };
      }) =>
        cloneValue(
          state.branchExpenses.filter(
            (row) =>
              (!where.branchId || row.branchId === where.branchId) &&
              (!where.organizationId || row.organizationId === where.organizationId) &&
              (!where.paymentMethod || row.paymentMethod === where.paymentMethod) &&
              (where.deletedAt === undefined ? true : row.deletedAt === where.deletedAt) &&
              (!where.expenseDate?.gte || row.expenseDate.getTime() >= where.expenseDate.gte.getTime()) &&
              (!where.expenseDate?.lte || row.expenseDate.getTime() <= where.expenseDate.lte.getTime()),
          ),
        )
    },
    branchSale: {
      count: async ({ where }: { where: { organizationId?: string } }) =>
        state.branchSales.filter((row) => !where.organizationId || row.organizationId === where.organizationId)
          .length,
      create: async ({ data }: { data: Omit<MockBranchSale, 'deletedAt' | 'id'> }) => {
        const row: MockBranchSale = {
          deletedAt: null,
          id: nextId('sale'),
          ...cloneValue(data)
        };

        state.branchSales.push(row);

        return cloneValue(row);
      },
      findMany: async ({
        include,
        where
      }: {
        include?: { items?: boolean };
        where: {
          branchId?: string;
          deletedAt?: null;
          organizationId?: string;
          paymentMethod?: string;
          saleDate?: { gte?: Date; lte?: Date };
          shift?: string;
        };
      }) =>
        cloneValue(
          state.branchSales
            .filter(
              (row) =>
                (!where.branchId || row.branchId === where.branchId) &&
                (!where.organizationId || row.organizationId === where.organizationId) &&
                (!where.paymentMethod || row.paymentMethod === where.paymentMethod) &&
                (!where.shift || row.shift === where.shift) &&
                (where.deletedAt === undefined ? true : row.deletedAt === where.deletedAt) &&
                (!where.saleDate?.gte || row.saleDate.getTime() >= where.saleDate.gte.getTime()) &&
                (!where.saleDate?.lte || row.saleDate.getTime() <= where.saleDate.lte.getTime()),
            )
            .map((row) =>
              include?.items
                ? {
                    ...row,
                    items: state.branchSaleItems.filter((item) => item.branchSaleId === row.id)
                  }
                : row,
            ),
        ),
      findUniqueOrThrow: async ({
        include,
        where
      }: {
        include?: { items?: boolean };
        where: { id: string };
      }) => {
        const row = state.branchSales.find((sale) => sale.id === where.id);

        if (!row) {
          throw new Error('Branch sale not found.');
        }

        if (!include?.items) {
          return cloneValue(row);
        }

        return cloneValue({
          ...row,
          items: state.branchSaleItems.filter((item) => item.branchSaleId === row.id)
        });
      }
    },
    branchSaleItem: {
      createMany: async ({ data }: { data: Array<Omit<MockBranchSaleItem, 'id'>> }) => {
        data.forEach((row) => {
          state.branchSaleItems.push({
            id: nextId('sale-item'),
            ...cloneValue(row)
          });
        });

        return {
          count: data.length
        };
      }
    },
    branchShiftClose: {
      findFirst: async ({
        where
      }: {
        where: {
          branchId?: string;
          deletedAt?: null;
          id?: string;
          organizationId?: string;
          shiftDate?: Date | { gte?: Date; lte?: Date };
          status?: { in?: string[] };
        };
      }) =>
        cloneValue(
          state.branchShiftCloses.find((row) => {
            const shiftDateMatches =
              !where.shiftDate ||
              (where.shiftDate instanceof Date
                ? row.shiftDate.getTime() === where.shiftDate.getTime()
                : (!where.shiftDate.gte || row.shiftDate.getTime() >= where.shiftDate.gte.getTime()) &&
                  (!where.shiftDate.lte || row.shiftDate.getTime() <= where.shiftDate.lte.getTime()));

            return (
              (!where.id || row.id === where.id) &&
              (!where.branchId || row.branchId === where.branchId) &&
              (!where.organizationId || row.organizationId === where.organizationId) &&
              (where.deletedAt === undefined ? true : row.deletedAt === where.deletedAt) &&
              shiftDateMatches &&
              (!where.status?.in || where.status.in.includes(row.status))
            );
          }) ?? null,
        ),
      update: async ({
        data,
        where
      }: {
        data: Partial<MockBranchShiftClose>;
        where: { id: string };
      }) => {
        const row = state.branchShiftCloses.find((item) => item.id === where.id);

        if (!row) {
          throw new Error('Shift close not found.');
        }

        Object.assign(row, cloneValue(data));

        return cloneValue(row);
      }
    },
    item: {
      findMany: async ({
        where
      }: {
        where: {
          deletedAt?: null;
          id?: { in: string[] };
          isActive?: boolean;
          itemType?: string;
          organizationId?: string;
        };
      }) =>
        cloneValue(
          state.items.filter(
            (item) =>
              (!where.organizationId || item.organizationId === where.organizationId) &&
              (!where.id?.in || where.id.in.includes(item.id)) &&
              (where.isActive === undefined ? true : item.isActive === where.isActive) &&
              (!where.itemType || item.itemType === where.itemType) &&
              (where.deletedAt === undefined ? true : item.deletedAt === where.deletedAt),
          ),
        )
    },
    stockMovement: {
      findMany: async ({
        where
      }: {
        where: {
          createdAt?: { gte?: Date; lte?: Date };
          movementType?: string;
          organizationId?: string;
          warehouseId?: string;
        };
      }) =>
        cloneValue(
          state.stockMovements.filter(
            (row) =>
              (!where.organizationId || row.organizationId === where.organizationId) &&
              (!where.warehouseId || row.warehouseId === where.warehouseId) &&
              (!where.movementType || row.movementType === where.movementType) &&
              (!where.createdAt?.gte || row.createdAt.getTime() >= where.createdAt.gte.getTime()) &&
              (!where.createdAt?.lte || row.createdAt.getTime() <= where.createdAt.lte.getTime()),
          ),
        )
    },
    warehouse: {
      findFirst: async ({
        where
      }: {
        where: {
          branchId?: string;
          id?: string;
          isActive?: boolean;
          organizationId?: string;
          type?: string;
        };
      }) =>
        cloneValue(
          state.warehouses.find(
            (warehouse) =>
              (!where.id || warehouse.id === where.id) &&
              (!where.branchId || warehouse.branchId === where.branchId) &&
              (!where.organizationId || warehouse.organizationId === where.organizationId) &&
              (where.isActive === undefined ? true : warehouse.isActive === where.isActive) &&
              (!where.type || warehouse.type === where.type),
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

async function withMockState<T>(initialState: MockState, callback: (mock: MockPrismaClient) => Promise<T>) {
  const prismaAny = prisma as unknown as Record<string, unknown>;
  const mock = createMockPrisma(initialState);
  const original = {
    $transaction: prismaAny.$transaction,
    auditLog: prismaAny.auditLog,
    branch: prismaAny.branch,
    branchExpense: prismaAny.branchExpense,
    branchSale: prismaAny.branchSale,
    branchSaleItem: prismaAny.branchSaleItem,
    branchShiftClose: prismaAny.branchShiftClose,
    item: prismaAny.item,
    stockMovement: prismaAny.stockMovement,
    warehouse: prismaAny.warehouse
  };

  Object.assign(prismaAny, {
    $transaction: mock.$transaction,
    auditLog: mock.auditLog,
    branch: mock.branch,
    branchExpense: mock.branchExpense,
    branchSale: mock.branchSale,
    branchSaleItem: mock.branchSaleItem,
    branchShiftClose: mock.branchShiftClose,
    item: mock.item,
    stockMovement: mock.stockMovement,
    warehouse: mock.warehouse
  });

  try {
    return await callback(mock);
  } finally {
    Object.assign(prismaAny, original);
  }
}

test('createBranchSale deducts stock in real time', async () => {
  await withMockState(createState(), async () => {
    let issueCalls = 0;
    const inventoryServiceAny = InventoryService as unknown as { issueStock: any };
    const originalIssueStock = inventoryServiceAny.issueStock;
    inventoryServiceAny.issueStock = async () => {
      issueCalls += 1;
      return {};
    };

    try {
      const result = await BranchOperationsService.createBranchSale(context, 'branch-1', {
        items: [
          {
            itemId: 'item-1',
            quantity: 2,
            totalPrice: 24,
            unitPrice: 12
          }
        ],
        paymentMethod: 'CASH',
        paymentReference: null,
        saleDate: '2026-05-30',
        shift: 'DAY'
      });

      assert.equal(issueCalls, 1);
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0]?.quantity.toNumber(), 2);
    } finally {
      inventoryServiceAny.issueStock = originalIssueStock;
    }
  });
});

test('createBranchSale throws on insufficient stock', async () => {
  await withMockState(createState(), async () => {
    const inventoryServiceAny = InventoryService as unknown as { issueStock: any };
    const originalIssueStock = inventoryServiceAny.issueStock;
    inventoryServiceAny.issueStock = async () => {
      throw new Error('Insufficient stock for Vanilla Ice Cream.');
    };

    try {
      await assert.rejects(
        () =>
          BranchOperationsService.createBranchSale(context, 'branch-1', {
            items: [
              {
                itemId: 'item-1',
                quantity: 100,
                totalPrice: 1200,
                unitPrice: 12
              }
            ],
            paymentMethod: 'CASH',
            paymentReference: null,
            saleDate: '2026-05-30',
            shift: 'DAY'
          }),
        /Insufficient stock/,
      );
    } finally {
      inventoryServiceAny.issueStock = originalIssueStock;
    }
  });
});

test('Cannot submit shift close with missing fields', async () => {
  await assert.rejects(
    () =>
      BranchOperationsService.submitShiftClose(
        context,
        'branch-1',
        'shift-1',
        {
          actualCash: undefined as unknown as number,
          actualClosingStock: 0,
          notes: null
        },
      ),
    /Actual cash is required/,
  );
});

test('Variance is calculated correctly', async () => {
  await withMockState(
    createState({
      branchSales: [
        {
          branchId: 'branch-1',
          customerId: null,
          deletedAt: null,
          id: 'sale-1',
          organizationId: context.organizationId,
          paymentMethod: 'CASH',
          paymentReference: null,
          saleDate: new Date('2026-05-30T00:00:00.000Z'),
          saleNumber: 'BS-00001',
          servedBy: context.userProfileId,
          shift: 'DAY',
          totalAmount: decimal(100)
        }
      ],
      branchSaleItems: [
        {
          branchSaleId: 'sale-1',
          id: 'sale-item-1',
          itemId: 'item-1',
          quantity: decimal(1),
          totalPrice: decimal(100),
          unitPrice: decimal(100)
        }
      ],
      branchShiftCloses: [
        {
          actualCash: decimal(0),
          approvedAt: null,
          approvedBy: null,
          branchId: 'branch-1',
          cardTotal: decimal(0),
          cashVariance: decimal(0),
          closedBy: context.userProfileId,
          closingStockValue: decimal(0),
          damagedStockValue: decimal(0),
          deletedAt: null,
          ecocashTotal: decimal(0),
          expectedCash: decimal(0),
          expensesTotal: decimal(0),
          id: 'shift-1',
          notes: null,
          openingStockValue: decimal(500),
          organizationId: context.organizationId,
          shiftDate: new Date('2026-05-30T00:00:00.000Z'),
          shiftType: 'DAY',
          status: 'OPEN',
          stockReceivedValue: decimal(0),
          stockSoldValue: decimal(0),
          stockVariance: decimal(0)
        }
      ],
      stockMovements: [
        {
          createdAt: new Date('2026-05-30T00:00:00.000Z'),
          movementType: 'TRANSFER_IN',
          organizationId: context.organizationId,
          totalCost: decimal(200),
          warehouseId: 'warehouse-1'
        },
        {
          createdAt: new Date('2026-05-30T00:00:00.000Z'),
          movementType: 'SALES_ISSUE',
          organizationId: context.organizationId,
          totalCost: decimal(150),
          warehouseId: 'warehouse-1'
        }
      ]
    }),
    async () => {
      const result = await BranchOperationsService.submitShiftClose(context, 'branch-1', 'shift-1', {
        actualCash: 90,
        actualClosingStock: 520,
        damagedStockValue: 10,
        notes: null
      });

      assert.equal(result.cashVariance.toNumber(), -10);
      assert.equal(result.stockVariance.toNumber(), 20);
    },
  );
});

test('Branch manager cannot see other branch data', async () => {
  await assert.rejects(
    () =>
      BranchOperationsService.listBranchSales(
        {
          ...context,
          branchId: 'branch-1',
          isBranchScoped: true
        },
        'branch-2',
        {
          page: 1,
          pageSize: 10
        },
      ),
    /limited to its assigned branch/,
  );
});

test('Cash variance calculation is correct', async () => {
  await withMockState(
    createState({
      branchSales: [
        {
          branchId: 'branch-1',
          customerId: null,
          deletedAt: null,
          id: 'sale-2',
          organizationId: context.organizationId,
          paymentMethod: 'CASH',
          paymentReference: null,
          saleDate: new Date('2026-05-30T00:00:00.000Z'),
          saleNumber: 'BS-00002',
          servedBy: context.userProfileId,
          shift: 'DAY',
          totalAmount: decimal(200)
        }
      ],
      branchSaleItems: [
        {
          branchSaleId: 'sale-2',
          id: 'sale-item-2',
          itemId: 'item-1',
          quantity: decimal(1),
          totalPrice: decimal(200),
          unitPrice: decimal(200)
        }
      ],
      branchShiftCloses: [
        {
          actualCash: decimal(0),
          approvedAt: null,
          approvedBy: null,
          branchId: 'branch-1',
          cardTotal: decimal(0),
          cashVariance: decimal(0),
          closedBy: context.userProfileId,
          closingStockValue: decimal(0),
          damagedStockValue: decimal(0),
          deletedAt: null,
          ecocashTotal: decimal(0),
          expectedCash: decimal(0),
          expensesTotal: decimal(0),
          id: 'shift-2',
          notes: null,
          openingStockValue: decimal(100),
          organizationId: context.organizationId,
          shiftDate: new Date('2026-05-30T00:00:00.000Z'),
          shiftType: 'DAY',
          status: 'OPEN',
          stockReceivedValue: decimal(0),
          stockSoldValue: decimal(0),
          stockVariance: decimal(0)
        }
      ]
    }),
    async () => {
      const result = await BranchOperationsService.submitShiftClose(context, 'branch-1', 'shift-2', {
        actualCash: 250,
        actualClosingStock: 50,
        damagedStockValue: 0,
        notes: null
      });

      assert.equal(result.cashVariance.toNumber(), 50);
    },
  );
});

test('Stock variance calculation is correct', async () => {
  await withMockState(
    createState({
      branchShiftCloses: [
        {
          actualCash: decimal(0),
          approvedAt: null,
          approvedBy: null,
          branchId: 'branch-1',
          cardTotal: decimal(0),
          cashVariance: decimal(0),
          closedBy: context.userProfileId,
          closingStockValue: decimal(0),
          damagedStockValue: decimal(0),
          deletedAt: null,
          ecocashTotal: decimal(0),
          expectedCash: decimal(0),
          expensesTotal: decimal(0),
          id: 'shift-3',
          notes: null,
          openingStockValue: decimal(1000),
          organizationId: context.organizationId,
          shiftDate: new Date('2026-05-30T00:00:00.000Z'),
          shiftType: 'DAY',
          status: 'OPEN',
          stockReceivedValue: decimal(0),
          stockSoldValue: decimal(0),
          stockVariance: decimal(0)
        }
      ],
      stockMovements: [
        {
          createdAt: new Date('2026-05-30T00:00:00.000Z'),
          movementType: 'TRANSFER_IN',
          organizationId: context.organizationId,
          totalCost: decimal(400),
          warehouseId: 'warehouse-1'
        },
        {
          createdAt: new Date('2026-05-30T00:00:00.000Z'),
          movementType: 'SALES_ISSUE',
          organizationId: context.organizationId,
          totalCost: decimal(350),
          warehouseId: 'warehouse-1'
        }
      ]
    }),
    async () => {
      const result = await BranchOperationsService.submitShiftClose(context, 'branch-1', 'shift-3', {
        actualCash: 0,
        actualClosingStock: 900,
        damagedStockValue: 20,
        notes: null
      });

      assert.equal(result.stockVariance.toNumber(), 130);
    },
  );
});
