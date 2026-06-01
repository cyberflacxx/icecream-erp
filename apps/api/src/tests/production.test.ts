import assert from 'node:assert/strict';
import test from 'node:test';

import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { InventoryService } from '../modules/inventory/inventory.service';
import { ProductionService } from '../modules/production/production.service';

interface MockStockBalance {
  itemId: string;
  quantityAvailable: Decimal;
  quantityOnHand: Decimal;
  quantityReserved: Decimal;
  warehouseId: string;
}

interface MockBatchMaterial {
  batchId: string;
  id: string;
  itemId: string;
  quantityActual: Decimal;
  quantityIssued: Decimal;
  quantityRequired: Decimal;
  unitId: string;
  variance: Decimal;
}

interface MockBatchOutput {
  actualQuantity: Decimal | null;
  batchId: string;
  expectedQuantity: Decimal;
  id: string;
  itemId: string;
  unitId: string;
}

interface MockBatch {
  actualOutput: Decimal | null;
  batchNumber: string;
  closedBy: string | null;
  deletedAt: Date | null;
  efficiencyPercentage: Decimal | null;
  endTime: Date | null;
  expectedOutput: Decimal;
  id: string;
  organizationId: string;
  plannedQuantity: Decimal;
  productionDate: Date;
  productionLine: string;
  qualityNotes: string | null;
  qualityStatus: 'PENDING' | 'PASSED' | 'FAILED' | 'CONDITIONAL_RELEASE' | 'QUARANTINE';
  recipe: {
    expectedOutputQuantity: Decimal;
    finishedItemId: string;
    items: Array<{
      item: { code: string; name: string };
      itemId: string;
      quantityRequired: Decimal;
      unit: { abbreviation: string };
      unitId: string;
    }>;
    outputUnitId: string;
    packagingItems: Array<{
      item: { code: string; name: string };
      itemId: string;
      quantityRequired: Decimal;
      unit: { abbreviation: string };
      unitId: string;
    }>;
  };
  recipeId: string;
  shift: 'DAY' | 'NIGHT';
  startTime: Date | null;
  startedBy: string | null;
  status:
    | 'DRAFT'
    | 'PLANNED'
    | 'MATERIALS_REQUESTED'
    | 'MATERIALS_APPROVED'
    | 'MATERIALS_RESERVED'
    | 'IN_PROGRESS'
    | 'WIP'
    | 'QUALITY_CHECK'
    | 'COMPLETED'
    | 'CANCELLED';
  warehouse: { branchId: string | null; id: string };
  warehouseId: string;
  wastagePercentage: Decimal | null;
  wastageQuantity: Decimal | null;
  wastageReason: string | null;
}

interface MockState {
  auditLogs: Array<{ action: string; entityId: string; newValues?: unknown }>;
  batches: MockBatch[];
  inventoryBatches: Array<{ itemId: string; quantityRemaining: Decimal; warehouseId: string }>;
  materials: MockBatchMaterial[];
  movements: Array<{ itemId: string; movementType: string; quantity: Decimal }>;
  outputs: MockBatchOutput[];
  qualityChecks: Array<{ referenceId: string; status: string }>;
  stockBalances: MockStockBalance[];
}

const context = {
  branchId: null,
  isBranchScoped: false,
  organizationId: 'org-1',
  userProfileId: 'user-1'
};

function decimal(value: number | string) {
  return new Decimal(value);
}

function cloneValue<T>(value: T): T {
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (value instanceof Decimal) return new Decimal(value) as T;
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T;
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
    batches: [
      {
        actualOutput: null,
        batchNumber: 'PB-0001',
        closedBy: null,
        deletedAt: null,
        efficiencyPercentage: null,
        endTime: null,
        expectedOutput: decimal(100),
        id: 'batch-1',
        organizationId: context.organizationId,
        plannedQuantity: decimal(100),
        productionDate: new Date('2026-06-01T00:00:00.000Z'),
        productionLine: 'Line-1',
        qualityNotes: null,
        qualityStatus: 'PENDING',
        recipe: {
          expectedOutputQuantity: decimal(100),
          finishedItemId: 'item-fg',
          items: [
            {
              item: { code: 'RM-1', name: 'Milk Powder' },
              itemId: 'item-rm-1',
              quantityRequired: decimal(20),
              unit: { abbreviation: 'kg' },
              unitId: 'uom-1'
            },
            {
              item: { code: 'RM-2', name: 'Sugar' },
              itemId: 'item-rm-2',
              quantityRequired: decimal(10),
              unit: { abbreviation: 'kg' },
              unitId: 'uom-1'
            }
          ],
          outputUnitId: 'uom-1',
          packagingItems: []
        },
        recipeId: 'recipe-1',
        shift: 'DAY',
        startTime: null,
        startedBy: null,
        status: 'MATERIALS_APPROVED',
        warehouse: { branchId: null, id: 'warehouse-1' },
        warehouseId: 'warehouse-1',
        wastagePercentage: null,
        wastageQuantity: null,
        wastageReason: null
      }
    ],
    inventoryBatches: [],
    materials: [],
    movements: [],
    outputs: [
      {
        actualQuantity: decimal(95),
        batchId: 'batch-1',
        expectedQuantity: decimal(100),
        id: 'output-1',
        itemId: 'item-fg',
        unitId: 'uom-1'
      }
    ],
    qualityChecks: [],
    stockBalances: [
      {
        itemId: 'item-rm-1',
        quantityAvailable: decimal(100),
        quantityOnHand: decimal(100),
        quantityReserved: decimal(0),
        warehouseId: 'warehouse-1'
      },
      {
        itemId: 'item-rm-2',
        quantityAvailable: decimal(100),
        quantityOnHand: decimal(100),
        quantityReserved: decimal(0),
        warehouseId: 'warehouse-1'
      },
      {
        itemId: 'item-fg',
        quantityAvailable: decimal(0),
        quantityOnHand: decimal(0),
        quantityReserved: decimal(0),
        warehouseId: 'warehouse-1'
      }
    ],
    ...overrides
  };
}

function createMockPrisma(initialState: MockState) {
  let state = cloneValue(initialState);
  let idCounter = 1;

  const mock = {
    auditLog: {
      create: async ({ data }: { data: { action: string; entityId: string; newValues?: unknown } }) => {
        state.auditLogs.push(cloneValue(data));
        return data;
      }
    },
    item: {
      findMany: async ({
        where
      }: {
        where: { id: { in: string[] } };
      }) =>
        cloneValue(
          state.batches
            .flatMap((batch) => [
              ...batch.recipe.items.map((recipeItem) => ({
                code: recipeItem.item.code,
                id: recipeItem.itemId,
                name: recipeItem.item.name
              })),
              ...batch.recipe.packagingItems.map((recipeItem) => ({
                code: recipeItem.item.code,
                id: recipeItem.itemId,
                name: recipeItem.item.name
              }))
            ])
            .filter((item) => where.id.in.includes(item.id)),
        )
    },
    productionBatch: {
      findFirst: async ({ where }: { where: { id?: string; organizationId?: string } }) => {
        const batch = state.batches.find(
          (item) =>
            (!where.id || item.id === where.id) &&
            (!where.organizationId || item.organizationId === where.organizationId),
        );
        if (!batch) return null;
        return cloneValue({
          ...batch,
          materials: state.materials.filter((material) => material.batchId === batch.id),
          outputs: state.outputs.filter((output) => output.batchId === batch.id)
        });
      },
      update: async ({ data, where }: { data: Partial<MockBatch>; where: { id: string } }) => {
        const batch = state.batches.find((item) => item.id === where.id);
        if (!batch) throw new Error('Batch not found');
        Object.assign(batch, cloneValue(data));
        return cloneValue(batch);
      }
    },
    productionBatchMaterial: {
      create: async ({ data }: { data: Omit<MockBatchMaterial, 'id'> }) => {
        const material = { id: `material-${idCounter++}`, ...cloneValue(data) };
        state.materials.push(material);
        return cloneValue(material);
      },
      findFirst: async ({ where }: { where: { batchId: string; itemId: string } }) =>
        cloneValue(
          state.materials.find(
            (material) => material.batchId === where.batchId && material.itemId === where.itemId,
          ) ?? null,
        ),
      findMany: async ({ where }: { where: { batchId: string } }) =>
        cloneValue(state.materials.filter((material) => material.batchId === where.batchId)),
      update: async ({ data, where }: { data: Partial<MockBatchMaterial>; where: { id: string } }) => {
        const material = state.materials.find((item) => item.id === where.id);
        if (!material) throw new Error('Material not found');
        Object.assign(material, cloneValue(data));
        return cloneValue(material);
      }
    },
    productionBatchOutput: {
      create: async ({ data }: { data: Omit<MockBatchOutput, 'id'> }) => {
        const output = { id: `output-${idCounter++}`, ...cloneValue(data) };
        state.outputs.push(output);
        return cloneValue(output);
      }
    },
    qualityCheck: {
      create: async ({ data }: { data: { referenceId: string; status: string } }) => {
        state.qualityChecks.push(cloneValue(data));
        return data;
      }
    },
    unitOfMeasure: {
      findMany: async ({
        where
      }: {
        where: { id: { in: string[] } };
      }) =>
        cloneValue(
          state.batches
            .flatMap((batch) => [
              ...batch.recipe.items.map((recipeItem) => ({
                abbreviation: recipeItem.unit.abbreviation,
                id: recipeItem.unitId
              })),
              ...batch.recipe.packagingItems.map((recipeItem) => ({
                abbreviation: recipeItem.unit.abbreviation,
                id: recipeItem.unitId
              }))
            ])
            .filter((unit) => where.id.in.includes(unit.id)),
        )
    },
    stockBalance: {
      findUnique: async ({
        where
      }: {
        where: { itemId_warehouseId: { itemId: string; warehouseId: string } };
      }) =>
        cloneValue(
          state.stockBalances.find(
            (row) =>
              row.itemId === where.itemId_warehouseId.itemId &&
              row.warehouseId === where.itemId_warehouseId.warehouseId,
          ) ?? null,
        ),
      update: async ({
        data,
        where
      }: {
        data: Partial<MockStockBalance>;
        where: { itemId_warehouseId: { itemId: string; warehouseId: string } };
      }) => {
        const balance = state.stockBalances.find(
          (row) =>
            row.itemId === where.itemId_warehouseId.itemId &&
            row.warehouseId === where.itemId_warehouseId.warehouseId,
        );
        if (!balance) throw new Error('Balance not found');
        Object.assign(balance, cloneValue(data));
        return cloneValue(balance);
      }
    },
    $transaction: async <T>(callback: (tx: Record<string, unknown>) => Promise<T>) => {
      const snapshot = cloneValue(state);
      try {
        return await callback(mock as unknown as Record<string, unknown>);
      } catch (error) {
        state = snapshot;
        throw error;
      }
    },
    __unsafeState: () => state,
    getState: () => cloneValue(state)
  };

  return mock;
}

async function withMockState<T>(
  initialState: MockState,
  callback: (mock: ReturnType<typeof createMockPrisma>) => Promise<T>,
) {
  const prismaAny = prisma as unknown as Record<string, unknown>;
  const inventoryAny = InventoryService as unknown as Record<string, unknown>;
  const mock = createMockPrisma(initialState);

  const originalPrisma = {
    $transaction: prismaAny.$transaction,
    auditLog: prismaAny.auditLog,
    item: prismaAny.item,
    productionBatch: prismaAny.productionBatch,
    productionBatchMaterial: prismaAny.productionBatchMaterial,
    productionBatchOutput: prismaAny.productionBatchOutput,
    qualityCheck: prismaAny.qualityCheck,
    stockBalance: prismaAny.stockBalance,
    unitOfMeasure: prismaAny.unitOfMeasure
  };
  const originalInventory = {
    addFinishedGoods: inventoryAny.addFinishedGoods,
    issueStock: inventoryAny.issueStock
  };

  Object.assign(prismaAny, {
    $transaction: mock.$transaction,
    auditLog: mock.auditLog,
    item: mock.item,
    productionBatch: mock.productionBatch,
    productionBatchMaterial: mock.productionBatchMaterial,
    productionBatchOutput: mock.productionBatchOutput,
    qualityCheck: mock.qualityCheck,
    stockBalance: mock.stockBalance,
    unitOfMeasure: mock.unitOfMeasure
  });

  inventoryAny.issueStock = async (
    _ctx: unknown,
    payload: { itemId: string; quantity: number; warehouseId: string },
    tx: ReturnType<typeof createMockPrisma>,
  ) => {
    const state = tx.__unsafeState();
    const balance = state.stockBalances.find(
      (row: MockStockBalance) => row.itemId === payload.itemId && row.warehouseId === payload.warehouseId,
    );
    if (!balance || balance.quantityOnHand.lessThan(payload.quantity)) {
      const error = new Error('NEGATIVE_STOCK_PREVENTED');
      throw error;
    }

    await tx.stockBalance.update({
      data: {
        quantityAvailable: balance.quantityAvailable.minus(payload.quantity),
        quantityOnHand: balance.quantityOnHand.minus(payload.quantity)
      },
      where: {
        itemId_warehouseId: { itemId: payload.itemId, warehouseId: payload.warehouseId }
      }
    });
    state.movements.push({
      itemId: payload.itemId,
      movementType: 'PRODUCTION_ISSUE',
      quantity: decimal(payload.quantity)
    });
  };

  inventoryAny.addFinishedGoods = async (
    _ctx: unknown,
    payload: { itemId: string; quantity: number; warehouseId: string },
    tx: ReturnType<typeof createMockPrisma>,
  ) => {
    const state = tx.__unsafeState();
    const balance = state.stockBalances.find(
      (row: MockStockBalance) => row.itemId === payload.itemId && row.warehouseId === payload.warehouseId,
    );
    if (!balance) {
      throw new Error('Balance not found');
    }
    await tx.stockBalance.update({
      data: {
        quantityAvailable: balance.quantityAvailable.plus(payload.quantity),
        quantityOnHand: balance.quantityOnHand.plus(payload.quantity)
      },
      where: {
        itemId_warehouseId: { itemId: payload.itemId, warehouseId: payload.warehouseId }
      }
    });
    state.movements.push({
      itemId: payload.itemId,
      movementType: 'PRODUCTION_OUTPUT',
      quantity: decimal(payload.quantity)
    });
    state.inventoryBatches.push({
      itemId: payload.itemId,
      quantityRemaining: decimal(payload.quantity),
      warehouseId: payload.warehouseId
    });
  };

  try {
    return await callback(mock);
  } finally {
    Object.assign(prismaAny, originalPrisma);
    Object.assign(inventoryAny, originalInventory);
  }
}

test('reserveMaterials rolls back ALL if ANY item insufficient', async () => {
  await withMockState(
    createState({
      stockBalances: [
        { itemId: 'item-rm-1', quantityAvailable: decimal(5), quantityOnHand: decimal(5), quantityReserved: decimal(0), warehouseId: 'warehouse-1' },
        { itemId: 'item-rm-2', quantityAvailable: decimal(4), quantityOnHand: decimal(4), quantityReserved: decimal(0), warehouseId: 'warehouse-1' }
      ]
    }),
    async (mock) => {
      await assert.rejects(
        () => ProductionService.reserveMaterials(context, 'batch-1'),
        (error: Error & { code?: string }) => error.code === 'INSUFFICIENT_STOCK_FOR_BATCH',
      );
      const state = mock.getState();
      assert.equal(state.stockBalances[0]?.quantityReserved.toNumber(), 0);
      assert.equal(state.stockBalances[1]?.quantityReserved.toNumber(), 0);
    },
  );
});

test('reserveMaterials succeeds when all items available', async () => {
  await withMockState(createState(), async (mock) => {
    await ProductionService.reserveMaterials(context, 'batch-1');
    const state = mock.getState();
    assert.equal(state.stockBalances[0]?.quantityReserved.toNumber(), 20);
    assert.equal(state.stockBalances[1]?.quantityReserved.toNumber(), 10);
    assert.equal(state.batches[0]?.status, 'MATERIALS_RESERVED');
  });
});

test('closeBatch deducts raw materials from stock', async () => {
  await withMockState(
    createState({
      batches: [{ ...createState().batches[0]!, qualityStatus: 'PASSED', status: 'QUALITY_CHECK' }],
      materials: [
        {
          batchId: 'batch-1',
          id: 'material-1',
          itemId: 'item-rm-1',
          quantityActual: decimal(0),
          quantityIssued: decimal(0),
          quantityRequired: decimal(20),
          unitId: 'uom-1',
          variance: decimal(0)
        }
      ],
      stockBalances: [
        { itemId: 'item-rm-1', quantityAvailable: decimal(100), quantityOnHand: decimal(100), quantityReserved: decimal(20), warehouseId: 'warehouse-1' },
        { itemId: 'item-fg', quantityAvailable: decimal(0), quantityOnHand: decimal(0), quantityReserved: decimal(0), warehouseId: 'warehouse-1' }
      ]
    }),
    async (mock) => {
      await ProductionService.closeBatch(context, 'batch-1', { actualMaterials: [{ itemId: 'item-rm-1', quantityActual: 20 }] });
      const state = mock.getState();
      assert.equal(state.stockBalances[0]?.quantityOnHand.toNumber(), 80);
      assert.ok(state.movements.some((row: { movementType: string }) => row.movementType === 'PRODUCTION_ISSUE'));
    },
  );
});

test('closeBatch adds finished goods to inventory', async () => {
  await withMockState(
    createState({
      batches: [{ ...createState().batches[0]!, qualityStatus: 'PASSED', status: 'QUALITY_CHECK' }],
      materials: [
        {
          batchId: 'batch-1',
          id: 'material-1',
          itemId: 'item-rm-1',
          quantityActual: decimal(0),
          quantityIssued: decimal(0),
          quantityRequired: decimal(20),
          unitId: 'uom-1',
          variance: decimal(0)
        }
      ],
      stockBalances: [
        { itemId: 'item-rm-1', quantityAvailable: decimal(100), quantityOnHand: decimal(100), quantityReserved: decimal(20), warehouseId: 'warehouse-1' },
        { itemId: 'item-fg', quantityAvailable: decimal(0), quantityOnHand: decimal(0), quantityReserved: decimal(0), warehouseId: 'warehouse-1' }
      ]
    }),
    async (mock) => {
      await ProductionService.closeBatch(context, 'batch-1', { actualMaterials: [{ itemId: 'item-rm-1', quantityActual: 20 }] });
      const state = mock.getState();
      assert.equal(state.stockBalances[1]?.quantityOnHand.toNumber(), 95);
      assert.ok(state.movements.some((row: { movementType: string }) => row.movementType === 'PRODUCTION_OUTPUT'));
      assert.equal(state.inventoryBatches.length, 1);
    },
  );
});

test('closeBatch throws if quality status is FAILED', async () => {
  await withMockState(
    createState({
      batches: [{ ...createState().batches[0]!, qualityStatus: 'FAILED', status: 'QUALITY_CHECK' }]
    }),
    async () => {
      await assert.rejects(
        () => ProductionService.closeBatch(context, 'batch-1', { actualMaterials: [] }),
        (error: Error & { code?: string }) => error.code === 'QUALITY_CHECK_FAILED',
      );
    },
  );
});

test('cancelBatch releases reserved stock', async () => {
  await withMockState(
    createState({
      batches: [{ ...createState().batches[0]!, status: 'MATERIALS_RESERVED' }],
      materials: [
        {
          batchId: 'batch-1',
          id: 'material-1',
          itemId: 'item-rm-1',
          quantityActual: decimal(0),
          quantityIssued: decimal(0),
          quantityRequired: decimal(20),
          unitId: 'uom-1',
          variance: decimal(0)
        }
      ],
      stockBalances: [
        { itemId: 'item-rm-1', quantityAvailable: decimal(80), quantityOnHand: decimal(100), quantityReserved: decimal(20), warehouseId: 'warehouse-1' }
      ]
    }),
    async (mock) => {
      await ProductionService.cancelBatch(context, 'batch-1', { reason: 'QA failed' });
      const state = mock.getState();
      assert.equal(state.stockBalances[0]?.quantityReserved.toNumber(), 0);
      assert.equal(state.stockBalances[0]?.quantityAvailable.toNumber(), 100);
      assert.equal(state.batches[0]?.status, 'CANCELLED');
    },
  );
});

test('invalid status transition throws error', async () => {
  await withMockState(
    createState({
      batches: [{ ...createState().batches[0]!, status: 'DRAFT' }]
    }),
    async () => {
      await assert.rejects(
        () => ProductionService.closeBatch(context, 'batch-1', { actualMaterials: [] }),
        (error: Error & { code?: string }) => error.code === 'INVALID_STATUS_TRANSITION',
      );
    },
  );
});

test('closeBatch throws on negative stock detection', async () => {
  await withMockState(
    createState({
      batches: [{ ...createState().batches[0]!, qualityStatus: 'PASSED', status: 'QUALITY_CHECK' }],
      materials: [
        {
          batchId: 'batch-1',
          id: 'material-1',
          itemId: 'item-rm-1',
          quantityActual: decimal(0),
          quantityIssued: decimal(0),
          quantityRequired: decimal(20),
          unitId: 'uom-1',
          variance: decimal(0)
        }
      ],
      stockBalances: [
        { itemId: 'item-rm-1', quantityAvailable: decimal(2), quantityOnHand: decimal(2), quantityReserved: decimal(2), warehouseId: 'warehouse-1' },
        { itemId: 'item-fg', quantityAvailable: decimal(0), quantityOnHand: decimal(0), quantityReserved: decimal(0), warehouseId: 'warehouse-1' }
      ]
    }),
    async (mock) => {
      await assert.rejects(
        () => ProductionService.closeBatch(context, 'batch-1', { actualMaterials: [{ itemId: 'item-rm-1', quantityActual: 20 }] }),
        /NEGATIVE_STOCK_PREVENTED/,
      );
      const state = mock.getState();
      assert.equal(state.batches[0]?.status, 'QUALITY_CHECK');
      assert.equal(state.stockBalances[0]?.quantityOnHand.toNumber(), 2);
    },
  );
});
