import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import {
  InventoryBatchStatus,
  ItemType,
  StockMovementType,
  TransferStatus,
  WarehouseType
} from '../modules/inventory/inventory.constants';
import { InventoryService } from '../modules/inventory/inventory.service';

interface MockCategory {
  id: string;
  name: string;
}

interface MockUnitOfMeasure {
  id: string;
  abbreviation: string;
  name: string;
}

interface MockBranch {
  id: string;
  name: string;
}

interface MockItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  deletedAt: Date | null;
  isActive: boolean;
  itemType: ItemType;
  organizationId: string;
  reorderLevel: Decimal | null;
  reorderQuantity: Decimal | null;
  sellingPrice: Decimal | null;
  trackExpiry: boolean;
  unitCost: Decimal | null;
  category: MockCategory;
  unitOfMeasure: MockUnitOfMeasure;
}

interface MockWarehouse {
  id: string;
  branch: MockBranch | null;
  branchId: string | null;
  code: string;
  isActive: boolean;
  name: string;
  organizationId: string;
  type: WarehouseType;
}

interface MockStockBalance {
  id: string;
  itemId: string;
  lastUpdated: Date;
  organizationId: string;
  quantityAvailable: Decimal;
  quantityOnHand: Decimal;
  quantityReserved: Decimal;
  warehouseId: string;
}

interface MockInventoryBatch {
  id: string;
  batchNumber: string;
  createdAt: Date;
  expiryDate: Date | null;
  itemId: string;
  manufacturedDate: Date | null;
  organizationId: string;
  quantityReceived: Decimal;
  quantityRemaining: Decimal;
  status: InventoryBatchStatus;
  supplierId: string | null;
  unitCost: Decimal;
  warehouseId: string;
}

interface MockStockMovement {
  id: string;
  batchId: string | null;
  createdAt: Date;
  createdBy: string;
  itemId: string;
  movementType: StockMovementType;
  notes: string | null;
  organizationId: string;
  quantity: Decimal;
  referenceId: string;
  referenceType: string;
  runningBalance: Decimal | null;
  totalCost: Decimal | null;
  unitCost: Decimal | null;
  warehouseId: string;
}

interface MockAuditLog {
  id: string;
  action: string;
  entityId: string;
  entityType: string;
  newValues?: Prisma.InputJsonValue;
  oldValues?: Prisma.InputJsonValue;
  organizationId: string;
  userProfileId: string;
}

interface MockStockTransfer {
  id: string;
  approvedBy: string;
  createdAt: Date;
  fromWarehouseId: string;
  notes: string | null;
  organizationId: string;
  requestedBy: string;
  status: TransferStatus;
  toWarehouseId: string;
  transferDate: Date;
  transferNumber: string;
}

interface MockStockTransferItem {
  id: string;
  itemId: string;
  quantityReceived: Decimal;
  quantityRequested: Decimal;
  quantitySent: Decimal;
  transferId: string;
}

interface MockState {
  auditLogs: MockAuditLog[];
  balances: MockStockBalance[];
  batches: MockInventoryBatch[];
  items: MockItem[];
  movements: MockStockMovement[];
  transferItems: MockStockTransferItem[];
  transfers: MockStockTransfer[];
  warehouses: MockWarehouse[];
}

interface MockPrismaClient {
  auditLog: Record<string, unknown>;
  inventoryBatch: Record<string, unknown>;
  item: Record<string, unknown>;
  stockBalance: Record<string, unknown>;
  stockMovement: Record<string, unknown>;
  stockTransfer: Record<string, unknown>;
  stockTransferItem: Record<string, unknown>;
  warehouse: Record<string, unknown>;
  $transaction: <T>(callback: (tx: MockPrismaClient) => Promise<T>) => Promise<T>;
  getState: () => MockState;
}

const context = {
  branchId: null,
  isBranchScoped: false,
  organizationId: 'org-1',
  userProfileId: 'user-1'
};

const baseCategory: MockCategory = {
  id: 'category-1',
  name: 'Raw Materials'
};

const baseUom: MockUnitOfMeasure = {
  abbreviation: 'kg',
  id: 'uom-1',
  name: 'Kilogram'
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

function createItem(overrides: Partial<MockItem> = {}): MockItem {
  return {
    category: baseCategory,
    code: 'RM-001',
    deletedAt: null,
    description: null,
    id: 'item-1',
    isActive: true,
    itemType: ItemType.RAW_MATERIAL,
    name: 'Full Cream Milk Powder',
    organizationId: context.organizationId,
    reorderLevel: decimal(50),
    reorderQuantity: decimal(100),
    sellingPrice: decimal(0),
    trackExpiry: true,
    unitCost: decimal(4.5),
    unitOfMeasure: baseUom,
    ...overrides
  };
}

function createWarehouse(overrides: Partial<MockWarehouse> = {}): MockWarehouse {
  return {
    branch: null,
    branchId: null,
    code: 'MAIN-01',
    id: 'warehouse-1',
    isActive: true,
    name: 'Main Warehouse',
    organizationId: context.organizationId,
    type: WarehouseType.MAIN,
    ...overrides
  };
}

function createBalance(overrides: Partial<MockStockBalance> = {}): MockStockBalance {
  const quantityOnHand = overrides.quantityOnHand ?? decimal(0);
  const quantityReserved = overrides.quantityReserved ?? decimal(0);

  return {
    id: 'balance-1',
    itemId: 'item-1',
    lastUpdated: new Date(),
    organizationId: context.organizationId,
    quantityAvailable: overrides.quantityAvailable ?? quantityOnHand.minus(quantityReserved),
    quantityOnHand,
    quantityReserved,
    warehouseId: 'warehouse-1',
    ...overrides
  };
}

function createBatch(overrides: Partial<MockInventoryBatch> = {}): MockInventoryBatch {
  const quantityReceived = overrides.quantityReceived ?? decimal(100);
  const quantityRemaining = overrides.quantityRemaining ?? quantityReceived;

  return {
    batchNumber: 'BATCH-001',
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
    expiryDate: new Date('2026-07-10T00:00:00.000Z'),
    id: 'batch-1',
    itemId: 'item-1',
    manufacturedDate: new Date('2026-01-05T00:00:00.000Z'),
    organizationId: context.organizationId,
    quantityReceived,
    quantityRemaining,
    status: InventoryBatchStatus.ACTIVE,
    supplierId: null,
    unitCost: decimal(4.5),
    warehouseId: 'warehouse-1',
    ...overrides
  };
}

function createState(overrides: Partial<MockState> = {}): MockState {
  return {
    auditLogs: [],
    balances: [],
    batches: [],
    items: [createItem()],
    movements: [],
    transferItems: [],
    transfers: [],
    warehouses: [createWarehouse()],
    ...overrides
  };
}

function matchScalar<T>(expected: T | undefined, actual: T) {
  return expected === undefined || expected === actual;
}

function createMockPrisma(initialState: MockState): MockPrismaClient {
  let state = cloneValue(initialState);
  let idCounter = 1;

  const findItem = (itemId: string) => state.items.find((item) => item.id === itemId);
  const findWarehouse = (warehouseId: string) =>
    state.warehouses.find((warehouse) => warehouse.id === warehouseId);

  const ensureWarehouseScope = (warehouseId: string, scope?: { branchId?: string }) => {
    if (!scope || Object.keys(scope).length === 0 || !scope.branchId) {
      return true;
    }

    const warehouse = findWarehouse(warehouseId);

    return warehouse?.branchId === scope.branchId;
  };

  const includeBalanceRelations = (balance: MockStockBalance) => ({
    ...cloneValue(balance),
    item: cloneValue(findItem(balance.itemId)!),
    warehouse: cloneValue(findWarehouse(balance.warehouseId)!)
  });

  const mock: MockPrismaClient = {
    auditLog: {
      create: async ({ data }: { data: Omit<MockAuditLog, 'id'> }) => {
        const record: MockAuditLog = {
          id: `audit-${idCounter++}`,
          ...cloneValue(data)
        };

        state.auditLogs.push(record);

        return cloneValue(record);
      }
    },
    inventoryBatch: {
      findFirst: async ({
        where
      }: {
        where: {
          id?: string;
          itemId?: string;
          organizationId?: string;
          warehouse?: { branchId?: string };
          warehouseId?: string;
        };
      }) =>
        cloneValue(
          state.batches.find(
            (batch) =>
              matchScalar(where.id, batch.id) &&
              matchScalar(where.itemId, batch.itemId) &&
              matchScalar(where.organizationId, batch.organizationId) &&
              matchScalar(where.warehouseId, batch.warehouseId) &&
              ensureWarehouseScope(batch.warehouseId, where.warehouse),
          ) ?? null,
        ),
      findMany: async ({
        where
      }: {
        where: {
          expiryDate?: { gte?: Date; lte?: Date };
          itemId?: string;
          organizationId?: string;
          quantityRemaining?: { gt?: Prisma.Decimal };
          status?: { in?: InventoryBatchStatus[] };
          warehouse?: { branchId?: string };
          warehouseId?: string;
        };
      }) =>
        cloneValue(
          state.batches
            .filter((batch) => {
              const hasQuantity =
                !where.quantityRemaining?.gt || batch.quantityRemaining.greaterThan(where.quantityRemaining.gt);
              const withinExpiry =
                !where.expiryDate ||
                ((!where.expiryDate.gte || (batch.expiryDate?.getTime() ?? 0) >= where.expiryDate.gte.getTime()) &&
                  (!where.expiryDate.lte || (batch.expiryDate?.getTime() ?? 0) <= where.expiryDate.lte.getTime()));

              return (
                matchScalar(where.itemId, batch.itemId) &&
                matchScalar(where.organizationId, batch.organizationId) &&
                matchScalar(where.warehouseId, batch.warehouseId) &&
                (!where.status?.in || where.status.in.includes(batch.status)) &&
                hasQuantity &&
                withinExpiry &&
                ensureWarehouseScope(batch.warehouseId, where.warehouse)
              );
            })
            .map((batch) => ({
              ...batch,
              item: cloneValue(findItem(batch.itemId)!),
              warehouse: cloneValue(findWarehouse(batch.warehouseId)!)
            })),
        ),
      findUnique: async ({
        where
      }: {
        where:
          | { id: string }
          | {
              warehouseId_itemId_batchNumber: {
                batchNumber: string;
                itemId: string;
                warehouseId: string;
              };
            };
      }) => {
        if ('id' in where) {
          return cloneValue(state.batches.find((batch) => batch.id === where.id) ?? null);
        }

        const batch = state.batches.find(
          (item) =>
            item.batchNumber === where.warehouseId_itemId_batchNumber.batchNumber &&
            item.itemId === where.warehouseId_itemId_batchNumber.itemId &&
            item.warehouseId === where.warehouseId_itemId_batchNumber.warehouseId,
        );

        return cloneValue(batch ?? null);
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const batch = state.batches.find((item) => item.id === where.id);

        if (!batch) {
          throw new Error('Inventory batch not found.');
        }

        return cloneValue(batch);
      },
      create: async ({ data }: { data: Omit<MockInventoryBatch, 'createdAt' | 'id' | 'status'> & { status?: InventoryBatchStatus } }) => {
        const batch: MockInventoryBatch = {
          createdAt: new Date(),
          id: `batch-${idCounter++}`,
          status: data.status ?? InventoryBatchStatus.ACTIVE,
          ...cloneValue(data)
        };

        state.batches.push(batch);

        return cloneValue(batch);
      },
      update: async ({
        data,
        where
      }: {
        data: Partial<MockInventoryBatch>;
        where: { id: string };
      }) => {
        const batch = state.batches.find((item) => item.id === where.id);

        if (!batch) {
          throw new Error('Inventory batch not found.');
        }

        Object.assign(batch, cloneValue(data));

        return cloneValue(batch);
      }
    },
    item: {
      findFirst: async ({
        where
      }: {
        where: {
          deletedAt?: null;
          id?: string;
          organizationId?: string;
        };
      }) =>
        cloneValue(
          state.items.find(
            (item) =>
              matchScalar(where.id, item.id) &&
              matchScalar(where.organizationId, item.organizationId) &&
              (where.deletedAt === undefined ? true : item.deletedAt === where.deletedAt),
          ) ?? null,
        )
    },
    stockBalance: {
      create: async ({
        data
      }: {
        data: {
          itemId: string;
          organizationId: string;
          quantityAvailable: Prisma.Decimal;
          quantityOnHand: Prisma.Decimal;
          quantityReserved: Prisma.Decimal;
          warehouseId: string;
        };
      }) => {
        const balance: MockStockBalance = {
          id: `balance-${idCounter++}`,
          lastUpdated: new Date(),
          ...cloneValue(data)
        };

        state.balances.push(balance);

        return cloneValue(balance);
      },
      findFirst: async ({
        where
      }: {
        where: {
          itemId?: string;
          organizationId?: string;
          warehouse?: { branchId?: string };
          warehouseId?: string;
        };
      }) => {
        const balance = state.balances.find(
          (item) =>
            matchScalar(where.itemId, item.itemId) &&
            matchScalar(where.organizationId, item.organizationId) &&
            matchScalar(where.warehouseId, item.warehouseId) &&
            ensureWarehouseScope(item.warehouseId, where.warehouse),
        );

        return balance ? includeBalanceRelations(balance) : null;
      },
      findMany: async ({
        where
      }: {
        where: {
          organizationId?: string;
          warehouse?: { branchId?: string };
        };
      }) =>
        cloneValue(
          state.balances
            .filter(
              (balance) =>
                matchScalar(where.organizationId, balance.organizationId) &&
                ensureWarehouseScope(balance.warehouseId, where.warehouse),
            )
            .map(includeBalanceRelations),
        ),
      findUnique: async ({
        where
      }: {
        where: {
          itemId_warehouseId: {
            itemId: string;
            warehouseId: string;
          };
        };
      }) =>
        cloneValue(
          state.balances.find(
            (balance) =>
              balance.itemId === where.itemId_warehouseId.itemId &&
              balance.warehouseId === where.itemId_warehouseId.warehouseId,
          ) ?? null,
        ),
      update: async ({
        data,
        where
      }: {
        data: Partial<MockStockBalance>;
        where: { id: string };
      }) => {
        const balance = state.balances.find((item) => item.id === where.id);

        if (!balance) {
          throw new Error('Stock balance not found.');
        }

        Object.assign(balance, cloneValue(data));

        return includeBalanceRelations(balance);
      }
    },
    stockMovement: {
      findFirst: async ({
        where,
        select
      }: {
        where: {
          itemId?: string;
          organizationId?: string;
          warehouseId?: string;
        };
        select?: {
          runningBalance?: boolean;
        };
      }) => {
        const movement = [...state.movements]
          .filter(
            (item) =>
              matchScalar(where.itemId, item.itemId) &&
              matchScalar(where.organizationId, item.organizationId) &&
              matchScalar(where.warehouseId, item.warehouseId),
          )
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

        if (!movement) {
          return null;
        }

        if (select?.runningBalance) {
          return cloneValue({
            runningBalance: movement.runningBalance
          });
        }

        return cloneValue(movement);
      },
      create: async ({ data }: { data: Omit<MockStockMovement, 'createdAt' | 'id'> }) => {
        const movement: MockStockMovement = {
          createdAt: new Date(),
          id: `movement-${idCounter++}`,
          ...cloneValue(data)
        };

        state.movements.push(movement);

        return cloneValue(movement);
      }
    },
    stockTransfer: {
      count: async ({
        where
      }: {
        where: {
          organizationId?: string;
        };
      }) => state.transfers.filter((transfer) => matchScalar(where.organizationId, transfer.organizationId)).length,
      create: async ({ data }: { data: Omit<MockStockTransfer, 'createdAt' | 'id'> }) => {
        const transfer: MockStockTransfer = {
          createdAt: new Date(),
          id: `transfer-${idCounter++}`,
          ...cloneValue(data)
        };

        state.transfers.push(transfer);

        return cloneValue(transfer);
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const transfer = state.transfers.find((item) => item.id === where.id);

        if (!transfer) {
          throw new Error('Transfer not found.');
        }

        return cloneValue({
          ...transfer,
          fromWarehouse: findWarehouse(transfer.fromWarehouseId)!,
          items: state.transferItems
            .filter((item) => item.transferId === transfer.id)
            .map((item) => ({
              ...item,
              item: findItem(item.itemId)!
            })),
          toWarehouse: findWarehouse(transfer.toWarehouseId)!
        });
      }
    },
    stockTransferItem: {
      create: async ({ data }: { data: Omit<MockStockTransferItem, 'id'> }) => {
        const item: MockStockTransferItem = {
          id: `transfer-item-${idCounter++}`,
          ...cloneValue(data)
        };

        state.transferItems.push(item);

        return cloneValue(item);
      }
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
        };
      }) =>
        cloneValue(
          state.warehouses.find(
            (warehouse) =>
              matchScalar(where.id, warehouse.id) &&
              matchScalar(where.organizationId, warehouse.organizationId) &&
              matchScalar(where.isActive, warehouse.isActive) &&
              matchScalar(where.branchId, warehouse.branchId ?? undefined),
          ) ?? null,
        )
    },
    $transaction: async <T>(callback: (tx: typeof mock) => Promise<T>) => {
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

async function withMockState<T>(initialState: MockState, callback: (mock: ReturnType<typeof createMockPrisma>) => Promise<T>) {
  const prismaAny = prisma as unknown as Record<string, unknown>;
  const mock = createMockPrisma(initialState);
  const original = {
    $transaction: prismaAny.$transaction,
    auditLog: prismaAny.auditLog,
    inventoryBatch: prismaAny.inventoryBatch,
    item: prismaAny.item,
    stockBalance: prismaAny.stockBalance,
    stockMovement: prismaAny.stockMovement,
    stockTransfer: prismaAny.stockTransfer,
    stockTransferItem: prismaAny.stockTransferItem,
    warehouse: prismaAny.warehouse
  };

  Object.assign(prismaAny, {
    $transaction: mock.$transaction,
    auditLog: mock.auditLog,
    inventoryBatch: mock.inventoryBatch,
    item: mock.item,
    stockBalance: mock.stockBalance,
    stockMovement: mock.stockMovement,
    stockTransfer: mock.stockTransfer,
    stockTransferItem: mock.stockTransferItem,
    warehouse: mock.warehouse
  });

  try {
    return await callback(mock);
  } finally {
    Object.assign(prismaAny, original);
  }
}

test('receiveStock increases balance correctly', async () => {
  const item = createItem();
  const warehouse = createWarehouse();

  await withMockState(
    createState({
      items: [item],
      warehouses: [warehouse]
    }),
    async (mock) => {
      const result = await InventoryService.receiveStock(context, {
        batchNumber: 'GRN-001',
        expiryDate: '2026-08-01',
        itemId: item.id,
        manufacturedDate: '2026-05-01',
        quantity: 120,
        reference: {
          id: 'grn-001',
          type: 'goods_received_note'
        },
        unitCost: 5.25,
        warehouseId: warehouse.id
      });

      const state = mock.getState();

      assert.equal(result.quantityOnHand, 120);
      assert.equal(result.quantityAvailable, 120);
      assert.equal(state.balances[0]?.quantityOnHand.toNumber(), 120);
      assert.equal(state.movements[0]?.movementType, StockMovementType.PURCHASE_RECEIVE);
      assert.equal(state.batches[0]?.quantityRemaining.toNumber(), 120);
    },
  );
});

test('issueStock decreases balance correctly and follows FIFO depletion', async () => {
  const item = createItem();
  const warehouse = createWarehouse();
  const olderBatch = createBatch({
    batchNumber: 'OLD-001',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    expiryDate: new Date('2026-06-01T00:00:00.000Z'),
    id: 'batch-old',
    quantityReceived: decimal(60),
    quantityRemaining: decimal(60)
  });
  const newerBatch = createBatch({
    batchNumber: 'NEW-001',
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    expiryDate: new Date('2026-07-01T00:00:00.000Z'),
    id: 'batch-new',
    quantityReceived: decimal(80),
    quantityRemaining: decimal(80)
  });

  await withMockState(
    createState({
      balances: [
        createBalance({
          quantityAvailable: decimal(140),
          quantityOnHand: decimal(140),
          quantityReserved: decimal(0)
        })
      ],
      batches: [olderBatch, newerBatch],
      items: [item],
      warehouses: [warehouse]
    }),
    async (mock) => {
      const result = await InventoryService.issueStock(context, {
        itemId: item.id,
        quantity: 75,
        reference: {
          id: 'sales-001',
          type: 'sales_issue'
        },
        warehouseId: warehouse.id
      });

      const state = mock.getState();
      const remainingOld = state.batches.find((batch: MockInventoryBatch) => batch.id === olderBatch.id)!;
      const remainingNew = state.batches.find((batch: MockInventoryBatch) => batch.id === newerBatch.id)!;

      assert.equal(result.quantityIssued, 75);
      assert.equal(result.stockBalance.quantityOnHand, 65);
      assert.equal(remainingOld.quantityRemaining.toNumber(), 0);
      assert.equal(remainingNew.quantityRemaining.toNumber(), 65);
      assert.equal(state.movements.length, 2);
    },
  );
});

test('issueStock throws on insufficient stock', async () => {
  const item = createItem();
  const warehouse = createWarehouse();

  await withMockState(
    createState({
      balances: [
        createBalance({
          quantityAvailable: decimal(20),
          quantityOnHand: decimal(20),
          quantityReserved: decimal(0)
        })
      ],
      batches: [
        createBatch({
          quantityReceived: decimal(20),
          quantityRemaining: decimal(20)
        })
      ],
      items: [item],
      warehouses: [warehouse]
    }),
    async () => {
      await assert.rejects(
        () =>
          InventoryService.issueStock(context, {
            itemId: item.id,
            quantity: 25,
            reference: {
              id: 'sales-002',
              type: 'sales_issue'
            },
            warehouseId: warehouse.id
          }),
        /Insufficient stock for Full Cream Milk Powder/,
      );
    },
  );
});

test('issueStock throws on expired batch without override', async () => {
  const item = createItem();
  const warehouse = createWarehouse();

  await withMockState(
    createState({
      balances: [
        createBalance({
          quantityAvailable: decimal(30),
          quantityOnHand: decimal(30),
          quantityReserved: decimal(0)
        })
      ],
      batches: [
        createBatch({
          expiryDate: new Date('2026-01-01T00:00:00.000Z'),
          quantityReceived: decimal(30),
          quantityRemaining: decimal(30)
        })
      ],
      items: [item],
      warehouses: [warehouse]
    }),
    async () => {
      await assert.rejects(
        () =>
          InventoryService.issueStock(context, {
            itemId: item.id,
            quantity: 10,
            reference: {
              id: 'production-001',
              type: 'production_batch'
            },
            warehouseId: warehouse.id
          }),
        /is expired and cannot be issued without an override/,
      );
    },
  );
});

test('transferStock deducts from source and adds to destination', async () => {
  const item = createItem();
  const sourceWarehouse = createWarehouse({
    code: 'MAIN-01',
    id: 'warehouse-source',
    name: 'Main Warehouse'
  });
  const destinationWarehouse = createWarehouse({
    code: 'BR-01',
    id: 'warehouse-destination',
    name: 'Borrowdale Branch Warehouse',
    type: WarehouseType.BRANCH
  });

  await withMockState(
    createState({
      balances: [
        createBalance({
          id: 'balance-source',
          quantityAvailable: decimal(90),
          quantityOnHand: decimal(90),
          warehouseId: sourceWarehouse.id
        })
      ],
      batches: [
        createBatch({
          id: 'batch-transfer',
          quantityReceived: decimal(90),
          quantityRemaining: decimal(90),
          warehouseId: sourceWarehouse.id
        })
      ],
      items: [item],
      warehouses: [sourceWarehouse, destinationWarehouse]
    }),
    async (mock) => {
      await InventoryService.transferStock(context, {
        fromWarehouseId: sourceWarehouse.id,
        items: [
          {
            itemId: item.id,
            quantity: 30
          }
        ],
        notes: 'Replenish branch',
        toWarehouseId: destinationWarehouse.id
      });

      const state = mock.getState();
      const sourceBalance = state.balances.find(
        (balance: MockStockBalance) => balance.warehouseId === sourceWarehouse.id,
      )!;
      const destinationBalance = state.balances.find(
        (balance: MockStockBalance) => balance.warehouseId === destinationWarehouse.id,
      )!;
      const transferOut = state.movements.find(
        (movement: MockStockMovement) => movement.movementType === StockMovementType.TRANSFER_OUT,
      );
      const transferIn = state.movements.find(
        (movement: MockStockMovement) => movement.movementType === StockMovementType.TRANSFER_IN,
      );

      assert.equal(sourceBalance.quantityOnHand.toNumber(), 60);
      assert.equal(destinationBalance.quantityOnHand.toNumber(), 30);
      assert.ok(transferOut);
      assert.ok(transferIn);
      assert.equal(state.transfers.length, 1);
    },
  );
});

test('transferStock is atomic and rolls back on failure', async () => {
  const mainItem = createItem();
  const missingStockItem = createItem({
    code: 'RM-002',
    id: 'item-2',
    name: 'Chocolate Compound',
    reorderLevel: decimal(10)
  });
  const sourceWarehouse = createWarehouse({
    id: 'warehouse-source'
  });
  const destinationWarehouse = createWarehouse({
    id: 'warehouse-destination',
    name: 'Branch Warehouse',
    type: WarehouseType.BRANCH
  });

  await withMockState(
    createState({
      balances: [
        createBalance({
          id: 'balance-source-1',
          quantityAvailable: decimal(40),
          quantityOnHand: decimal(40),
          warehouseId: sourceWarehouse.id
        }),
        createBalance({
          id: 'balance-source-2',
          itemId: missingStockItem.id,
          quantityAvailable: decimal(0),
          quantityOnHand: decimal(0),
          warehouseId: sourceWarehouse.id
        })
      ],
      batches: [
        createBatch({
          id: 'batch-source-1',
          quantityReceived: decimal(40),
          quantityRemaining: decimal(40),
          warehouseId: sourceWarehouse.id
        })
      ],
      items: [mainItem, missingStockItem],
      warehouses: [sourceWarehouse, destinationWarehouse]
    }),
    async (mock) => {
      await assert.rejects(
        () =>
          InventoryService.transferStock(context, {
            fromWarehouseId: sourceWarehouse.id,
            items: [
              { itemId: mainItem.id, quantity: 15 },
              { itemId: missingStockItem.id, quantity: 5 }
            ],
            notes: 'Mixed transfer should fail',
            toWarehouseId: destinationWarehouse.id
          }),
        /Insufficient stock/,
      );

      const state = mock.getState();
      const sourceBalance = state.balances.find(
        (balance: MockStockBalance) => balance.id === 'balance-source-1',
      )!;

      assert.equal(sourceBalance.quantityOnHand.toNumber(), 40);
      assert.equal(state.transfers.length, 0);
      assert.equal(state.movements.length, 0);
      assert.equal(
        state.balances.filter(
          (balance: MockStockBalance) => balance.warehouseId === destinationWarehouse.id,
        ).length,
        0,
      );
    },
  );
});

test('adjustStock ADJUSTMENT_OUT throws on insufficient stock', async () => {
  const item = createItem();
  const warehouse = createWarehouse();

  await withMockState(
    createState({
      balances: [
        createBalance({
          quantityAvailable: decimal(12),
          quantityOnHand: decimal(12),
          quantityReserved: decimal(0)
        })
      ],
      items: [item],
      warehouses: [warehouse]
    }),
    async () => {
      await assert.rejects(
        () =>
          InventoryService.adjustStock(context, {
            itemId: item.id,
            quantity: 18,
            reason: 'Cycle count shortage',
            type: 'ADJUSTMENT_OUT',
            warehouseId: warehouse.id
          }),
        /Insufficient stock/,
      );
    },
  );
});

test('getLowStockItems returns correct items', async () => {
  const lowItem = createItem({
    id: 'item-low',
    name: 'Vanilla Essence',
    reorderLevel: decimal(20)
  });
  const healthyItem = createItem({
    code: 'RM-003',
    id: 'item-healthy',
    name: 'Sugar',
    reorderLevel: decimal(10)
  });
  const warehouse = createWarehouse();

  await withMockState(
    createState({
      balances: [
        createBalance({
          id: 'balance-low',
          itemId: lowItem.id,
          quantityAvailable: decimal(8),
          quantityOnHand: decimal(8),
          warehouseId: warehouse.id
        }),
        createBalance({
          id: 'balance-healthy',
          itemId: healthyItem.id,
          quantityAvailable: decimal(50),
          quantityOnHand: decimal(50),
          warehouseId: warehouse.id
        })
      ],
      items: [lowItem, healthyItem],
      warehouses: [warehouse]
    }),
    async () => {
      const result = await InventoryService.getLowStockItems(context);

      assert.equal(result.length, 1);
      assert.equal(result[0]?.item.id, lowItem.id);
      assert.equal(result[0]?.quantityAvailable, 8);
    },
  );
});

test('getExpiringBatches returns correct batches', async () => {
  const item = createItem();
  const warehouse = createWarehouse();
  const expiringSoon = createBatch({
    batchNumber: 'EXP-001',
    expiryDate: new Date('2026-06-05T00:00:00.000Z'),
    id: 'batch-expiring',
    quantityReceived: decimal(25),
    quantityRemaining: decimal(25)
  });
  const laterBatch = createBatch({
    batchNumber: 'SAFE-001',
    expiryDate: new Date('2026-09-10T00:00:00.000Z'),
    id: 'batch-safe',
    quantityReceived: decimal(40),
    quantityRemaining: decimal(40)
  });

  await withMockState(
    createState({
      batches: [expiringSoon, laterBatch],
      items: [item],
      warehouses: [warehouse]
    }),
    async () => {
      const result = await InventoryService.getExpiringBatches(context, 10);

      assert.equal(result.length, 1);
      assert.equal(result[0]?.id, expiringSoon.id);
      assert.equal(result[0]?.batchNumber, 'EXP-001');
    },
  );
});
