import {
  PrismaClient,
  type Prisma
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { InventoryService } from '../inventory/inventory.service';
import {
  GRNStatus,
  PurchaseOrderStatus,
  PurchaseRequisitionStatus,
  QualityStatus,
  ReturnStatus,
  type PurchaseOrderStatus as PurchaseOrderStatusCode,
  type PurchaseRequisitionStatus as PurchaseRequisitionStatusCode,
  type GRNStatus as GRNStatusCode
} from './procurement.constants';
import type {
  CreateGRNInput,
  CreatePurchaseOrderInput,
  CreateRequisitionInput,
  CreateSupplierReturnInput,
  ReceiveGRNInput,
  UpdatePurchaseOrderInput,
  UpdateRequisitionInput
} from './procurement.schemas';

type DbClient = PrismaClient | Prisma.TransactionClient;

interface ProcurementContext {
  branchId: string | null;
  isBranchScoped: boolean;
  organizationId: string;
  userProfileId: string;
}

interface PaginationInput {
  page: number;
  pageSize: number;
}

interface ListRequisitionsFilters extends PaginationInput {
  department?: string;
  endDate?: string;
  startDate?: string;
  status?: PurchaseRequisitionStatusCode;
}

interface ListPurchaseOrdersFilters extends PaginationInput {
  endDate?: string;
  startDate?: string;
  status?: PurchaseOrderStatusCode;
  supplierId?: string;
}

interface ListGRNsFilters extends PaginationInput {
  endDate?: string;
  purchaseOrderId?: string;
  startDate?: string;
  status?: GRNStatusCode;
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

function toDate(date?: string | null) {
  if (!date) {
    return undefined;
  }

  return new Date(`${date}T00:00:00.000Z`);
}

function getWarehouseScope(context: ProcurementContext) {
  return context.isBranchScoped && context.branchId ? { branchId: context.branchId } : {};
}

async function createAuditLog(
  db: DbClient,
  context: ProcurementContext,
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

async function getRequisitionOrThrow(db: DbClient, context: ProcurementContext, requisitionId: string) {
  const requisition = await db.purchaseRequisition.findFirst({
    where: {
      deletedAt: null,
      id: requisitionId,
      organizationId: context.organizationId
    },
    include: {
      items: true
    }
  });

  if (!requisition) {
    throw new Error('Purchase requisition not found.');
  }

  return requisition;
}

async function getPurchaseOrderOrThrow(db: DbClient, context: ProcurementContext, purchaseOrderId: string) {
  const order = await db.purchaseOrder.findFirst({
    where: {
      deletedAt: null,
      id: purchaseOrderId,
      organizationId: context.organizationId
    },
    include: {
      items: true
    }
  });

  if (!order) {
    throw new Error('Purchase order not found.');
  }

  return order;
}

async function getGRNOrThrow(db: DbClient, context: ProcurementContext, grnId: string) {
  const grn = await db.goodsReceivedNote.findFirst({
    where: {
      deletedAt: null,
      id: grnId,
      organizationId: context.organizationId
    },
    include: {
      items: true,
      purchaseOrder: {
        include: {
          items: true,
          supplier: true
        }
      },
      warehouse: true
    }
  });

  if (!grn) {
    throw new Error('Goods received note not found.');
  }

  if (context.isBranchScoped && context.branchId && grn.warehouse.branchId !== context.branchId) {
    throw new Error('Warehouse is out of branch scope.');
  }

  return grn;
}

async function calculatePurchaseOrderTotals(
  items: Array<{
    quantityOrdered: number;
    unitCost: number;
  }>,
  taxAmount: number,
  discountAmount: number,
) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantityOrdered * item.unitCost,
    0,
  );

  return {
    subtotal,
    total: subtotal + taxAmount - discountAmount
  };
}

export class ProcurementService {
  static async getProcurementMeta(context: ProcurementContext) {
    const [suppliers, items, units, warehouses, purchaseOrders] = await Promise.all([
      prisma.supplier.findMany({
        where: {
          deletedAt: null,
          organizationId: context.organizationId
        },
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.item.findMany({
        where: {
          deletedAt: null,
          isActive: true,
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
      prisma.warehouse.findMany({
        where: {
          isActive: true,
          organizationId: context.organizationId,
          ...getWarehouseScope(context)
        },
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.purchaseOrder.findMany({
        where: {
          deletedAt: null,
          organizationId: context.organizationId,
          status: {
            in: [PurchaseOrderStatus.SENT_TO_SUPPLIER, PurchaseOrderStatus.PARTIAL_RECEIVED]
          }
        },
        include: {
          supplier: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    const departments = await prisma.purchaseRequisition.findMany({
      where: {
        deletedAt: null,
        organizationId: context.organizationId
      },
      distinct: ['department'],
      select: {
        department: true
      },
      orderBy: {
        department: 'asc'
      }
    });

    return {
      departments: departments.map((item) => item.department),
      items,
      purchaseOrders: purchaseOrders.map((order) => ({
        id: order.id,
        poNumber: order.poNumber,
        status: order.status,
        supplier: {
          id: order.supplier.id,
          name: order.supplier.name
        }
      })),
      suppliers,
      units,
      warehouses
    };
  }

  static async listRequisitions(context: ProcurementContext, filters: ListRequisitionsFilters) {
    const requisitions = await prisma.purchaseRequisition.findMany({
      where: {
        deletedAt: null,
        department: filters.department,
        organizationId: context.organizationId,
        status: filters.status,
        requestDate:
          filters.startDate || filters.endDate
            ? {
                gte: filters.startDate ? toDate(filters.startDate) : undefined,
                lte: filters.endDate ? toDate(filters.endDate) : undefined
              }
            : undefined
      },
      include: {
        requestedByUser: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const mapped = requisitions.map((requisition) => ({
      id: requisition.id,
      requisitionNumber: requisition.requisitionNumber,
      department: requisition.department,
      requestDate: requisition.requestDate,
      neededByDate: requisition.neededByDate,
      status: requisition.status,
      requestedBy: requisition.requestedByUser
        ? `${requisition.requestedByUser.firstName} ${requisition.requestedByUser.lastName}`.trim()
        : 'Unknown'
    }));

    return createPaginationResult(mapped, filters.page, filters.pageSize);
  }

  static async createRequisition(context: ProcurementContext, input: CreateRequisitionInput) {
    return prisma.$transaction(async (db) => {
      const itemIds = [...new Set(input.items.map((item) => item.itemId))];
      const unitIds = [...new Set(input.items.map((item) => item.unitOfMeasureId))];
      const [items, units] = await Promise.all([
        db.item.findMany({
          where: {
            deletedAt: null,
            id: {
              in: itemIds
            },
            organizationId: context.organizationId
          }
        }),
        db.unitOfMeasure.findMany({
          where: {
            id: {
              in: unitIds
            },
            organizationId: context.organizationId
          }
        })
      ]);

      if (items.length !== itemIds.length || units.length !== unitIds.length) {
        throw new Error('One or more requisition items are invalid.');
      }

      const count = await db.purchaseRequisition.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const requisitionNumber = `REQ-${String(count + 1).padStart(5, '0')}`;

      const requisition = await db.purchaseRequisition.create({
        data: {
          approvalStatus: PurchaseRequisitionStatus.DRAFT,
          department: input.department,
          neededByDate: toDate(input.neededByDate ?? undefined) ?? null,
          organizationId: context.organizationId,
          remarks: input.remarks ?? null,
          requestDate: new Date(),
          requestedBy: context.userProfileId,
          requisitionNumber,
          status: PurchaseRequisitionStatus.DRAFT
        }
      });

      await db.purchaseRequisitionItem.createMany({
        data: input.items.map((item) => ({
          estimatedUnitCost: item.estimatedUnitCost ?? null,
          itemId: item.itemId,
          quantityApproved: null,
          quantityRequested: decimal(item.quantityRequested),
          remarks: item.remarks ?? null,
          requisitionId: requisition.id,
          unitOfMeasureId: item.unitOfMeasureId
        }))
      });

      await createAuditLog(db, context, {
        action: 'REQUISITION_CREATED',
        entityId: requisition.id,
        entityType: 'purchase_requisition'
      });

      return db.purchaseRequisition.findUniqueOrThrow({
        where: {
          id: requisition.id
        },
        include: {
          items: true
        }
      });
    });
  }

  static async updateRequisition(
    context: ProcurementContext,
    requisitionId: string,
    input: UpdateRequisitionInput,
  ) {
    return prisma.$transaction(async (db) => {
      const requisition = await getRequisitionOrThrow(db, context, requisitionId);

      if (requisition.status !== PurchaseRequisitionStatus.DRAFT) {
        throw new Error('Only draft requisitions can be edited.');
      }

      if (input.items) {
        const itemIds = [...new Set(input.items.map((item) => item.itemId))];
        const unitIds = [...new Set(input.items.map((item) => item.unitOfMeasureId))];
        const [items, units] = await Promise.all([
          db.item.findMany({
            where: {
              deletedAt: null,
              id: {
                in: itemIds
              },
              organizationId: context.organizationId
            }
          }),
          db.unitOfMeasure.findMany({
            where: {
              id: {
                in: unitIds
              },
              organizationId: context.organizationId
            }
          })
        ]);

        if (items.length !== itemIds.length || units.length !== unitIds.length) {
          throw new Error('One or more requisition items are invalid.');
        }
      }

      await db.purchaseRequisition.update({
        where: {
          id: requisitionId
        },
        data: {
          department: input.department,
          neededByDate:
            input.neededByDate === undefined
              ? undefined
              : toDate(input.neededByDate) ?? null,
          remarks: input.remarks
        }
      });

      if (input.items) {
        await db.purchaseRequisitionItem.deleteMany({
          where: {
            requisitionId
          }
        });

        await db.purchaseRequisitionItem.createMany({
          data: input.items.map((item) => ({
            estimatedUnitCost: item.estimatedUnitCost ?? null,
            itemId: item.itemId,
            quantityApproved: null,
            quantityRequested: decimal(item.quantityRequested),
            remarks: item.remarks ?? null,
            requisitionId,
            unitOfMeasureId: item.unitOfMeasureId
          }))
        });
      }

      await createAuditLog(db, context, {
        action: 'REQUISITION_UPDATED',
        entityId: requisitionId,
        entityType: 'purchase_requisition'
      });

      return db.purchaseRequisition.findUniqueOrThrow({
        where: {
          id: requisitionId
        },
        include: {
          items: true
        }
      });
    });
  }

  static async submitRequisition(context: ProcurementContext, requisitionId: string) {
    return prisma.$transaction(async (db) => {
      const requisition = await getRequisitionOrThrow(db, context, requisitionId);

      if (requisition.status !== PurchaseRequisitionStatus.DRAFT) {
        throw new Error('Only draft requisitions can be submitted.');
      }

      const updated = await db.purchaseRequisition.update({
        where: {
          id: requisitionId
        },
        data: {
          approvalStatus: PurchaseRequisitionStatus.SUBMITTED,
          status: PurchaseRequisitionStatus.SUBMITTED
        }
      });

      await createAuditLog(db, context, {
        action: 'REQUISITION_SUBMITTED',
        entityId: requisitionId,
        entityType: 'purchase_requisition'
      });

      return updated;
    });
  }

  static async approveRequisition(
    context: ProcurementContext,
    requisitionId: string,
    remarks?: string | null,
  ) {
    return prisma.$transaction(async (db) => {
      const requisition = await getRequisitionOrThrow(db, context, requisitionId);

      if (requisition.status !== PurchaseRequisitionStatus.SUBMITTED) {
        throw new Error('Only submitted requisitions can be approved.');
      }

      const requisitionItems = await db.purchaseRequisitionItem.findMany({
        where: {
          requisitionId
        }
      });
      for (const item of requisitionItems) {
        if (item.quantityApproved !== null) {
          continue;
        }

        await db.purchaseRequisitionItem.update({
          where: {
            id: item.id
          },
          data: {
            quantityApproved: item.quantityRequested
          }
        });
      }

      const updated = await db.purchaseRequisition.update({
        where: {
          id: requisitionId
        },
        data: {
          approvalStatus: PurchaseRequisitionStatus.LEVEL1_APPROVED,
          approvedAt: new Date(),
          approvedBy: context.userProfileId,
          remarks: remarks ?? requisition.remarks,
          status: PurchaseRequisitionStatus.LEVEL1_APPROVED
        }
      });

      await createAuditLog(db, context, {
        action: 'REQUISITION_APPROVED',
        entityId: requisitionId,
        entityType: 'purchase_requisition',
        newValues: {
          remarks: remarks ?? null
        }
      });

      return updated;
    });
  }

  static async rejectRequisition(
    context: ProcurementContext,
    requisitionId: string,
    remarks?: string | null,
  ) {
    return prisma.$transaction(async (db) => {
      const requisition = await getRequisitionOrThrow(db, context, requisitionId);

      if (requisition.status !== PurchaseRequisitionStatus.SUBMITTED) {
        throw new Error('Only submitted requisitions can be rejected.');
      }

      const updated = await db.purchaseRequisition.update({
        where: {
          id: requisitionId
        },
        data: {
          approvalStatus: PurchaseRequisitionStatus.REJECTED,
          approvedAt: new Date(),
          approvedBy: context.userProfileId,
          remarks: remarks ?? requisition.remarks,
          status: PurchaseRequisitionStatus.REJECTED
        }
      });

      await createAuditLog(db, context, {
        action: 'REQUISITION_REJECTED',
        entityId: requisitionId,
        entityType: 'purchase_requisition',
        newValues: {
          remarks: remarks ?? null
        }
      });

      return updated;
    });
  }

  static async listPurchaseOrders(context: ProcurementContext, filters: ListPurchaseOrdersFilters) {
    const rows = await prisma.purchaseOrder.findMany({
      where: {
        deletedAt: null,
        organizationId: context.organizationId,
        status: filters.status,
        supplierId: filters.supplierId,
        orderDate:
          filters.startDate || filters.endDate
            ? {
                gte: filters.startDate ? toDate(filters.startDate) : undefined,
                lte: filters.endDate ? toDate(filters.endDate) : undefined
              }
            : undefined
      },
      include: {
        items: true,
        supplier: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const mapped = rows.map((row) => ({
      id: row.id,
      poNumber: row.poNumber,
      orderDate: row.orderDate,
      expectedDeliveryDate: row.expectedDeliveryDate,
      status: row.status,
      supplier: {
        id: row.supplier.id,
        name: row.supplier.name
      },
      itemsCount: row.items.length,
      total: decimalToNumber(row.total)
    }));

    return createPaginationResult(mapped, filters.page, filters.pageSize);
  }

  static async getPurchaseOrder(context: ProcurementContext, purchaseOrderId: string) {
    const row = await prisma.purchaseOrder.findFirst({
      where: {
        deletedAt: null,
        id: purchaseOrderId,
        organizationId: context.organizationId
      },
      include: {
        goodsReceivedNotes: {
          include: {
            items: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        items: {
          include: {
            item: true,
            unitOfMeasure: true
          }
        },
        supplier: true
      }
    });

    if (!row) {
      throw new Error('Purchase order not found.');
    }

    return {
      id: row.id,
      poNumber: row.poNumber,
      supplier: {
        id: row.supplier.id,
        name: row.supplier.name
      },
      orderDate: row.orderDate,
      expectedDeliveryDate: row.expectedDeliveryDate,
      status: row.status,
      subtotal: decimalToNumber(row.subtotal),
      taxAmount: decimalToNumber(row.taxAmount),
      discountAmount: decimalToNumber(row.discountAmount),
      total: decimalToNumber(row.total),
      items: row.items.map((item) => ({
        id: item.id,
        item: {
          id: item.item.id,
          code: item.item.code,
          name: item.item.name
        },
        quantityOrdered: decimalToNumber(item.quantityOrdered),
        quantityReceived: decimalToNumber(item.quantityReceived),
        unitCost: decimalToNumber(item.unitCost),
        totalCost: decimalToNumber(item.totalCost),
        unitOfMeasure: {
          id: item.unitOfMeasure.id,
          abbreviation: item.unitOfMeasure.abbreviation,
          name: item.unitOfMeasure.name
        }
      })),
      grns: row.goodsReceivedNotes.map((grn) => ({
        id: grn.id,
        grnNumber: grn.grnNumber,
        receivedDate: grn.receivedDate,
        status: grn.status,
        qualityStatus: grn.qualityStatus,
        itemsCount: grn.items.length
      }))
    };
  }

  static async createPurchaseOrder(context: ProcurementContext, input: CreatePurchaseOrderInput) {
    return prisma.$transaction(async (db) => {
      const supplier = await db.supplier.findFirst({
        where: {
          deletedAt: null,
          id: input.supplierId,
          organizationId: context.organizationId
        }
      });

      if (!supplier) {
        throw new Error('Supplier not found.');
      }

      if (input.requisitionId) {
        const requisition = await getRequisitionOrThrow(db, context, input.requisitionId);

        if (requisition.status !== PurchaseRequisitionStatus.LEVEL1_APPROVED) {
          throw new Error('Purchase order can only be created from approved requisitions.');
        }
      }

      const itemIds = [...new Set(input.items.map((item) => item.itemId))];
      const unitIds = [...new Set(input.items.map((item) => item.unitOfMeasureId))];
      const [items, units] = await Promise.all([
        db.item.findMany({
          where: {
            deletedAt: null,
            id: {
              in: itemIds
            },
            organizationId: context.organizationId
          }
        }),
        db.unitOfMeasure.findMany({
          where: {
            id: {
              in: unitIds
            },
            organizationId: context.organizationId
          }
        })
      ]);

      if (items.length !== itemIds.length || units.length !== unitIds.length) {
        throw new Error('One or more purchase order items are invalid.');
      }

      const poCount = await db.purchaseOrder.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const poNumber = `PO-${String(poCount + 1).padStart(5, '0')}`;
      const taxAmount = input.taxAmount ?? 0;
      const discountAmount = input.discountAmount ?? 0;
      const totals = await calculatePurchaseOrderTotals(input.items, taxAmount, discountAmount);

      const order = await db.purchaseOrder.create({
        data: {
          approvedAt: null,
          approvedBy: null,
          createdBy: context.userProfileId,
          discountAmount: decimal(discountAmount),
          expectedDeliveryDate: toDate(input.expectedDeliveryDate ?? undefined) ?? null,
          notes: input.notes ?? null,
          orderDate: toDate(input.orderDate ?? undefined) ?? new Date(),
          organizationId: context.organizationId,
          poNumber,
          requisitionId: input.requisitionId ?? null,
          status: PurchaseOrderStatus.DRAFT,
          subtotal: decimal(totals.subtotal),
          supplierId: input.supplierId,
          taxAmount: decimal(taxAmount),
          total: decimal(totals.total)
        }
      });

      await db.purchaseOrderItem.createMany({
        data: input.items.map((item) => {
          const totalCost = item.quantityOrdered * item.unitCost;

          return {
            itemId: item.itemId,
            purchaseOrderId: order.id,
            quantityOrdered: decimal(item.quantityOrdered),
            quantityReceived: decimal(0),
            totalCost: decimal(totalCost),
            unitCost: decimal(item.unitCost),
            unitOfMeasureId: item.unitOfMeasureId
          };
        })
      });

      await createAuditLog(db, context, {
        action: 'PURCHASE_ORDER_CREATED',
        entityId: order.id,
        entityType: 'purchase_order',
        newValues: {
          poNumber: order.poNumber,
          total: totals.total
        }
      });

      if (input.requisitionId) {
        await db.purchaseRequisition.update({
          where: {
            id: input.requisitionId
          },
          data: {
            status: PurchaseRequisitionStatus.PO_CREATED
          }
        });
      }

      return getPurchaseOrderOrThrow(db, context, order.id);
    });
  }

  static async updatePurchaseOrder(
    context: ProcurementContext,
    purchaseOrderId: string,
    input: UpdatePurchaseOrderInput,
  ) {
    return prisma.$transaction(async (db) => {
      const order = await getPurchaseOrderOrThrow(db, context, purchaseOrderId);

      if (order.status !== PurchaseOrderStatus.DRAFT) {
        throw new Error('Only draft purchase orders can be edited.');
      }

      if (input.items) {
        const itemIds = [...new Set(input.items.map((item) => item.itemId))];
        const unitIds = [...new Set(input.items.map((item) => item.unitOfMeasureId))];
        const [items, units] = await Promise.all([
          db.item.findMany({
            where: {
              deletedAt: null,
              id: {
                in: itemIds
              },
              organizationId: context.organizationId
            }
          }),
          db.unitOfMeasure.findMany({
            where: {
              id: {
                in: unitIds
              },
              organizationId: context.organizationId
            }
          })
        ]);

        if (items.length !== itemIds.length || units.length !== unitIds.length) {
          throw new Error('One or more purchase order items are invalid.');
        }
      }

      const nextItems = input.items
        ? input.items
        : order.items.map((item) => ({
            itemId: item.itemId,
            quantityOrdered: decimalToNumber(item.quantityOrdered),
            unitCost: decimalToNumber(item.unitCost),
            unitOfMeasureId: item.unitOfMeasureId
          }));
      const taxAmount =
        input.taxAmount === undefined ? decimalToNumber(order.taxAmount) : input.taxAmount;
      const discountAmount =
        input.discountAmount === undefined
          ? decimalToNumber(order.discountAmount)
          : input.discountAmount;
      const totals = await calculatePurchaseOrderTotals(nextItems, taxAmount, discountAmount);

      await db.purchaseOrder.update({
        where: {
          id: purchaseOrderId
        },
        data: {
          discountAmount: input.discountAmount === undefined ? undefined : decimal(input.discountAmount),
          expectedDeliveryDate:
            input.expectedDeliveryDate === undefined
              ? undefined
              : toDate(input.expectedDeliveryDate) ?? null,
          notes: input.notes,
          orderDate: input.orderDate === undefined ? undefined : toDate(input.orderDate),
          subtotal: decimal(totals.subtotal),
          supplierId: input.supplierId,
          taxAmount: input.taxAmount === undefined ? undefined : decimal(input.taxAmount),
          total: decimal(totals.total)
        }
      });

      if (input.items) {
        await db.purchaseOrderItem.deleteMany({
          where: {
            purchaseOrderId
          }
        });

        await db.purchaseOrderItem.createMany({
          data: input.items.map((item) => ({
            itemId: item.itemId,
            purchaseOrderId,
            quantityOrdered: decimal(item.quantityOrdered),
            quantityReceived: decimal(0),
            totalCost: decimal(item.quantityOrdered * item.unitCost),
            unitCost: decimal(item.unitCost),
            unitOfMeasureId: item.unitOfMeasureId
          }))
        });
      }

      await createAuditLog(db, context, {
        action: 'PURCHASE_ORDER_UPDATED',
        entityId: purchaseOrderId,
        entityType: 'purchase_order'
      });

      return getPurchaseOrderOrThrow(db, context, purchaseOrderId);
    });
  }

  static async approvePurchaseOrder(context: ProcurementContext, purchaseOrderId: string) {
    return prisma.$transaction(async (db) => {
      const order = await getPurchaseOrderOrThrow(db, context, purchaseOrderId);

      if (order.status !== PurchaseOrderStatus.DRAFT) {
        throw new Error('Only draft purchase orders can be approved.');
      }

      const updated = await db.purchaseOrder.update({
        where: {
          id: purchaseOrderId
        },
        data: {
          approvedAt: new Date(),
          approvedBy: context.userProfileId
        }
      });

      await createAuditLog(db, context, {
        action: 'PURCHASE_ORDER_APPROVED',
        entityId: purchaseOrderId,
        entityType: 'purchase_order'
      });
      await (db as unknown as { notification?: { create?: (input: unknown) => Promise<unknown> } }).notification?.create?.({
        data: {
          message: `Purchase order ${order.poNumber} has been approved.`,
          organizationId: context.organizationId,
          referenceId: purchaseOrderId,
          referenceType: 'PURCHASE_ORDER_APPROVED',
          title: 'Purchase order approved',
          type: 'SUCCESS',
          userProfileId: context.userProfileId
        }
      });

      return updated;
    });
  }

  static async sendPurchaseOrder(context: ProcurementContext, purchaseOrderId: string) {
    return prisma.$transaction(async (db) => {
      const order = await getPurchaseOrderOrThrow(db, context, purchaseOrderId);

      if (order.status !== PurchaseOrderStatus.DRAFT) {
        throw new Error('Only draft purchase orders can be sent.');
      }

      if (!order.approvedBy) {
        throw new Error('Purchase order must be approved before sending.');
      }

      const updated = await db.purchaseOrder.update({
        where: {
          id: purchaseOrderId
        },
        data: {
          status: PurchaseOrderStatus.SENT_TO_SUPPLIER
        }
      });

      await createAuditLog(db, context, {
        action: 'PURCHASE_ORDER_SENT',
        entityId: purchaseOrderId,
        entityType: 'purchase_order'
      });

      return updated;
    });
  }

  static async listGRNs(context: ProcurementContext, filters: ListGRNsFilters) {
    const rows = await prisma.goodsReceivedNote.findMany({
      where: {
        deletedAt: null,
        organizationId: context.organizationId,
        purchaseOrderId: filters.purchaseOrderId,
        status: filters.status,
        warehouse: getWarehouseScope(context),
        receivedDate:
          filters.startDate || filters.endDate
            ? {
                gte: filters.startDate ? toDate(filters.startDate) : undefined,
                lte: filters.endDate ? toDate(filters.endDate) : undefined
              }
            : undefined
      },
      include: {
        items: true,
        purchaseOrder: {
          include: {
            supplier: true
          }
        }
      },
      orderBy: {
        receivedDate: 'desc'
      }
    });

    const mapped = rows.map((row) => ({
      id: row.id,
      grnNumber: row.grnNumber,
      purchaseOrder: {
        id: row.purchaseOrder.id,
        poNumber: row.purchaseOrder.poNumber
      },
      supplier: {
        id: row.purchaseOrder.supplier.id,
        name: row.purchaseOrder.supplier.name
      },
      receivedDate: row.receivedDate,
      qualityStatus: row.qualityStatus,
      status: row.status,
      itemsCount: row.items.length
    }));

    return createPaginationResult(mapped, filters.page, filters.pageSize);
  }

  static async createGRN(context: ProcurementContext, input: CreateGRNInput) {
    return prisma.$transaction(async (db) => {
      const order = await getPurchaseOrderOrThrow(db, context, input.purchaseOrderId);

      if (order.status !== PurchaseOrderStatus.SENT_TO_SUPPLIER && order.status !== PurchaseOrderStatus.PARTIAL_RECEIVED) {
        throw new Error('GRN can only be created for sent or partially received purchase orders.');
      }

      const warehouse = await db.warehouse.findFirst({
        where: {
          id: input.warehouseId,
          isActive: true,
          organizationId: context.organizationId,
          ...getWarehouseScope(context)
        }
      });

      if (!warehouse) {
        throw new Error('Warehouse not found or out of scope.');
      }

      const count = await db.goodsReceivedNote.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const grnNumber = `GRN-${String(count + 1).padStart(5, '0')}`;

      const grn = await db.goodsReceivedNote.create({
        data: {
          grnNumber,
          notes: input.notes ?? null,
          organizationId: context.organizationId,
          purchaseOrderId: input.purchaseOrderId,
          qualityNotes: input.qualityNotes ?? null,
          qualityStatus: QualityStatus.PENDING,
          receivedBy: context.userProfileId,
          receivedDate: toDate(input.receivedDate) ?? new Date(),
          status: GRNStatus.DRAFT,
          warehouseId: input.warehouseId
        }
      });

      const items = input.items.length
        ? input.items
        : order.items.map((item) => ({
            batchNumber: null,
            expiryDate: null,
            itemId: item.itemId,
            poItemId: item.id,
            qualityNotes: null,
            quantityExpected: decimalToNumber(item.quantityOrdered.minus(item.quantityReceived)),
            quantityReceived: 0,
            quantityRejected: 0,
            unitCost: decimalToNumber(item.unitCost)
          }));

      await db.goodsReceivedNoteItem.createMany({
        data: items.map((item) => ({
          batchNumber: item.batchNumber ?? null,
          expiryDate: toDate(item.expiryDate ?? undefined) ?? null,
          grnId: grn.id,
          itemId: item.itemId,
          poItemId: item.poItemId,
          qualityNotes: item.qualityNotes ?? null,
          quantityExpected: decimal(item.quantityExpected),
          quantityReceived: decimal(item.quantityReceived),
          quantityRejected: decimal(item.quantityRejected),
          unitCost: decimal(item.unitCost)
        }))
      });

      await createAuditLog(db, context, {
        action: 'GRN_CREATED',
        entityId: grn.id,
        entityType: 'goods_received_note'
      });

      return db.goodsReceivedNote.findUniqueOrThrow({
        where: {
          id: grn.id
        },
        include: {
          items: true,
          purchaseOrder: true
        }
      });
    });
  }

  static async receiveGRN(context: ProcurementContext, grnId: string, payload: ReceiveGRNInput) {
    return prisma.$transaction(async (db) => {
      const grn = await getGRNOrThrow(db, context, grnId);

      if (grn.status !== GRNStatus.DRAFT) {
        throw new Error('Only draft GRNs can be received.');
      }

      const poItemsById = new Map(grn.purchaseOrder.items.map((item) => [item.id, item]));
      const warnings: string[] = [];

      for (const line of payload.items) {
        const poItem = poItemsById.get(line.poItemId);

        if (!poItem || poItem.itemId !== line.itemId) {
          throw new Error('GRN line references an invalid purchase order item.');
        }

        if (line.quantityRejected > line.quantityReceived) {
          throw new Error('Rejected quantity cannot exceed received quantity.');
        }

        const remaining = poItem.quantityOrdered.minus(poItem.quantityReceived);
        const receivedDecimal = decimal(line.quantityReceived);
        const acceptedQuantity = receivedDecimal.minus(decimal(line.quantityRejected));

        if (acceptedQuantity.lessThan(0)) {
          throw new Error('Accepted quantity cannot be negative.');
        }

        if (receivedDecimal.greaterThan(remaining) && !line.overReceiveReason) {
          throw new Error(
            `Received quantity exceeds ordered quantity for PO item ${poItem.id}. Provide overReceiveReason to continue.`,
          );
        }

        if (receivedDecimal.greaterThan(remaining) && line.overReceiveReason) {
          warnings.push(
            `Over-received ${line.quantityReceived} on PO item ${poItem.id}. Reason: ${line.overReceiveReason}`,
          );
        }

        if (acceptedQuantity.greaterThan(0)) {
          await InventoryService.receiveStock(
            {
              branchId: context.branchId,
              isBranchScoped: context.isBranchScoped,
              organizationId: context.organizationId,
              userProfileId: context.userProfileId
            },
            {
              batchNumber: line.batchNumber?.trim() || `${grn.grnNumber}-${poItem.itemId.slice(0, 8)}`,
              expiryDate: line.expiryDate ?? undefined,
              itemId: line.itemId,
              quantity: decimalToNumber(acceptedQuantity),
              reference: {
                id: grn.id,
                type: 'goods_received_note'
              },
              unitCost: decimalToNumber(poItem.unitCost),
              warehouseId: grn.warehouseId
            },
            db,
          );
        }

        const existingGRNItem = await db.goodsReceivedNoteItem.findFirst({
          where: {
            grnId,
            poItemId: poItem.id
          }
        });

        if (existingGRNItem) {
          await db.goodsReceivedNoteItem.update({
            where: {
              id: existingGRNItem.id
            },
            data: {
              batchNumber: line.batchNumber ?? null,
              expiryDate: toDate(line.expiryDate ?? undefined) ?? null,
              qualityNotes: line.qualityNotes ?? null,
              quantityExpected: poItem.quantityOrdered,
              quantityReceived: receivedDecimal,
              quantityRejected: decimal(line.quantityRejected),
              unitCost: poItem.unitCost
            }
          });
        } else {
          await db.goodsReceivedNoteItem.create({
            data: {
              batchNumber: line.batchNumber ?? null,
              expiryDate: toDate(line.expiryDate ?? undefined) ?? null,
              grnId,
              itemId: line.itemId,
              poItemId: poItem.id,
              qualityNotes: line.qualityNotes ?? null,
              quantityExpected: poItem.quantityOrdered,
              quantityReceived: receivedDecimal,
              quantityRejected: decimal(line.quantityRejected),
              unitCost: poItem.unitCost
            }
          });
        }

        await db.purchaseOrderItem.update({
          where: {
            id: poItem.id
          },
          data: {
            quantityReceived: poItem.quantityReceived.plus(acceptedQuantity)
          }
        });
      }

      const refreshedItems = await db.purchaseOrderItem.findMany({
        where: {
          purchaseOrderId: grn.purchaseOrderId
        }
      });
      const allReceived = refreshedItems.every((item) =>
        item.quantityReceived.greaterThanOrEqualTo(item.quantityOrdered),
      );
      const anyReceived = refreshedItems.some((item) => item.quantityReceived.greaterThan(0));
      const nextOrderStatus = allReceived
        ? PurchaseOrderStatus.FULLY_RECEIVED
        : anyReceived
          ? PurchaseOrderStatus.PARTIAL_RECEIVED
          : PurchaseOrderStatus.SENT_TO_SUPPLIER;

      await db.purchaseOrder.update({
        where: {
          id: grn.purchaseOrderId
        },
        data: {
          status: nextOrderStatus
        }
      });

      const received = await db.goodsReceivedNote.update({
        where: {
          id: grnId
        },
        data: {
          notes: payload.notes ?? grn.notes,
          receivedBy: context.userProfileId,
          receivedDate: new Date(),
          status: GRNStatus.RECEIVED
        },
        include: {
          items: true,
          purchaseOrder: true
        }
      });

      await createAuditLog(db, context, {
        action: 'GRN_RECEIVED',
        entityId: grnId,
        entityType: 'goods_received_note',
        newValues: {
          warnings
        }
      });

      return {
        ...received,
        warnings
      };
    });
  }

  static async approveGRN(context: ProcurementContext, grnId: string) {
    return prisma.$transaction(async (db) => {
      const grn = await getGRNOrThrow(db, context, grnId);

      if (grn.status !== GRNStatus.RECEIVED) {
        throw new Error('Only received GRNs can be approved.');
      }

      const updated = await db.goodsReceivedNote.update({
        where: {
          id: grnId
        },
        data: {
          qualityStatus: QualityStatus.PASSED,
          status: GRNStatus.QUALITY_PASSED
        }
      });

      await createAuditLog(db, context, {
        action: 'GRN_APPROVED',
        entityId: grnId,
        entityType: 'goods_received_note'
      });

      return updated;
    });
  }

  static async createSupplierReturn(context: ProcurementContext, input: CreateSupplierReturnInput) {
    return prisma.$transaction(async (db) => {
      const supplier = await db.supplier.findFirst({
        where: {
          deletedAt: null,
          id: input.supplierId,
          organizationId: context.organizationId
        }
      });

      if (!supplier) {
        throw new Error('Supplier not found.');
      }

      if (input.grnId) {
        await getGRNOrThrow(db, context, input.grnId);
      }

      const count = await db.supplierReturn.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const returnNumber = `SRN-${String(count + 1).padStart(5, '0')}`;

      const supplierReturn = await db.supplierReturn.create({
        data: {
          createdBy: context.userProfileId,
          grnId: input.grnId ?? null,
          organizationId: context.organizationId,
          reason: input.reason,
          returnDate: toDate(input.returnDate ?? undefined) ?? new Date(),
          returnNumber,
          status: ReturnStatus.DRAFT,
          supplierId: input.supplierId,
          totalValue: decimal(input.totalValue)
        }
      });

      await createAuditLog(db, context, {
        action: 'SUPPLIER_RETURN_CREATED',
        entityId: supplierReturn.id,
        entityType: 'supplier_return'
      });

      return supplierReturn;
    });
  }

  static async createPurchaseOrderPdf(context: ProcurementContext, purchaseOrderId: string) {
    const order = await this.getPurchaseOrder(context, purchaseOrderId);
    const content = [
      `Purchase Order: ${order.poNumber}`,
      `Supplier: ${order.supplier.name}`,
      `Order Date: ${order.orderDate.toISOString()}`,
      `Status: ${order.status}`,
      `Total: ${order.total.toFixed(2)}`
    ].join('\n');

    return {
      content,
      fileName: `${order.poNumber}.txt`,
      mimeType: 'text/plain'
    };
  }
}
