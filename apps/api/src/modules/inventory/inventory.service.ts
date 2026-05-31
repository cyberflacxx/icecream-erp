import {
  PrismaClient,
  type Prisma
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import {
  InventoryBatchStatus,
  ItemType,
  StockMovementType,
  TransferStatus,
  WarehouseType
} from './inventory.constants';

type DbClient = PrismaClient | Prisma.TransactionClient;

interface InventoryContext {
  branchId: string | null;
  isBranchScoped: boolean;
  organizationId: string;
  userProfileId: string;
}

interface ReferenceInput {
  id: string;
  notes?: string | null;
  type: string;
}

interface ReceiveStockInput {
  batchNumber: string;
  expiryDate?: string;
  itemId: string;
  manufacturedDate?: string;
  quantity: number;
  reference: ReferenceInput;
  supplierId?: string;
  unitCost: number;
  warehouseId: string;
}

interface ReserveStockInput {
  batchId?: string;
  itemId: string;
  quantity: number;
  reference: ReferenceInput;
  warehouseId: string;
}

interface IssueStockInput {
  allowExpired?: boolean;
  itemId: string;
  movementType?: StockMovementType;
  overrideReason?: string;
  quantity: number;
  reference: ReferenceInput;
  warehouseId: string;
}

interface AddFinishedGoodsInput {
  batchNumber: string;
  itemId: string;
  productionBatchId: string;
  quantity: number;
  reference?: ReferenceInput;
  unitCost?: number;
  warehouseId: string;
}

interface TransferStockInput {
  fromWarehouseId: string;
  items: Array<{
    itemId: string;
    quantity: number;
  }>;
  notes?: string | null;
  requestedBy?: string;
  toWarehouseId: string;
}

interface AdjustStockInput {
  itemId: string;
  quantity: number;
  reason: string;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  warehouseId: string;
}

interface PaginationInput {
  page: number;
  pageSize: number;
}

interface MovementFilters extends PaginationInput {
  endDate?: string;
  itemId?: string;
  startDate?: string;
  type?: StockMovementType;
  warehouseId?: string;
}

interface ItemFilters extends PaginationInput {
  category?: string;
  search?: string;
  status?: 'active' | 'inactive';
  type?: ItemType;
}

interface StockBalanceFilters extends PaginationInput {
  itemId?: string;
  itemType?: ItemType;
  lowStock?: boolean;
  warehouseId?: string;
}

interface TransferFilters extends PaginationInput {
  fromWarehouseId?: string;
  status?: TransferStatus;
  toWarehouseId?: string;
}

const decimal = (value: Prisma.Decimal | number | string) =>
  value instanceof Decimal ? value : new Decimal(value);

const decimalToNumber = (value: Prisma.Decimal | null | undefined) =>
  value ? Number(value.toString()) : 0;

const now = () => new Date();
const isProductionReference = (referenceType: string) => referenceType.toLowerCase().includes('production');

function formatQuantity(value: Prisma.Decimal | number) {
  return decimal(value).toFixed(3);
}

function createPaginationResult<T>(data: T[], page: number, pageSize: number) {
  const total = data.length;
  const start = (page - 1) * pageSize;

  return {
    data: data.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total
    }
  };
}

async function withTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  tx?: Prisma.TransactionClient,
) {
  if (tx) {
    return callback(tx);
  }

  return prisma.$transaction(callback);
}

function getWarehouseScope(context: InventoryContext) {
  return context.isBranchScoped && context.branchId ? { branchId: context.branchId } : {};
}

async function getItemOrThrow(db: DbClient, context: InventoryContext, itemId: string) {
  const item = await db.item.findFirst({
    where: {
      deletedAt: null,
      id: itemId,
      organizationId: context.organizationId
    },
    include: {
      category: true,
      unitOfMeasure: true
    }
  });

  if (!item) {
    throw new Error('Inventory item not found.');
  }

  return item;
}

async function getWarehouseOrThrow(db: DbClient, context: InventoryContext, warehouseId: string) {
  const warehouse = await db.warehouse.findFirst({
    where: {
      id: warehouseId,
      isActive: true,
      organizationId: context.organizationId,
      ...getWarehouseScope(context)
    },
    include: {
      branch: true
    }
  });

  if (!warehouse) {
    throw new Error('Warehouse not found or not available for this user.');
  }

  return warehouse;
}

async function getBalanceOrCreate(
  db: DbClient,
  context: InventoryContext,
  itemId: string,
  warehouseId: string,
) {
  const existing = await db.stockBalance.findUnique({
    where: {
      itemId_warehouseId: {
        itemId,
        warehouseId
      }
    }
  });

  if (existing) {
    return existing;
  }

  return db.stockBalance.create({
    data: {
      itemId,
      organizationId: context.organizationId,
      quantityAvailable: decimal(0),
      quantityOnHand: decimal(0),
      quantityReserved: decimal(0),
      warehouseId
    }
  });
}

async function updateBalance(
  db: DbClient,
  balanceId: string,
  nextOnHand: Prisma.Decimal,
  nextReserved: Prisma.Decimal,
) {
  const nextAvailable = nextOnHand.minus(nextReserved);

  if (nextOnHand.lessThan(0) || nextReserved.lessThan(0) || nextAvailable.lessThan(0)) {
    throw new Error('Stock rules violation: resulting balance would be negative.');
  }

  return db.stockBalance.update({
    where: {
      id: balanceId
    },
    data: {
      lastUpdated: now(),
      quantityAvailable: nextAvailable,
      quantityOnHand: nextOnHand,
      quantityReserved: nextReserved
    },
    include: {
      item: {
        include: {
          category: true,
          unitOfMeasure: true
        }
      },
      warehouse: {
        include: {
          branch: true
        }
      }
    }
  });
}

async function createMovement(
  db: DbClient,
  context: InventoryContext,
  input: {
    batchId?: string | null;
    itemId: string;
    movementType: StockMovementType;
    notes?: string | null;
    quantity: Prisma.Decimal;
    reference: ReferenceInput;
    unitCost?: Prisma.Decimal | null;
    warehouseId: string;
  },
) {
  const unitCost = input.unitCost ?? null;
  const totalCost = unitCost ? unitCost.mul(input.quantity) : null;

  return db.stockMovement.create({
    data: {
      batchId: input.batchId ?? null,
      createdBy: context.userProfileId,
      itemId: input.itemId,
      movementType: input.movementType,
      notes: input.notes ?? input.reference.notes ?? null,
      organizationId: context.organizationId,
      quantity: input.quantity,
      referenceId: input.reference.id,
      referenceType: input.reference.type,
      totalCost,
      unitCost,
      warehouseId: input.warehouseId
    }
  });
}

async function createAuditEntry(
  db: DbClient,
  context: InventoryContext,
  input: {
    action: string;
    entityId: string;
    entityType: string;
    newValues?: Prisma.InputJsonValue;
    oldValues?: Prisma.InputJsonValue;
  },
) {
  return db.auditLog.create({
    data: {
      action: input.action,
      entityId: input.entityId,
      entityType: input.entityType,
      newValues: input.newValues,
      oldValues: input.oldValues,
      organizationId: context.organizationId,
      userProfileId: context.userProfileId
    }
  });
}

function ensureEnoughStock(itemName: string, available: Prisma.Decimal, required: Prisma.Decimal) {
  if (available.lessThan(required)) {
    throw new Error(
      `Insufficient stock for ${itemName}. Available: ${formatQuantity(available)}, Required: ${formatQuantity(required)}`,
    );
  }
}

function sortBatchesForFifo<T extends { createdAt: Date; expiryDate: Date | null }>(batches: T[]) {
  return [...batches].sort((left, right) => {
    if (left.expiryDate && right.expiryDate) {
      return left.expiryDate.getTime() - right.expiryDate.getTime();
    }

    if (left.expiryDate && !right.expiryDate) {
      return -1;
    }

    if (!left.expiryDate && right.expiryDate) {
      return 1;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

async function upsertIncomingBatch(
  db: DbClient,
  context: InventoryContext,
  input: {
    batchNumber: string;
    expiryDate?: Date | null;
    itemId: string;
    manufacturedDate?: Date | null;
    quantity: Prisma.Decimal;
    supplierId?: string | null;
    unitCost: Prisma.Decimal;
    warehouseId: string;
  },
) {
  const existing = await db.inventoryBatch.findUnique({
    where: {
      warehouseId_itemId_batchNumber: {
        batchNumber: input.batchNumber,
        itemId: input.itemId,
        warehouseId: input.warehouseId
      }
    }
  });

  if (existing) {
    return db.inventoryBatch.update({
      where: {
        id: existing.id
      },
      data: {
        expiryDate: input.expiryDate ?? existing.expiryDate,
        manufacturedDate: input.manufacturedDate ?? existing.manufacturedDate,
        quantityReceived: existing.quantityReceived.plus(input.quantity),
        quantityRemaining: existing.quantityRemaining.plus(input.quantity),
        status: InventoryBatchStatus.ACTIVE,
        supplierId: input.supplierId ?? existing.supplierId,
        unitCost: input.unitCost
      }
    });
  }

  return db.inventoryBatch.create({
    data: {
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate ?? null,
      itemId: input.itemId,
      manufacturedDate: input.manufacturedDate ?? null,
      organizationId: context.organizationId,
      quantityReceived: input.quantity,
      quantityRemaining: input.quantity,
      supplierId: input.supplierId ?? null,
      unitCost: input.unitCost,
      warehouseId: input.warehouseId
    }
  });
}

function mapBalance(balance: Awaited<ReturnType<typeof updateBalance>>) {
  return {
    id: balance.id,
    item: {
      id: balance.item.id,
      code: balance.item.code,
      name: balance.item.name,
      itemType: balance.item.itemType,
      reorderLevel: decimalToNumber(balance.item.reorderLevel),
      unitOfMeasure: {
        id: balance.item.unitOfMeasure.id,
        abbreviation: balance.item.unitOfMeasure.abbreviation,
        name: balance.item.unitOfMeasure.name
      }
    },
    lastUpdated: balance.lastUpdated,
    quantityAvailable: decimalToNumber(balance.quantityAvailable),
    quantityOnHand: decimalToNumber(balance.quantityOnHand),
    quantityReserved: decimalToNumber(balance.quantityReserved),
    warehouse: {
      id: balance.warehouse.id,
      code: balance.warehouse.code,
      name: balance.warehouse.name,
      branch: balance.warehouse.branch
        ? {
            id: balance.warehouse.branch.id,
            name: balance.warehouse.branch.name
          }
        : null
    }
  };
}

function mapMovement<T>(movement: T) {
  return movement;
}

export class InventoryService {
  static async listItems(context: InventoryContext, filters: ItemFilters) {
    const items = await prisma.item.findMany({
      where: {
        categoryId: filters.category,
        deletedAt: null,
        isActive:
          filters.status === 'active'
            ? true
            : filters.status === 'inactive'
              ? false
              : undefined,
        itemType: filters.type,
        organizationId: context.organizationId,
        OR: filters.search
          ? [
              {
                code: {
                  contains: filters.search,
                  mode: 'insensitive'
                }
              },
              {
                name: {
                  contains: filters.search,
                  mode: 'insensitive'
                }
              }
            ]
          : undefined
      },
      include: {
        category: true,
        unitOfMeasure: true,
        stockBalances: {
          where: {
            warehouse: getWarehouseScope(context)
          }
        }
      },
      orderBy: [
        {
          isActive: 'desc'
        },
        {
          name: 'asc'
        }
      ]
    });

    const mapped = items.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      itemType: item.itemType,
      isActive: item.isActive,
      reorderLevel: decimalToNumber(item.reorderLevel),
      reorderQuantity: decimalToNumber(item.reorderQuantity),
      sellingPrice: decimalToNumber(item.sellingPrice),
      stock: item.stockBalances.reduce((sum, balance) => sum + decimalToNumber(balance.quantityOnHand), 0),
      trackExpiry: item.trackExpiry,
      unitCost: decimalToNumber(item.unitCost),
      category: {
        id: item.category.id,
        name: item.category.name
      },
      unitOfMeasure: {
        id: item.unitOfMeasure.id,
        abbreviation: item.unitOfMeasure.abbreviation,
        name: item.unitOfMeasure.name
      }
    }));

    return createPaginationResult(mapped, filters.page, filters.pageSize);
  }

  static async createItem(context: InventoryContext, input: {
    categoryId: string;
    code: string;
    description?: string | null;
    isActive: boolean;
    itemType: ItemType;
    name: string;
    reorderLevel?: number;
    reorderQuantity?: number;
    sellingPrice?: number;
    trackExpiry: boolean;
    unitCost?: number;
    unitOfMeasureId: string;
  }) {
    const [category, unit] = await Promise.all([
      prisma.itemCategory.findFirst({
        where: {
          id: input.categoryId,
          organizationId: context.organizationId
        }
      }),
      prisma.unitOfMeasure.findFirst({
        where: {
          id: input.unitOfMeasureId,
          organizationId: context.organizationId
        }
      })
    ]);

    if (!category || !unit) {
      throw new Error('Item category or unit of measure was not found.');
    }

    return prisma.item.create({
      data: {
        categoryId: input.categoryId,
        code: input.code,
        description: input.description ?? null,
        isActive: input.isActive,
        itemType: input.itemType,
        name: input.name,
        organizationId: context.organizationId,
        reorderLevel: input.reorderLevel ?? null,
        reorderQuantity: input.reorderQuantity ?? null,
        sellingPrice: input.sellingPrice ?? null,
        trackExpiry: input.trackExpiry,
        unitCost: input.unitCost ?? null,
        unitOfMeasureId: input.unitOfMeasureId
      },
      include: {
        category: true,
        unitOfMeasure: true
      }
    });
  }

  static async updateItem(
    context: InventoryContext,
    itemId: string,
    input: Partial<{
      categoryId: string;
      code: string;
      description: string | null;
      isActive: boolean;
      itemType: ItemType;
      name: string;
      reorderLevel: number | null;
      reorderQuantity: number | null;
      sellingPrice: number | null;
      trackExpiry: boolean;
      unitCost: number | null;
      unitOfMeasureId: string;
    }>,
  ) {
    await getItemOrThrow(prisma, context, itemId);

    return prisma.item.update({
      where: {
        id: itemId
      },
      data: {
        ...input
      },
      include: {
        category: true,
        unitOfMeasure: true
      }
    });
  }

  static async listWarehouses(context: InventoryContext) {
    const warehouses = await prisma.warehouse.findMany({
      where: {
        organizationId: context.organizationId,
        ...getWarehouseScope(context)
      },
      include: {
        branch: true,
        stockBalances: {
          include: {
            item: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return warehouses.map((warehouse) => ({
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      type: warehouse.type,
      isActive: warehouse.isActive,
      branch: warehouse.branch
        ? {
            id: warehouse.branch.id,
            name: warehouse.branch.name
          }
        : null,
      itemCount: warehouse.stockBalances.filter((balance) => balance.quantityOnHand.greaterThan(0)).length,
      totalValue: warehouse.stockBalances.reduce((sum, balance) => {
        const itemUnitCost = balance.item.unitCost ?? decimal(0);

        return sum + decimalToNumber(balance.quantityOnHand.mul(itemUnitCost));
      }, 0)
    }));
  }

  static async createWarehouse(context: InventoryContext, input: {
    address?: string | null;
    branchId?: string | null;
    code: string;
    isActive: boolean;
    name: string;
    type: WarehouseType;
  }) {
    if (input.branchId) {
      const branch = await prisma.branch.findFirst({
        where: {
          id: input.branchId,
          organizationId: context.organizationId
        }
      });

      if (!branch) {
        throw new Error('Branch not found.');
      }
    }

    return prisma.warehouse.create({
      data: {
        address: input.address ?? null,
        branchId: input.branchId ?? null,
        code: input.code,
        isActive: input.isActive,
        name: input.name,
        organizationId: context.organizationId,
        type: input.type
      },
      include: {
        branch: true
      }
    });
  }

  static async getInventoryMeta(context: InventoryContext, options?: { includeInactiveItems?: boolean }) {
    const [categories, unitsOfMeasure, branches, warehouses, items] = await Promise.all([
      prisma.itemCategory.findMany({
        where: {
          organizationId: context.organizationId
        },
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.unitOfMeasure.findMany({
        where: {
          organizationId: context.organizationId
        },
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.branch.findMany({
        where: {
          deletedAt: null,
          organizationId: context.organizationId
        },
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.warehouse.findMany({
        where: {
          organizationId: context.organizationId,
          ...getWarehouseScope(context)
        },
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.item.findMany({
        where: {
          deletedAt: null,
          isActive: options?.includeInactiveItems ? undefined : true,
          organizationId: context.organizationId
        },
        orderBy: {
          name: 'asc'
        }
      })
    ]);

    return {
      branches,
      categories,
      items,
      unitsOfMeasure,
      warehouses
    };
  }

  static async listStockBalances(context: InventoryContext, filters: StockBalanceFilters) {
    const balances = await prisma.stockBalance.findMany({
      where: {
        itemId: filters.itemId,
        organizationId: context.organizationId,
        warehouseId: filters.warehouseId,
        warehouse: getWarehouseScope(context),
        item: {
          deletedAt: null,
          itemType: filters.itemType
        }
      },
      include: {
        item: {
          include: {
            category: true,
            unitOfMeasure: true
          }
        },
        warehouse: {
          include: {
            branch: true
          }
        }
      },
      orderBy: [
        {
          warehouse: {
            name: 'asc'
          }
        },
        {
          item: {
            name: 'asc'
          }
        }
      ]
    });

    const mapped = balances
      .map((balance) => mapBalance(balance as Awaited<ReturnType<typeof updateBalance>>))
      .filter((balance) =>
        filters.lowStock
          ? balance.item.reorderLevel > 0 && balance.quantityAvailable <= balance.item.reorderLevel
          : true,
      );

    return createPaginationResult(mapped, filters.page, filters.pageSize);
  }

  static async getStockBalance(context: InventoryContext, itemId: string, warehouseId: string) {
    const balance = await prisma.stockBalance.findFirst({
      where: {
        itemId,
        organizationId: context.organizationId,
        warehouseId,
        warehouse: getWarehouseScope(context)
      },
      include: {
        item: {
          include: {
            category: true,
            unitOfMeasure: true
          }
        },
        warehouse: {
          include: {
            branch: true
          }
        }
      }
    });

    if (!balance) {
      throw new Error('Stock balance not found.');
    }

    return mapBalance(balance as Awaited<ReturnType<typeof updateBalance>>);
  }

  static async listStockMovements(context: InventoryContext, filters: MovementFilters) {
    const movements = await prisma.stockMovement.findMany({
      where: {
        createdAt:
          filters.startDate || filters.endDate
            ? {
                gte: filters.startDate ? new Date(`${filters.startDate}T00:00:00.000Z`) : undefined,
                lte: filters.endDate ? new Date(`${filters.endDate}T23:59:59.999Z`) : undefined
              }
            : undefined,
        itemId: filters.itemId,
        movementType: filters.type,
        organizationId: context.organizationId,
        warehouseId: filters.warehouseId,
        warehouse: getWarehouseScope(context)
      },
      include: {
        createdByUser: true,
        item: true,
        warehouse: {
          include: {
            branch: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const mapped = movements.map((movement) => ({
      id: movement.id,
      date: movement.createdAt,
      item: {
        id: movement.item.id,
        code: movement.item.code,
        name: movement.item.name
      },
      warehouse: {
        id: movement.warehouse.id,
        name: movement.warehouse.name
      },
      type: movement.movementType,
      quantity: decimalToNumber(movement.quantity),
      unitCost: decimalToNumber(movement.unitCost),
      totalCost: decimalToNumber(movement.totalCost),
      reference: {
        id: movement.referenceId,
        type: movement.referenceType
      },
      createdBy: movement.createdByUser
        ? {
            id: movement.createdByUser.id,
            name: `${movement.createdByUser.firstName} ${movement.createdByUser.lastName}`.trim()
          }
        : null,
      notes: movement.notes
    }));

    return createPaginationResult(mapped.map(mapMovement), filters.page, filters.pageSize);
  }

  static async receiveStock(context: InventoryContext, input: ReceiveStockInput, tx?: Prisma.TransactionClient) {
    return withTransaction(async (db) => {
      const [item, warehouse] = await Promise.all([
        getItemOrThrow(db, context, input.itemId),
        getWarehouseOrThrow(db, context, input.warehouseId)
      ]);
      void warehouse;

      const quantity = decimal(input.quantity);
      const unitCost = decimal(input.unitCost);
      const batch = await upsertIncomingBatch(db, context, {
        batchNumber: input.batchNumber,
        expiryDate: input.expiryDate ? new Date(`${input.expiryDate}T00:00:00.000Z`) : null,
        itemId: item.id,
        manufacturedDate: input.manufacturedDate
          ? new Date(`${input.manufacturedDate}T00:00:00.000Z`)
          : null,
        quantity,
        supplierId: input.supplierId ?? null,
        unitCost,
        warehouseId: input.warehouseId
      });

      const balance = await getBalanceOrCreate(db, context, item.id, input.warehouseId);
      const updatedBalance = await updateBalance(
        db,
        balance.id,
        balance.quantityOnHand.plus(quantity),
        balance.quantityReserved,
      );

      await createMovement(db, context, {
        batchId: batch.id,
        itemId: item.id,
        movementType: StockMovementType.PURCHASE_RECEIVE,
        quantity,
        reference: input.reference,
        unitCost,
        warehouseId: input.warehouseId
      });

      return mapBalance(updatedBalance);
    }, tx);
  }

  static async reserveStock(context: InventoryContext, input: ReserveStockInput, tx?: Prisma.TransactionClient) {
    return withTransaction(async (db) => {
      const item = await getItemOrThrow(db, context, input.itemId);
      await getWarehouseOrThrow(db, context, input.warehouseId);

      if (input.batchId) {
        const batch = await db.inventoryBatch.findFirst({
          where: {
            id: input.batchId,
            itemId: input.itemId,
            organizationId: context.organizationId,
            warehouseId: input.warehouseId
          }
        });

        if (!batch) {
          throw new Error('Inventory batch not found for reservation.');
        }

        if (batch.quantityRemaining.lessThan(decimal(input.quantity))) {
          throw new Error(
            `Insufficient stock for ${item.name}. Available: ${formatQuantity(batch.quantityRemaining)}, Required: ${formatQuantity(input.quantity)}`,
          );
        }
      }

      const balance = await getBalanceOrCreate(db, context, input.itemId, input.warehouseId);
      const required = decimal(input.quantity);

      ensureEnoughStock(item.name, balance.quantityAvailable, required);

      const updatedBalance = await updateBalance(
        db,
        balance.id,
        balance.quantityOnHand,
        balance.quantityReserved.plus(required),
      );

      await createMovement(db, context, {
        batchId: input.batchId ?? null,
        itemId: input.itemId,
        movementType: StockMovementType.PRODUCTION_ISSUE,
        quantity: required,
        reference: input.reference,
        warehouseId: input.warehouseId
      });

      return {
        batchId: input.batchId ?? null,
        itemId: input.itemId,
        quantityReserved: decimalToNumber(required),
        reference: input.reference,
        stockBalance: mapBalance(updatedBalance)
      };
    }, tx);
  }

  static async issueStock(context: InventoryContext, input: IssueStockInput, tx?: Prisma.TransactionClient) {
    return withTransaction(async (db) => {
      const item = await getItemOrThrow(db, context, input.itemId);
      await getWarehouseOrThrow(db, context, input.warehouseId);

      const balance = await getBalanceOrCreate(db, context, input.itemId, input.warehouseId);
      const required = decimal(input.quantity);
      const productionReference = isProductionReference(input.reference.type);

      ensureEnoughStock(
        item.name,
        productionReference ? balance.quantityOnHand : balance.quantityAvailable,
        required,
      );

      const batches = await db.inventoryBatch.findMany({
        where: {
          itemId: input.itemId,
          organizationId: context.organizationId,
          quantityRemaining: {
            gt: decimal(0)
          },
          status: {
            in: [InventoryBatchStatus.ACTIVE, InventoryBatchStatus.EXPIRED]
          },
          warehouseId: input.warehouseId
        }
      });

      const fifoBatches = sortBatchesForFifo(batches);
      let remainingToIssue = required;
      const movementChunks: Array<{
        batchId: string;
        batchNumber: string;
        quantity: number;
        unitCost: number;
      }> = [];

      for (const batch of fifoBatches) {
        if (remainingToIssue.lessThanOrEqualTo(decimal(0))) {
          break;
        }

        const batchExpired = Boolean(batch.expiryDate && batch.expiryDate.getTime() < now().setHours(0, 0, 0, 0));

        if (batchExpired && !input.allowExpired) {
          throw new Error(
            `Batch ${batch.batchNumber} for ${item.name} is expired and cannot be issued without an override.`,
          );
        }

        if (batchExpired && input.allowExpired && !input.overrideReason) {
          throw new Error('Expired stock override requires a reason.');
        }

        const chunkQuantity = batch.quantityRemaining.lessThan(remainingToIssue)
          ? batch.quantityRemaining
          : remainingToIssue;

        if (chunkQuantity.lessThanOrEqualTo(decimal(0))) {
          continue;
        }

        const nextRemaining = batch.quantityRemaining.minus(chunkQuantity);

        await db.inventoryBatch.update({
          where: {
            id: batch.id
          },
          data: {
            quantityRemaining: nextRemaining,
            status: nextRemaining.equals(0) ? InventoryBatchStatus.DEPLETED : batch.status
          }
        });

        await createMovement(db, context, {
          batchId: batch.id,
          itemId: input.itemId,
          movementType: input.movementType ?? StockMovementType.PRODUCTION_ISSUE,
          notes: input.overrideReason ?? input.reference.notes,
          quantity: chunkQuantity,
          reference: input.reference,
          unitCost: batch.unitCost,
          warehouseId: input.warehouseId
        });

        movementChunks.push({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: decimalToNumber(chunkQuantity),
          unitCost: decimalToNumber(batch.unitCost)
        });
        remainingToIssue = remainingToIssue.minus(chunkQuantity);
      }

      if (remainingToIssue.greaterThan(0)) {
        throw new Error(
          `Insufficient stock for ${item.name}. Available: ${formatQuantity(required.minus(remainingToIssue))}, Required: ${formatQuantity(required)}`,
        );
      }

      const reservedReduction = productionReference
        ? balance.quantityReserved.lessThan(required)
          ? balance.quantityReserved
          : required
        : decimal(0);

      const updatedBalance = await updateBalance(
        db,
        balance.id,
        balance.quantityOnHand.minus(required),
        balance.quantityReserved.minus(reservedReduction),
      );

      return {
        item: {
          id: item.id,
          name: item.name
        },
        movementType: input.movementType ?? StockMovementType.PRODUCTION_ISSUE,
        quantityIssued: decimalToNumber(required),
        stockBalance: mapBalance(updatedBalance),
        batches: movementChunks
      };
    }, tx);
  }

  static async addFinishedGoods(
    context: InventoryContext,
    input: AddFinishedGoodsInput,
    tx?: Prisma.TransactionClient,
  ) {
    return withTransaction(async (db) => {
      const item = await getItemOrThrow(db, context, input.itemId);

      if (item.itemType !== ItemType.FINISHED_GOOD) {
        throw new Error('Finished goods can only be created for FINISHED_GOOD items.');
      }

      await getWarehouseOrThrow(db, context, input.warehouseId);

      const quantity = decimal(input.quantity);
      const unitCost = decimal(input.unitCost ?? item.unitCost ?? 0);
      const batch = await upsertIncomingBatch(db, context, {
        batchNumber: input.batchNumber,
        itemId: input.itemId,
        quantity,
        unitCost,
        warehouseId: input.warehouseId
      });

      const balance = await getBalanceOrCreate(db, context, input.itemId, input.warehouseId);
      const updatedBalance = await updateBalance(
        db,
        balance.id,
        balance.quantityOnHand.plus(quantity),
        balance.quantityReserved,
      );

      await createMovement(db, context, {
        batchId: batch.id,
        itemId: input.itemId,
        movementType: StockMovementType.PRODUCTION_OUTPUT,
        quantity,
        reference:
          input.reference ?? {
            id: input.productionBatchId,
            type: 'production_batch'
          },
        unitCost,
        warehouseId: input.warehouseId
      });

      return mapBalance(updatedBalance);
    }, tx);
  }

  static async transferStock(context: InventoryContext, input: TransferStockInput) {
    return prisma.$transaction(async (db) => {
      const [fromWarehouse, toWarehouse] = await Promise.all([
        getWarehouseOrThrow(db, context, input.fromWarehouseId),
        getWarehouseOrThrow(db, context, input.toWarehouseId)
      ]);

      if (fromWarehouse.id === toWarehouse.id) {
        throw new Error('Source and destination warehouses must be different.');
      }

      const transferCount = await db.stockTransfer.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const transferNumber = `TRF-${String(transferCount + 1).padStart(5, '0')}`;

      const transfer = await db.stockTransfer.create({
        data: {
          approvedBy: context.userProfileId,
          fromWarehouseId: input.fromWarehouseId,
          notes: input.notes ?? null,
          organizationId: context.organizationId,
          requestedBy: input.requestedBy ?? context.userProfileId,
          status: TransferStatus.COMPLETED,
          toWarehouseId: input.toWarehouseId,
          transferDate: now(),
          transferNumber
        }
      });

      for (const itemRow of input.items) {
        const issued = await InventoryService.issueStock(
          context,
          {
            itemId: itemRow.itemId,
            movementType: StockMovementType.TRANSFER_OUT,
            quantity: itemRow.quantity,
            reference: {
              id: transfer.id,
              notes: input.notes,
              type: 'stock_transfer'
            },
            warehouseId: input.fromWarehouseId
          },
          db,
        );

        for (const chunk of issued.batches) {
          const sourceBatch = await db.inventoryBatch.findUniqueOrThrow({
            where: {
              id: chunk.batchId
            }
          });

          const quantity = decimal(chunk.quantity);
          const incomingBatch = await upsertIncomingBatch(db, context, {
            batchNumber: sourceBatch.batchNumber,
            expiryDate: sourceBatch.expiryDate,
            itemId: itemRow.itemId,
            manufacturedDate: sourceBatch.manufacturedDate,
            quantity,
            supplierId: sourceBatch.supplierId,
            unitCost: sourceBatch.unitCost,
            warehouseId: input.toWarehouseId
          });

          const destinationBalance = await getBalanceOrCreate(db, context, itemRow.itemId, input.toWarehouseId);
          await updateBalance(
            db,
            destinationBalance.id,
            destinationBalance.quantityOnHand.plus(quantity),
            destinationBalance.quantityReserved,
          );

          await createMovement(db, context, {
            batchId: incomingBatch.id,
            itemId: itemRow.itemId,
            movementType: StockMovementType.TRANSFER_IN,
            quantity,
            reference: {
              id: transfer.id,
              notes: input.notes,
              type: 'stock_transfer'
            },
            unitCost: sourceBatch.unitCost,
            warehouseId: input.toWarehouseId
          });
        }

        await db.stockTransferItem.create({
          data: {
            itemId: itemRow.itemId,
            quantityReceived: decimal(itemRow.quantity),
            quantityRequested: decimal(itemRow.quantity),
            quantitySent: decimal(itemRow.quantity),
            transferId: transfer.id
          }
        });
      }

      return db.stockTransfer.findUniqueOrThrow({
        where: {
          id: transfer.id
        },
        include: {
          fromWarehouse: true,
          items: {
            include: {
              item: true
            }
          },
          toWarehouse: true
        }
      });
    });
  }

  static async listTransfers(context: InventoryContext, filters: TransferFilters) {
    const transfers = await prisma.stockTransfer.findMany({
      where: {
        deletedAt: null,
        fromWarehouseId: filters.fromWarehouseId,
        organizationId: context.organizationId,
        status: filters.status,
        toWarehouseId: filters.toWarehouseId,
        fromWarehouse: getWarehouseScope(context),
        toWarehouse: getWarehouseScope(context)
      },
      include: {
        fromWarehouse: true,
        items: true,
        toWarehouse: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const mapped = transfers.map((transfer) => ({
      id: transfer.id,
      transferNumber: transfer.transferNumber,
      fromWarehouse: {
        id: transfer.fromWarehouse.id,
        name: transfer.fromWarehouse.name
      },
      toWarehouse: {
        id: transfer.toWarehouse.id,
        name: transfer.toWarehouse.name
      },
      transferDate: transfer.transferDate,
      status: transfer.status,
      itemsCount: transfer.items.length,
      notes: transfer.notes
    }));

    return createPaginationResult(mapped, filters.page, filters.pageSize);
  }

  static async adjustStock(context: InventoryContext, input: AdjustStockInput, tx?: Prisma.TransactionClient) {
    return withTransaction(async (db) => {
      const item = await getItemOrThrow(db, context, input.itemId);
      await getWarehouseOrThrow(db, context, input.warehouseId);

      const balance = await getBalanceOrCreate(db, context, input.itemId, input.warehouseId);
      const quantity = decimal(input.quantity);
      const unitCost = item.unitCost ?? decimal(0);
      const previousValues = {
        quantityAvailable: balance.quantityAvailable.toString(),
        quantityOnHand: balance.quantityOnHand.toString(),
        quantityReserved: balance.quantityReserved.toString()
      };

      if (input.type === 'ADJUSTMENT_OUT') {
        ensureEnoughStock(item.name, balance.quantityAvailable, quantity);
      }

      const updatedBalance = await updateBalance(
        db,
        balance.id,
        input.type === 'ADJUSTMENT_IN'
          ? balance.quantityOnHand.plus(quantity)
          : balance.quantityOnHand.minus(quantity),
        balance.quantityReserved,
      );

      await createMovement(db, context, {
        itemId: input.itemId,
        movementType:
          input.type === 'ADJUSTMENT_IN'
            ? StockMovementType.ADJUSTMENT_IN
            : StockMovementType.ADJUSTMENT_OUT,
        notes: input.reason,
        quantity,
        reference: {
          id: updatedBalance.id,
          notes: input.reason,
          type: 'stock_adjustment'
        },
        unitCost,
        warehouseId: input.warehouseId
      });

      await createAuditEntry(db, context, {
        action: input.type,
        entityId: updatedBalance.id,
        entityType: 'stock_balance',
        newValues: {
          quantityAvailable: updatedBalance.quantityAvailable.toString(),
          quantityOnHand: updatedBalance.quantityOnHand.toString(),
          quantityReserved: updatedBalance.quantityReserved.toString(),
          reason: input.reason
        },
        oldValues: previousValues
      });

      return mapBalance(updatedBalance);
    }, tx);
  }

  static async writeOffExpired(context: InventoryContext, batchId: string, reason: string, tx?: Prisma.TransactionClient) {
    return withTransaction(async (db) => {
      const batch = await db.inventoryBatch.findFirst({
        where: {
          id: batchId,
          organizationId: context.organizationId,
          warehouse: getWarehouseScope(context)
        },
        include: {
          item: true
        }
      });

      if (!batch) {
        throw new Error('Inventory batch not found.');
      }

      if (!batch.expiryDate || batch.expiryDate.getTime() > now().setHours(0, 0, 0, 0)) {
        throw new Error('Only expired batches can be written off.');
      }

      const balance = await getBalanceOrCreate(db, context, batch.itemId, batch.warehouseId);
      const quantityToWriteOff = batch.quantityRemaining;

      ensureEnoughStock(batch.item.name, balance.quantityOnHand, quantityToWriteOff);

      await db.inventoryBatch.update({
        where: {
          id: batch.id
        },
        data: {
          quantityRemaining: decimal(0),
          status: InventoryBatchStatus.EXPIRED
        }
      });

      const reservedReduction = balance.quantityReserved.lessThan(quantityToWriteOff)
        ? balance.quantityReserved
        : quantityToWriteOff;

      const updatedBalance = await updateBalance(
        db,
        balance.id,
        balance.quantityOnHand.minus(quantityToWriteOff),
        balance.quantityReserved.minus(reservedReduction),
      );

      await createMovement(db, context, {
        batchId: batch.id,
        itemId: batch.itemId,
        movementType: StockMovementType.EXPIRY_WRITE_OFF,
        notes: reason,
        quantity: quantityToWriteOff,
        reference: {
          id: batch.id,
          notes: reason,
          type: 'expiry_write_off'
        },
        unitCost: batch.unitCost,
        warehouseId: batch.warehouseId
      });

      await createAuditEntry(db, context, {
        action: 'EXPIRY_WRITE_OFF',
        entityId: batch.id,
        entityType: 'inventory_batch',
        newValues: {
          quantityRemaining: '0',
          reason,
          status: InventoryBatchStatus.EXPIRED
        },
        oldValues: {
          quantityRemaining: batch.quantityRemaining.toString(),
          status: batch.status
        }
      });

      return mapBalance(updatedBalance);
    }, tx);
  }

  static async getLowStockItems(context: InventoryContext) {
    const balances = await prisma.stockBalance.findMany({
      where: {
        organizationId: context.organizationId,
        warehouse: getWarehouseScope(context)
      },
      include: {
        item: {
          include: {
            category: true,
            unitOfMeasure: true
          }
        },
        warehouse: true
      }
    });

    return balances
      .filter(
        (balance) =>
          balance.item.reorderLevel !== null &&
          balance.item.reorderLevel.greaterThanOrEqualTo(balance.quantityAvailable),
      )
      .map((balance) => ({
        id: balance.id,
        item: {
          code: balance.item.code,
          id: balance.item.id,
          name: balance.item.name,
          reorderLevel: decimalToNumber(balance.item.reorderLevel)
        },
        quantityAvailable: decimalToNumber(balance.quantityAvailable),
        quantityOnHand: decimalToNumber(balance.quantityOnHand),
        quantityReserved: decimalToNumber(balance.quantityReserved),
        warehouse: {
          code: balance.warehouse.code,
          id: balance.warehouse.id,
          name: balance.warehouse.name
        }
      }));
  }

  static async getExpiringBatches(context: InventoryContext, daysAhead: number) {
    const today = now();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysAhead);

    const batches = await prisma.inventoryBatch.findMany({
      where: {
        expiryDate: {
          gte: today,
          lte: endDate
        },
        organizationId: context.organizationId,
        quantityRemaining: {
          gt: decimal(0)
        },
        warehouse: getWarehouseScope(context)
      },
      include: {
        item: true,
        warehouse: true
      },
      orderBy: [
        {
          expiryDate: 'asc'
        },
        {
          createdAt: 'asc'
        }
      ]
    });

    return batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      item: {
        code: batch.item.code,
        id: batch.item.id,
        name: batch.item.name
      },
      quantityRemaining: decimalToNumber(batch.quantityRemaining),
      status: batch.status,
      warehouse: {
        code: batch.warehouse.code,
        id: batch.warehouse.id,
        name: batch.warehouse.name
      }
    }));
  }
}
