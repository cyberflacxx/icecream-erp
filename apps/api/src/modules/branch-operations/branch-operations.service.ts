import {
  PrismaClient,
  type Prisma
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { InventoryService } from '../inventory/inventory.service';
import {
  BranchShiftStatus,
  PaymentMethod,
  ShiftType,
  type PaymentMethod as PaymentMethodCode,
  type ShiftType as ShiftTypeCode
} from './branch-operations.constants';
import type {
  BranchDashboardQuery,
  BranchExpensesQuery,
  BranchListQuery,
  BranchSalesQuery,
  BranchStockQuery,
  CreateBranchExpenseInput,
  CreateBranchInput,
  CreateBranchSaleInput,
  RejectShiftCloseInput,
  ShiftCloseListQuery,
  SubmitShiftCloseInput,
  UpdateBranchInput
} from './branch-operations.schemas';

type DbClient = PrismaClient | Prisma.TransactionClient;

interface BranchContext {
  branchId: string | null;
  isBranchScoped: boolean;
  organizationId: string;
  roles?: Array<{
    name: string;
  }>;
  userProfileId: string;
}

function decimal(value: Prisma.Decimal | number | string) {
  return value instanceof Decimal ? value : new Decimal(value);
}

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return value ? Number(value.toString()) : 0;
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

function toDate(date?: string | null) {
  if (!date) {
    return undefined;
  }

  return new Date(`${date}T00:00:00.000Z`);
}

function getDateRange(date?: string) {
  const target = date ? toDate(date) ?? new Date() : new Date();
  const start = new Date(target);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setUTCHours(23, 59, 59, 999);

  return {
    end,
    start
  };
}

function getQueryDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) {
    return undefined;
  }

  return {
    gte: startDate ? toDate(startDate) : undefined,
    lte: endDate ? toDate(endDate) : undefined
  };
}

function getWarehouseScope(context: BranchContext) {
  return context.isBranchScoped && context.branchId ? { branchId: context.branchId } : {};
}

function ensureBranchAccess(context: BranchContext, branchId: string) {
  if (context.isBranchScoped && context.branchId && context.branchId !== branchId) {
    throw new Error('This role is limited to its assigned branch.');
  }
}

function isAdminOrAccountant(context: BranchContext) {
  const names = context.roles?.map((role) => role.name.toLowerCase()) ?? [];

  return names.some((name) => name.includes('admin') || name.includes('accountant'));
}

async function createAuditLog(
  db: DbClient,
  context: BranchContext,
  input: {
    action: string;
    entityId: string;
    entityType: string;
    newValues?: Prisma.InputJsonValue;
    oldValues?: Prisma.InputJsonValue;
  },
) {
  await db.auditLog.create({
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

function emitRealtimeEvent(_channel: 'branch_sales' | 'branch_shift_close', _payload: Record<string, unknown>) {
  // Placeholder hook for realtime adapters. Table writes are enough for Supabase DB realtime subscriptions.
}

async function getBranchOrThrow(db: DbClient, context: BranchContext, branchId: string) {
  const branch = await db.branch.findFirst({
    where: {
      deletedAt: null,
      id: branchId,
      organizationId: context.organizationId
    },
    include: {
      manager: true
    }
  });

  if (!branch) {
    throw new Error('Branch not found.');
  }

  return branch;
}

async function getBranchWarehouseOrThrow(db: DbClient, context: BranchContext, branchId: string) {
  const warehouse = await db.warehouse.findFirst({
    where: {
      branchId,
      isActive: true,
      organizationId: context.organizationId,
      type: 'BRANCH'
    }
  });

  if (!warehouse) {
    throw new Error('No active branch warehouse found.');
  }

  return warehouse;
}

async function getShiftCloseOrThrow(
  db: DbClient,
  context: BranchContext,
  branchId: string,
  shiftCloseId: string,
) {
  const shiftClose = await db.branchShiftClose.findFirst({
    where: {
      branchId,
      deletedAt: null,
      id: shiftCloseId,
      organizationId: context.organizationId
    }
  });

  if (!shiftClose) {
    throw new Error('Shift close not found.');
  }

  return shiftClose;
}

async function calculateShiftMetrics(
  db: DbClient,
  context: BranchContext,
  input: {
    actualCash: number;
    actualClosingStock: number;
    branchId: string;
    damagedStockValue: number;
    shift: ShiftTypeCode;
    shiftDate: Date;
  },
) {
  const { end, start } = getDateRange(input.shiftDate.toISOString().slice(0, 10));

  const sales = await db.branchSale.findMany({
    where: {
      branchId: input.branchId,
      deletedAt: null,
      organizationId: context.organizationId,
      saleDate: {
        gte: start,
        lte: end
      },
      shift: input.shift
    },
    include: {
      items: true
    }
  });
  const expenses = await db.branchExpense.findMany({
    where: {
      branchId: input.branchId,
      deletedAt: null,
      expenseDate: {
        gte: start,
        lte: end
      },
      organizationId: context.organizationId
    }
  });

  const warehouse = await getBranchWarehouseOrThrow(db, context, input.branchId);
  const transferMovements = await db.stockMovement.findMany({
    where: {
      createdAt: {
        gte: start,
        lte: end
      },
      movementType: 'TRANSFER_IN',
      organizationId: context.organizationId,
      warehouseId: warehouse.id
    }
  });
  const salesIssueMovements = await db.stockMovement.findMany({
    where: {
      createdAt: {
        gte: start,
        lte: end
      },
      movementType: 'SALES_ISSUE',
      organizationId: context.organizationId,
      warehouseId: warehouse.id
    }
  });

  const expectedCash = sales
    .filter((sale) => sale.paymentMethod === PaymentMethod.CASH)
    .reduce((sum, sale) => sum + decimalToNumber(sale.totalAmount), 0);
  const ecocashTotal = sales
    .filter((sale) => sale.paymentMethod === PaymentMethod.ECOCASH)
    .reduce((sum, sale) => sum + decimalToNumber(sale.totalAmount), 0);
  const cardTotal = sales
    .filter((sale) => sale.paymentMethod === PaymentMethod.CARD)
    .reduce((sum, sale) => sum + decimalToNumber(sale.totalAmount), 0);
  const expensesTotal = expenses.reduce((sum, expense) => sum + decimalToNumber(expense.amount), 0);
  const stockReceivedValue = transferMovements.reduce(
    (sum, movement) => sum + decimalToNumber(movement.totalCost),
    0,
  );
  const stockSoldValue = salesIssueMovements.reduce(
    (sum, movement) => sum + decimalToNumber(movement.totalCost),
    0,
  );

  return {
    cardTotal,
    cashVariance: input.actualCash - expectedCash,
    ecocashTotal,
    expectedCash,
    expensesTotal,
    sales,
    stockReceivedValue,
    stockSoldValue,
    stockVariance:
      0 +
      stockReceivedValue -
      stockSoldValue -
      input.damagedStockValue -
      input.actualClosingStock
  };
}

export class BranchOperationsService {
  static async listBranches(context: BranchContext, query: BranchListQuery) {
    const branches = await prisma.branch.findMany({
      where: {
        deletedAt: null,
        organizationId: context.organizationId,
        status: query.status,
        id: context.isBranchScoped && context.branchId ? context.branchId : undefined,
        OR: query.search
          ? [
              {
                code: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              },
              {
                name: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              }
            ]
          : undefined
      },
      include: {
        manager: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    const { start, end } = getDateRange();
    const salesToday = await prisma.branchSale.groupBy({
      by: ['branchId'],
      where: {
        deletedAt: null,
        organizationId: context.organizationId,
        saleDate: {
          gte: start,
          lte: end
        }
      },
      _sum: {
        totalAmount: true
      }
    });
    const salesMap = new Map(
      salesToday.map((row) => [row.branchId, decimalToNumber(row._sum.totalAmount)]),
    );
    const stockBalances = await prisma.stockBalance.findMany({
      where: {
        organizationId: context.organizationId,
        warehouse: {
          branchId: {
            in: branches.map((branch) => branch.id)
          }
        }
      },
      include: {
        item: true,
        warehouse: true
      }
    });
    const stockStatusMap = new Map<string, 'HEALTHY' | 'LOW'>();

    for (const balance of stockBalances) {
      const branchId = balance.warehouse.branchId;

      if (!branchId) {
        continue;
      }

      const reorderLevel = balance.item.reorderLevel;
      const current = stockStatusMap.get(branchId) ?? 'HEALTHY';
      const next =
        reorderLevel !== null && reorderLevel.greaterThanOrEqualTo(balance.quantityAvailable)
          ? 'LOW'
          : current;

      stockStatusMap.set(branchId, next);
    }

    const mapped = branches.map((branch) => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      phone: branch.phone,
      status: branch.status,
      manager: branch.manager
        ? {
            id: branch.manager.id,
            name: `${branch.manager.firstName} ${branch.manager.lastName}`.trim()
          }
        : null,
      todaySales: salesMap.get(branch.id) ?? 0,
      stockStatus: stockStatusMap.get(branch.id) ?? 'HEALTHY'
    }));

    return createPaginationResult(mapped, query.page, query.pageSize);
  }

  static async createBranch(context: BranchContext, input: CreateBranchInput) {
    if (input.managerId) {
      const manager = await prisma.userProfile.findFirst({
        where: {
          deletedAt: null,
          id: input.managerId,
          organizationId: context.organizationId
        }
      });

      if (!manager) {
        throw new Error('Branch manager not found.');
      }
    }

    return prisma.branch.create({
      data: {
        address: input.address ?? null,
        code: input.code,
        managerId: input.managerId ?? null,
        name: input.name,
        organizationId: context.organizationId,
        phone: input.phone ?? null,
        status: input.status
      }
    });
  }

  static async updateBranch(context: BranchContext, branchId: string, input: UpdateBranchInput) {
    ensureBranchAccess(context, branchId);
    await getBranchOrThrow(prisma, context, branchId);

    return prisma.branch.update({
      where: {
        id: branchId
      },
      data: {
        address: input.address,
        managerId: input.managerId,
        name: input.name,
        phone: input.phone,
        status: input.status
      }
    });
  }

  static async createBranchSale(context: BranchContext, branchId: string, input: CreateBranchSaleInput) {
    ensureBranchAccess(context, branchId);

    return prisma.$transaction(async (db) => {
      await getBranchOrThrow(db, context, branchId);
      const warehouse = await getBranchWarehouseOrThrow(db, context, branchId);
      const itemIds = [...new Set(input.items.map((item) => item.itemId))];
      const items = await db.item.findMany({
        where: {
          deletedAt: null,
          id: {
            in: itemIds
          },
          isActive: true,
          itemType: 'FINISHED_GOOD',
          organizationId: context.organizationId
        }
      });

      if (items.length !== itemIds.length) {
        throw new Error('One or more sale items are invalid for branch selling.');
      }

      const count = await db.branchSale.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const saleNumber = `BS-${String(count + 1).padStart(5, '0')}`;
      const totalAmount = input.items.reduce((sum, item) => sum + item.totalPrice, 0);
      const sale = await db.branchSale.create({
        data: {
          branchId,
          customerId: input.customerId ?? null,
          organizationId: context.organizationId,
          paymentMethod: input.paymentMethod,
          paymentReference: input.paymentReference ?? null,
          saleDate: toDate(input.saleDate ?? undefined) ?? new Date(),
          saleNumber,
          servedBy: context.userProfileId,
          shift: input.shift,
          totalAmount: decimal(totalAmount)
        }
      });

      await db.branchSaleItem.createMany({
        data: input.items.map((item) => ({
          branchSaleId: sale.id,
          itemId: item.itemId,
          quantity: decimal(item.quantity),
          totalPrice: decimal(item.totalPrice),
          unitPrice: decimal(item.unitPrice)
        }))
      });

      for (const item of input.items) {
        await InventoryService.issueStock(
          {
            branchId: context.branchId,
            isBranchScoped: context.isBranchScoped,
            organizationId: context.organizationId,
            userProfileId: context.userProfileId
          },
          {
            itemId: item.itemId,
            movementType: 'SALES_ISSUE',
            quantity: item.quantity,
            reference: {
              id: sale.id,
              type: 'branch_sale'
            },
            warehouseId: warehouse.id
          },
          db,
        );
      }

      await createAuditLog(db, context, {
        action: 'BRANCH_SALE_CREATED',
        entityId: sale.id,
        entityType: 'branch_sale',
        newValues: {
          branchId,
          paymentMethod: input.paymentMethod,
          totalAmount
        }
      });

      emitRealtimeEvent('branch_sales', {
        branchId,
        saleId: sale.id,
        totalAmount
      });

      return db.branchSale.findUniqueOrThrow({
        where: {
          id: sale.id
        },
        include: {
          items: true
        }
      });
    });
  }

  static async createBranchExpense(context: BranchContext, branchId: string, input: CreateBranchExpenseInput) {
    ensureBranchAccess(context, branchId);
    await getBranchOrThrow(prisma, context, branchId);

    return prisma.branchExpense.create({
      data: {
        amount: decimal(input.amount),
        branchId,
        category: input.category,
        createdBy: context.userProfileId,
        description: input.description,
        expenseDate: toDate(input.expenseDate ?? undefined) ?? new Date(),
        organizationId: context.organizationId,
        paymentMethod: input.paymentMethod,
        receiptUrl: input.receiptUrl ?? null
      }
    });
  }

  static async initShiftClose(
    context: BranchContext,
    branchId: string,
    date: string,
    shift: ShiftTypeCode,
  ) {
    ensureBranchAccess(context, branchId);

    return prisma.$transaction(async (db) => {
      await getBranchOrThrow(db, context, branchId);
      const shiftDate = toDate(date);

      if (!shiftDate) {
        throw new Error('Shift date is required.');
      }

      const existing = await db.branchShiftClose.findFirst({
        where: {
          branchId,
          deletedAt: null,
          organizationId: context.organizationId,
          shiftDate,
          status: {
            in: [BranchShiftStatus.OPEN, BranchShiftStatus.SUBMITTED, BranchShiftStatus.APPROVED]
          }
        }
      });

      if (existing) {
        throw new Error('A shift close already exists for this branch and date.');
      }

      const warehouse = await getBranchWarehouseOrThrow(db, context, branchId);
      const balances = await db.stockBalance.findMany({
        where: {
          organizationId: context.organizationId,
          warehouseId: warehouse.id
        },
        include: {
          item: true
        }
      });
      const openingStockValue = balances.reduce((sum, balance) => {
        const unitCost = balance.item.unitCost ?? decimal(0);

        return sum + decimalToNumber(balance.quantityOnHand.mul(unitCost));
      }, 0);

      const created = await db.branchShiftClose.create({
        data: {
          actualCash: decimal(0),
          branchId,
          cardTotal: decimal(0),
          cashVariance: decimal(0),
          closedBy: context.userProfileId,
          closingStockValue: decimal(0),
          damagedStockValue: decimal(0),
          ecocashTotal: decimal(0),
          expectedCash: decimal(0),
          expensesTotal: decimal(0),
          openingStockValue: decimal(openingStockValue),
          organizationId: context.organizationId,
          shiftDate,
          shiftType: shift,
          status: BranchShiftStatus.OPEN,
          stockReceivedValue: decimal(0),
          stockSoldValue: decimal(0),
          stockVariance: decimal(0)
        }
      });

      await createAuditLog(db, context, {
        action: 'BRANCH_SHIFT_OPENED',
        entityId: created.id,
        entityType: 'branch_shift_close'
      });

      return created;
    });
  }

  static async calculateShiftClose(context: BranchContext, branchId: string, shiftCloseId: string) {
    ensureBranchAccess(context, branchId);

    return prisma.$transaction(async (db) => {
      const shiftClose = await getShiftCloseOrThrow(db, context, branchId, shiftCloseId);
      const openingStockValue = decimalToNumber(shiftClose.openingStockValue);
      const actualCash = decimalToNumber(shiftClose.actualCash);
      const actualClosingStock = decimalToNumber(shiftClose.closingStockValue);
      const damagedStockValue = decimalToNumber(shiftClose.damagedStockValue);
      const metrics = await calculateShiftMetrics(db, context, {
        actualCash,
        actualClosingStock,
        branchId,
        damagedStockValue,
        shift: shiftClose.shiftType as ShiftTypeCode,
        shiftDate: shiftClose.shiftDate
      });

      const expectedClosingStock =
        openingStockValue + metrics.stockReceivedValue - metrics.stockSoldValue - damagedStockValue;
      const updated = await db.branchShiftClose.update({
        where: {
          id: shiftCloseId
        },
        data: {
          cardTotal: decimal(metrics.cardTotal),
          cashVariance: decimal(actualCash - metrics.expectedCash),
          ecocashTotal: decimal(metrics.ecocashTotal),
          expectedCash: decimal(metrics.expectedCash),
          expensesTotal: decimal(metrics.expensesTotal),
          stockReceivedValue: decimal(metrics.stockReceivedValue),
          stockSoldValue: decimal(metrics.stockSoldValue),
          stockVariance: decimal(expectedClosingStock - actualClosingStock)
        }
      });

      return updated;
    });
  }

  static async submitShiftClose(
    context: BranchContext,
    branchId: string,
    shiftCloseId: string,
    input: SubmitShiftCloseInput,
  ) {
    ensureBranchAccess(context, branchId);

    if (input.actualCash === undefined || input.actualCash === null) {
      throw new Error('Actual cash is required.');
    }

    if (input.actualClosingStock === undefined || input.actualClosingStock === null) {
      throw new Error('Actual closing stock is required.');
    }

    return prisma.$transaction(async (db) => {
      const shiftClose = await getShiftCloseOrThrow(db, context, branchId, shiftCloseId);

      if (shiftClose.status !== BranchShiftStatus.OPEN) {
        throw new Error('Only OPEN shift closes can be submitted.');
      }

      const metrics = await calculateShiftMetrics(db, context, {
        actualCash: input.actualCash,
        actualClosingStock: input.actualClosingStock,
        branchId,
        damagedStockValue: input.damagedStockValue ?? decimalToNumber(shiftClose.damagedStockValue),
        shift: shiftClose.shiftType as ShiftTypeCode,
        shiftDate: shiftClose.shiftDate
      });

      const hasIncompleteSales = metrics.sales.some((sale) => {
        const itemsTotal = sale.items.reduce((sum, row) => sum + decimalToNumber(row.totalPrice), 0);

        return sale.items.length === 0 || Math.abs(itemsTotal - decimalToNumber(sale.totalAmount)) > 0.01;
      });

      if (hasIncompleteSales) {
        throw new Error('Sales records are incomplete for this shift.');
      }

      const openingStockValue = decimalToNumber(shiftClose.openingStockValue);
      const damagedStockValue = input.damagedStockValue ?? decimalToNumber(shiftClose.damagedStockValue);
      const expectedClosingStock =
        openingStockValue + metrics.stockReceivedValue - metrics.stockSoldValue - damagedStockValue;
      const updated = await db.branchShiftClose.update({
        where: {
          id: shiftCloseId
        },
        data: {
          actualCash: decimal(input.actualCash),
          cardTotal: decimal(metrics.cardTotal),
          cashVariance: decimal(input.actualCash - metrics.expectedCash),
          closingStockValue: decimal(input.actualClosingStock),
          damagedStockValue: decimal(damagedStockValue),
          ecocashTotal: decimal(metrics.ecocashTotal),
          expectedCash: decimal(metrics.expectedCash),
          expensesTotal: decimal(metrics.expensesTotal),
          notes: input.notes ?? null,
          status: BranchShiftStatus.SUBMITTED,
          stockReceivedValue: decimal(metrics.stockReceivedValue),
          stockSoldValue: decimal(metrics.stockSoldValue),
          stockVariance: decimal(expectedClosingStock - input.actualClosingStock)
        }
      });

      await createAuditLog(db, context, {
        action: 'BRANCH_SHIFT_SUBMITTED',
        entityId: shiftCloseId,
        entityType: 'branch_shift_close'
      });
      await (db as unknown as { notification?: { create?: (input: unknown) => Promise<unknown> } }).notification?.create?.({
        data: {
          message: 'Shift close has been submitted for review.',
          organizationId: context.organizationId,
          referenceId: branchId,
          referenceType: 'SHIFT_CLOSE_SUBMITTED',
          title: 'Shift close submitted',
          type: 'ACTION_REQUIRED',
          userProfileId: context.userProfileId
        }
      });

      emitRealtimeEvent('branch_shift_close', {
        branchId,
        shiftCloseId,
        status: BranchShiftStatus.SUBMITTED
      });

      return updated;
    });
  }

  static async approveShiftClose(context: BranchContext, branchId: string, shiftCloseId: string) {
    ensureBranchAccess(context, branchId);

    if (!isAdminOrAccountant(context)) {
      throw new Error('Only admin or accountant users can approve shift close.');
    }

    return prisma.$transaction(async (db) => {
      const shiftClose = await getShiftCloseOrThrow(db, context, branchId, shiftCloseId);

      if (shiftClose.status !== BranchShiftStatus.SUBMITTED) {
        throw new Error('Only submitted shift close can be approved.');
      }

      const updated = await db.branchShiftClose.update({
        where: {
          id: shiftCloseId
        },
        data: {
          approvedAt: new Date(),
          approvedBy: context.userProfileId,
          status: BranchShiftStatus.APPROVED
        }
      });

      await createAuditLog(db, context, {
        action: 'BRANCH_SHIFT_APPROVED',
        entityId: shiftCloseId,
        entityType: 'branch_shift_close'
      });

      return updated;
    });
  }

  static async rejectShiftClose(
    context: BranchContext,
    branchId: string,
    shiftCloseId: string,
    input: RejectShiftCloseInput,
  ) {
    ensureBranchAccess(context, branchId);

    if (!isAdminOrAccountant(context)) {
      throw new Error('Only admin or accountant users can reject shift close.');
    }

    return prisma.$transaction(async (db) => {
      const shiftClose = await getShiftCloseOrThrow(db, context, branchId, shiftCloseId);

      if (shiftClose.status !== BranchShiftStatus.SUBMITTED) {
        throw new Error('Only submitted shift close can be rejected.');
      }

      const updated = await db.branchShiftClose.update({
        where: {
          id: shiftCloseId
        },
        data: {
          approvedAt: new Date(),
          approvedBy: context.userProfileId,
          notes: input.reason ? [shiftClose.notes, `Rejected: ${input.reason}`].filter(Boolean).join('\n') : shiftClose.notes,
          status: BranchShiftStatus.REJECTED
        }
      });

      await createAuditLog(db, context, {
        action: 'BRANCH_SHIFT_REJECTED',
        entityId: shiftCloseId,
        entityType: 'branch_shift_close',
        newValues: input.reason ? { reason: input.reason } : undefined
      });

      return updated;
    });
  }

  static async getBranchDashboard(context: BranchContext, branchId: string, query: BranchDashboardQuery) {
    ensureBranchAccess(context, branchId);
    await getBranchOrThrow(prisma, context, branchId);
    const { end, start } = getDateRange(query.date);

    const sales = await prisma.branchSale.findMany({
      where: {
        branchId,
        deletedAt: null,
        organizationId: context.organizationId,
        saleDate: {
          gte: start,
          lte: end
        }
      }
    });
    const expenses = await prisma.branchExpense.findMany({
      where: {
        branchId,
        deletedAt: null,
        expenseDate: {
          gte: start,
          lte: end
        },
        organizationId: context.organizationId
      }
    });
    const shiftClose = await prisma.branchShiftClose.findFirst({
      where: {
        branchId,
        deletedAt: null,
        organizationId: context.organizationId,
        shiftDate: {
          gte: start,
          lte: end
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const cash = sales
      .filter((sale) => sale.paymentMethod === PaymentMethod.CASH)
      .reduce((sum, sale) => sum + decimalToNumber(sale.totalAmount), 0);
    const ecocash = sales
      .filter((sale) => sale.paymentMethod === PaymentMethod.ECOCASH)
      .reduce((sum, sale) => sum + decimalToNumber(sale.totalAmount), 0);
    const card = sales
      .filter((sale) => sale.paymentMethod === PaymentMethod.CARD)
      .reduce((sum, sale) => sum + decimalToNumber(sale.totalAmount), 0);
    const expensesTotal = expenses.reduce((sum, expense) => sum + decimalToNumber(expense.amount), 0);

    return {
      date: start.toISOString().slice(0, 10),
      stats: {
        closingStockEstimated: decimalToNumber(shiftClose?.closingStockValue),
        openingStockValue: decimalToNumber(shiftClose?.openingStockValue),
        stockReceivedToday: decimalToNumber(shiftClose?.stockReceivedValue),
        stockSoldToday: decimalToNumber(shiftClose?.stockSoldValue)
      },
      payments: {
        card,
        cash,
        ecocash,
        expenses: expensesTotal
      },
      shiftClose: shiftClose
        ? {
            id: shiftClose.id,
            shiftType: shiftClose.shiftType,
            status: shiftClose.status
          }
        : null
    };
  }

  static async listBranchStock(context: BranchContext, branchId: string, query: BranchStockQuery) {
    ensureBranchAccess(context, branchId);
    const warehouse = await getBranchWarehouseOrThrow(prisma, context, branchId);
    const rows = await prisma.stockBalance.findMany({
      where: {
        organizationId: context.organizationId,
        warehouseId: warehouse.id,
        item: {
          deletedAt: null,
          OR: query.search
            ? [
                {
                  code: {
                    contains: query.search,
                    mode: 'insensitive'
                  }
                },
                {
                  name: {
                    contains: query.search,
                    mode: 'insensitive'
                  }
                }
              ]
            : undefined
        }
      },
      include: {
        item: true
      },
      orderBy: {
        item: {
          name: 'asc'
        }
      }
    });

    return createPaginationResult(
      rows.map((row) => ({
        id: row.id,
        item: {
          id: row.item.id,
          code: row.item.code,
          name: row.item.name,
          itemType: row.item.itemType
        },
        quantityOnHand: decimalToNumber(row.quantityOnHand),
        quantityAvailable: decimalToNumber(row.quantityAvailable),
        unitCost: decimalToNumber(row.item.unitCost),
        totalValue: decimalToNumber((row.item.unitCost ?? decimal(0)).mul(row.quantityOnHand))
      })),
      query.page,
      query.pageSize,
    );
  }

  static async listBranchSales(context: BranchContext, branchId: string, query: BranchSalesQuery) {
    ensureBranchAccess(context, branchId);

    const rows = await prisma.branchSale.findMany({
      where: {
        branchId,
        deletedAt: null,
        organizationId: context.organizationId,
        paymentMethod: query.paymentMethod as PaymentMethodCode | undefined,
        saleDate: getQueryDateRange(query.startDate, query.endDate),
        shift: query.shift as ShiftTypeCode | undefined
      },
      include: {
        items: true,
        servedByUser: true
      },
      orderBy: {
        saleDate: 'desc'
      }
    });

    return createPaginationResult(
      rows.map((row) => ({
        id: row.id,
        saleNumber: row.saleNumber,
        saleDate: row.saleDate,
        shift: row.shift,
        itemsCount: row.items.length,
        totalAmount: decimalToNumber(row.totalAmount),
        paymentMethod: row.paymentMethod,
        servedBy: row.servedByUser
          ? `${row.servedByUser.firstName} ${row.servedByUser.lastName}`.trim()
          : 'Unknown'
      })),
      query.page,
      query.pageSize,
    );
  }

  static async getBranchSale(context: BranchContext, branchId: string, saleId: string) {
    ensureBranchAccess(context, branchId);

    const sale = await prisma.branchSale.findFirst({
      where: {
        branchId,
        deletedAt: null,
        id: saleId,
        organizationId: context.organizationId
      },
      include: {
        items: {
          include: {
            item: true
          }
        },
        servedByUser: true
      }
    });

    if (!sale) {
      throw new Error('Branch sale not found.');
    }

    return {
      id: sale.id,
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate,
      shift: sale.shift,
      paymentMethod: sale.paymentMethod,
      paymentReference: sale.paymentReference,
      totalAmount: decimalToNumber(sale.totalAmount),
      servedBy: sale.servedByUser
        ? `${sale.servedByUser.firstName} ${sale.servedByUser.lastName}`.trim()
        : 'Unknown',
      items: sale.items.map((item) => ({
        id: item.id,
        item: {
          id: item.item.id,
          code: item.item.code,
          name: item.item.name
        },
        quantity: decimalToNumber(item.quantity),
        unitPrice: decimalToNumber(item.unitPrice),
        totalPrice: decimalToNumber(item.totalPrice)
      }))
    };
  }

  static async listBranchExpenses(context: BranchContext, branchId: string, query: BranchExpensesQuery) {
    ensureBranchAccess(context, branchId);

    const rows = await prisma.branchExpense.findMany({
      where: {
        branchId,
        deletedAt: null,
        expenseDate: getQueryDateRange(query.startDate, query.endDate),
        organizationId: context.organizationId,
        paymentMethod: query.paymentMethod as PaymentMethodCode | undefined
      },
      include: {
        createdByUser: true
      },
      orderBy: {
        expenseDate: 'desc'
      }
    });

    return createPaginationResult(
      rows.map((row) => ({
        id: row.id,
        amount: decimalToNumber(row.amount),
        category: row.category,
        createdBy: `${row.createdByUser.firstName} ${row.createdByUser.lastName}`.trim(),
        description: row.description,
        expenseDate: row.expenseDate,
        paymentMethod: row.paymentMethod
      })),
      query.page,
      query.pageSize,
    );
  }

  static async listShiftCloses(context: BranchContext, branchId: string, query: ShiftCloseListQuery) {
    ensureBranchAccess(context, branchId);
    const rows = await prisma.branchShiftClose.findMany({
      where: {
        branchId,
        deletedAt: null,
        organizationId: context.organizationId,
        shiftDate: getQueryDateRange(query.startDate, query.endDate),
        status: query.status
      },
      orderBy: {
        shiftDate: 'desc'
      }
    });

    return createPaginationResult(
      rows.map((row) => ({
        id: row.id,
        shiftDate: row.shiftDate,
        shiftType: row.shiftType,
        status: row.status,
        expectedCash: decimalToNumber(row.expectedCash),
        actualCash: decimalToNumber(row.actualCash),
        cashVariance: decimalToNumber(row.cashVariance),
        stockVariance: decimalToNumber(row.stockVariance)
      })),
      query.page,
      query.pageSize,
    );
  }

  static async getShiftClose(context: BranchContext, branchId: string, shiftCloseId: string) {
    ensureBranchAccess(context, branchId);
    const row = await getShiftCloseOrThrow(prisma, context, branchId, shiftCloseId);

    return {
      id: row.id,
      shiftDate: row.shiftDate,
      shiftType: row.shiftType,
      status: row.status,
      openingStockValue: decimalToNumber(row.openingStockValue),
      stockReceivedValue: decimalToNumber(row.stockReceivedValue),
      stockSoldValue: decimalToNumber(row.stockSoldValue),
      damagedStockValue: decimalToNumber(row.damagedStockValue),
      closingStockValue: decimalToNumber(row.closingStockValue),
      expectedCash: decimalToNumber(row.expectedCash),
      actualCash: decimalToNumber(row.actualCash),
      ecocashTotal: decimalToNumber(row.ecocashTotal),
      cardTotal: decimalToNumber(row.cardTotal),
      expensesTotal: decimalToNumber(row.expensesTotal),
      cashVariance: decimalToNumber(row.cashVariance),
      stockVariance: decimalToNumber(row.stockVariance),
      notes: row.notes
    };
  }
}
