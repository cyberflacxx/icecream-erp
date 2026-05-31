import {
  PrismaClient,
  type Prisma
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { SupplierBalanceUpdateType } from './suppliers.constants';
import type {
  CreateSupplierInput,
  ListSuppliersQuery,
  SupplierPurchaseHistoryQuery,
  UpdateSupplierInput
} from './suppliers.schemas';

type DbClient = PrismaClient | Prisma.TransactionClient;

interface SupplierContext {
  organizationId: string;
  userProfileId: string;
}

const decimal = (value: Prisma.Decimal | number | string) =>
  value instanceof Decimal ? value : new Decimal(value);

const decimalToNumber = (value: Prisma.Decimal | null | undefined) =>
  value ? Number(value.toString()) : 0;

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

async function createAuditLog(
  db: DbClient,
  context: SupplierContext,
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

async function getSupplierOrThrow(db: DbClient, context: SupplierContext, supplierId: string) {
  const supplier = await db.supplier.findFirst({
    where: {
      deletedAt: null,
      id: supplierId,
      organizationId: context.organizationId
    },
    include: {
      category: true
    }
  });

  if (!supplier) {
    throw new Error('Supplier not found.');
  }

  return supplier;
}

export class SuppliersService {
  static async listSupplierCategories(context: SupplierContext) {
    return prisma.supplierCategory.findMany({
      where: {
        organizationId: context.organizationId
      },
      orderBy: {
        name: 'asc'
      }
    });
  }

  static async createSupplier(context: SupplierContext, data: CreateSupplierInput) {
    const category = await prisma.supplierCategory.findFirst({
      where: {
        id: data.categoryId,
        organizationId: context.organizationId
      }
    });

    if (!category) {
      throw new Error('Supplier category not found.');
    }

    const supplierCount = await prisma.supplier.count({
      where: {
        organizationId: context.organizationId
      }
    });
    const code = data.code?.trim() || `SUP-${String(supplierCount + 1).padStart(5, '0')}`;

    const supplier = await prisma.supplier.create({
      data: {
        address: data.address ?? null,
        categoryId: data.categoryId,
        code,
        contactPerson: data.contactPerson ?? null,
        createdBy: context.userProfileId,
        creditLimit: data.creditLimit ?? null,
        email: data.email ?? null,
        name: data.name,
        organizationId: context.organizationId,
        paymentTerms: data.paymentTerms ?? null,
        phone: data.phone ?? null,
        status: data.status,
        taxNumber: data.taxNumber ?? null
      },
      include: {
        category: true
      }
    });

    await createAuditLog(prisma, context, {
      action: 'SUPPLIER_CREATED',
      entityId: supplier.id,
      entityType: 'supplier',
      newValues: {
        code: supplier.code,
        name: supplier.name,
        status: supplier.status
      }
    });

    return supplier;
  }

  static async updateSupplier(context: SupplierContext, supplierId: string, data: UpdateSupplierInput) {
    const existing = await getSupplierOrThrow(prisma, context, supplierId);

    if (data.categoryId) {
      const category = await prisma.supplierCategory.findFirst({
        where: {
          id: data.categoryId,
          organizationId: context.organizationId
        }
      });

      if (!category) {
        throw new Error('Supplier category not found.');
      }
    }

    const updated = await prisma.supplier.update({
      where: {
        id: supplierId
      },
      data: {
        address: data.address,
        categoryId: data.categoryId,
        code: data.code,
        contactPerson: data.contactPerson,
        creditLimit: data.creditLimit,
        email: data.email,
        name: data.name,
        paymentTerms: data.paymentTerms,
        phone: data.phone,
        status: data.status,
        taxNumber: data.taxNumber
      },
      include: {
        category: true
      }
    });

    await createAuditLog(prisma, context, {
      action: 'SUPPLIER_UPDATED',
      entityId: updated.id,
      entityType: 'supplier',
      newValues: {
        code: updated.code,
        name: updated.name,
        status: updated.status
      },
      oldValues: {
        code: existing.code,
        name: existing.name,
        status: existing.status
      }
    });

    return updated;
  }

  static async deleteSupplier(context: SupplierContext, supplierId: string) {
    await getSupplierOrThrow(prisma, context, supplierId);

    const deleted = await prisma.supplier.update({
      where: {
        id: supplierId
      },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE'
      }
    });

    await createAuditLog(prisma, context, {
      action: 'SUPPLIER_DELETED',
      entityId: deleted.id,
      entityType: 'supplier'
    });

    return deleted;
  }

  static async listSuppliers(context: SupplierContext, filters: ListSuppliersQuery) {
    const suppliers = await prisma.supplier.findMany({
      where: {
        categoryId: filters.categoryId,
        deletedAt: null,
        organizationId: context.organizationId,
        status: filters.status,
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
              },
              {
                contactPerson: {
                  contains: filters.search,
                  mode: 'insensitive'
                }
              }
            ]
          : undefined
      },
      include: {
        category: true
      },
      orderBy: [
        {
          name: 'asc'
        }
      ]
    });

    const mapped = suppliers.map((supplier) => ({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      category: {
        id: supplier.category.id,
        name: supplier.category.name
      },
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      taxNumber: supplier.taxNumber,
      paymentTerms: supplier.paymentTerms,
      creditLimit: decimalToNumber(supplier.creditLimit),
      currentBalance: decimalToNumber(supplier.currentBalance),
      status: supplier.status
    }));

    return createPaginationResult(mapped, filters.page, filters.pageSize);
  }

  static async getSupplier(context: SupplierContext, supplierId: string) {
    const supplier = await getSupplierOrThrow(prisma, context, supplierId);

    return {
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      category: {
        id: supplier.category.id,
        name: supplier.category.name
      },
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      taxNumber: supplier.taxNumber,
      paymentTerms: supplier.paymentTerms,
      creditLimit: decimalToNumber(supplier.creditLimit),
      currentBalance: decimalToNumber(supplier.currentBalance),
      status: supplier.status,
      createdAt: supplier.createdAt
    };
  }

  static async getSupplierPurchaseHistory(
    context: SupplierContext,
    supplierId: string,
    query: SupplierPurchaseHistoryQuery,
  ) {
    await getSupplierOrThrow(prisma, context, supplierId);

    if (query.tab === 'purchase_orders') {
      const rows = await prisma.purchaseOrder.findMany({
        where: {
          deletedAt: null,
          organizationId: context.organizationId,
          supplierId
        },
        include: {
          items: true
        },
        orderBy: {
          orderDate: 'desc'
        }
      });

      return createPaginationResult(
        rows.map((row) => ({
          id: row.id,
          poNumber: row.poNumber,
          orderDate: row.orderDate,
          expectedDeliveryDate: row.expectedDeliveryDate,
          total: decimalToNumber(row.total),
          itemsCount: row.items.length,
          status: row.status
        })),
        query.page,
        query.pageSize,
      );
    }

    if (query.tab === 'grns') {
      const rows = await prisma.goodsReceivedNote.findMany({
        where: {
          deletedAt: null,
          organizationId: context.organizationId,
          purchaseOrder: {
            supplierId
          }
        },
        include: {
          items: true,
          purchaseOrder: true
        },
        orderBy: {
          receivedDate: 'desc'
        }
      });

      return createPaginationResult(
        rows.map((row) => ({
          id: row.id,
          grnNumber: row.grnNumber,
          poNumber: row.purchaseOrder.poNumber,
          receivedDate: row.receivedDate,
          itemsCount: row.items.length,
          qualityStatus: row.qualityStatus,
          status: row.status
        })),
        query.page,
        query.pageSize,
      );
    }

    if (query.tab === 'returns') {
      const rows = await prisma.supplierReturn.findMany({
        where: {
          deletedAt: null,
          organizationId: context.organizationId,
          supplierId
        },
        orderBy: {
          returnDate: 'desc'
        }
      });

      return createPaginationResult(
        rows.map((row) => ({
          id: row.id,
          returnNumber: row.returnNumber,
          returnDate: row.returnDate,
          totalValue: decimalToNumber(row.totalValue),
          status: row.status
        })),
        query.page,
        query.pageSize,
      );
    }

    const rows = await prisma.payment.findMany({
      where: {
        organizationId: context.organizationId,
        supplierId
      },
      orderBy: {
        paymentDate: 'desc'
      }
    });

    return createPaginationResult(
      rows.map((row) => ({
        id: row.id,
        paymentNumber: row.paymentNumber,
        paymentDate: row.paymentDate,
        amount: decimalToNumber(row.amount),
        method: row.paymentMethod,
        referenceNumber: row.referenceNumber
      })),
      query.page,
      query.pageSize,
    );
  }

  static async updateSupplierBalance(
    context: SupplierContext,
    supplierId: string,
    amount: number,
    type: keyof typeof SupplierBalanceUpdateType,
  ) {
    return prisma.$transaction(async (db) => {
      const supplier = await getSupplierOrThrow(db, context, supplierId);
      const amountDecimal = decimal(amount);
      const currentBalance = supplier.currentBalance ?? decimal(0);
      const nextBalance =
        type === SupplierBalanceUpdateType.CREDIT
          ? currentBalance.plus(amountDecimal)
          : currentBalance.minus(amountDecimal);

      const updated = await db.supplier.update({
        where: {
          id: supplierId
        },
        data: {
          currentBalance: nextBalance
        }
      });

      await createAuditLog(db, context, {
        action: 'SUPPLIER_BALANCE_UPDATED',
        entityId: supplierId,
        entityType: 'supplier',
        newValues: {
          amount,
          currentBalance: nextBalance.toString(),
          type
        },
        oldValues: {
          currentBalance: currentBalance.toString()
        }
      });

      return {
        currentBalance: decimalToNumber(updated.currentBalance),
        supplierId: updated.id
      };
    });
  }
}
