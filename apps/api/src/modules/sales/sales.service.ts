import {
  PrismaClient,
  type Prisma
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { createClient } from '@supabase/supabase-js';

import { prisma } from '@absolute-ice-cream/database';

import { env } from '../../config/env';
import {
  buildDeliveryNotePdf,
  buildInvoicePdf,
  buildQuotationPdf,
  buildReceiptPdf
} from './sales.pdf';
import {
  CustomerStatus,
  DeliveryNoteStatus,
  InvoiceStatus,
  QuotationStatus,
  ReturnStatus,
  SalesOrderStatus,
  type PaymentMethod as PaymentMethodCode
} from './sales.constants';
import type {
  CreateCustomerInput,
  CreateCustomerReturnInput,
  CreateDeliveryNoteInput,
  CreateInvoiceInput,
  CreateQuotationInput,
  CreateSalesOrderInput,
  CustomersListQuery,
  InvoicePaymentInput,
  InvoicesListQuery,
  OrdersListQuery,
  QuotationsListQuery,
  UpdateCustomerInput,
  UpdateInvoiceInput,
  UpdateQuotationInput
} from './sales.schemas';

type DbClient = PrismaClient | Prisma.TransactionClient;

interface SalesContext {
  branchId: string | null;
  isBranchScoped: boolean;
  organizationId: string;
  userProfileId: string;
}

const supabase =
  env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

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

function getDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) {
    return undefined;
  }

  return {
    gte: startDate ? toDate(startDate) : undefined,
    lte: endDate ? toDate(endDate) : undefined
  };
}

function ensureBranchAccess(context: SalesContext, branchId?: string | null) {
  if (context.isBranchScoped && context.branchId && branchId && context.branchId !== branchId) {
    throw new Error('This role is limited to its assigned branch.');
  }
}

async function createAuditLog(
  db: DbClient,
  context: SalesContext,
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

async function storeDocument(
  db: DbClient,
  context: SalesContext,
  input: {
    buffer: Buffer;
    fileName: string;
    fileType: string;
    referenceId: string;
    referenceType: string;
  },
) {
  const path = `${context.organizationId}/${input.referenceType}/${input.referenceId}/${input.fileName}`;
  let fileUrl = `memory://${path}`;

  if (supabase) {
    const upload = await supabase.storage
      .from(env.STORAGE_BUCKET)
      .upload(path, input.buffer, {
        contentType: input.fileType,
        upsert: true
      });

    if (upload.error) {
      throw new Error(`Failed to upload document: ${upload.error.message}`);
    }

    const { data } = supabase.storage.from(env.STORAGE_BUCKET).getPublicUrl(path);
    fileUrl = data.publicUrl;
  }

  return db.documentFile.create({
    data: {
      fileName: input.fileName,
      fileSize: input.buffer.byteLength,
      fileType: input.fileType,
      fileUrl,
      organizationId: context.organizationId,
      referenceId: input.referenceId,
      referenceType: input.referenceType,
      uploadedBy: context.userProfileId
    }
  });
}

async function getCustomerOrThrow(db: DbClient, context: SalesContext, customerId: string) {
  const customer = await db.customer.findFirst({
    where: {
      deletedAt: null,
      id: customerId,
      organizationId: context.organizationId
    }
  });

  if (!customer) {
    throw new Error('Customer not found.');
  }

  return customer;
}

async function getQuotationOrThrow(db: DbClient, context: SalesContext, quotationId: string) {
  const quotation = await db.quotation.findFirst({
    where: {
      deletedAt: null,
      id: quotationId,
      organizationId: context.organizationId
    },
    include: {
      customer: true,
      items: {
        include: {
          item: true
        }
      }
    }
  });

  if (!quotation) {
    throw new Error('Quotation not found.');
  }

  return quotation;
}

async function getOrderOrThrow(db: DbClient, context: SalesContext, orderId: string) {
  const order = await db.salesOrder.findFirst({
    where: {
      deletedAt: null,
      id: orderId,
      organizationId: context.organizationId
    },
    include: {
      customer: true,
      items: {
        include: {
          item: true
        }
      },
      warehouse: true
    }
  });

  if (!order) {
    throw new Error('Sales order not found.');
  }

  ensureBranchAccess(context, order.branchId);

  return order;
}

async function getInvoiceOrThrow(db: DbClient, context: SalesContext, invoiceId: string) {
  const invoice = await db.invoice.findFirst({
    where: {
      deletedAt: null,
      id: invoiceId,
      organizationId: context.organizationId
    },
    include: {
      customer: true,
      items: {
        include: {
          item: true
        }
      }
    }
  });

  if (!invoice) {
    throw new Error('Invoice not found.');
  }

  if (context.isBranchScoped && context.branchId && invoice.salesOrderId) {
    const order = await db.salesOrder.findUnique({
      where: {
        id: invoice.salesOrderId
      }
    });
    ensureBranchAccess(context, order?.branchId);
  }

  return invoice;
}

function mapLineTotals(items: Array<{ discountPercent?: number | null; quantity: number; unitPrice: number }>) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lineDiscountTotal = items.reduce((sum, item) => {
    const discountPercent = item.discountPercent ?? 0;

    return sum + item.quantity * item.unitPrice * (discountPercent / 100);
  }, 0);

  return {
    lineDiscountTotal,
    subtotal
  };
}

function normalizeInvoiceStatus(amountPaid: number, total: number) {
  if (amountPaid <= 0) {
    return InvoiceStatus.SENT;
  }

  if (amountPaid >= total) {
    return InvoiceStatus.PAID;
  }

  return InvoiceStatus.PARTIAL_PAID;
}

export class SalesService {
  static async listCustomers(context: SalesContext, query: CustomersListQuery) {
    const customers = await prisma.customer.findMany({
      where: {
        deletedAt: null,
        organizationId: context.organizationId,
        status: query.status,
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
              },
              {
                email: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              }
            ]
          : undefined
      },
      orderBy: {
        name: 'asc'
      }
    });

    const mapped = customers.map((customer) => ({
      id: customer.id,
      code: customer.code,
      name: customer.name,
      customerType: customer.customerType,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      paymentTerms: customer.paymentTerms,
      creditLimit: decimalToNumber(customer.creditLimit),
      currentBalance: decimalToNumber(customer.currentBalance),
      status: customer.status
    }));

    return createPaginationResult(mapped, query.page, query.pageSize);
  }

  static async createCustomer(context: SalesContext, input: CreateCustomerInput) {
    const count = await prisma.customer.count({
      where: {
        organizationId: context.organizationId
      }
    });

    const customer = await prisma.customer.create({
      data: {
        address: input.address ?? null,
        code: input.code?.trim() || `CUS-${String(count + 1).padStart(5, '0')}`,
        createdBy: context.userProfileId,
        creditLimit: input.creditLimit ?? null,
        currentBalance: decimal(0),
        customerType: input.customerType,
        email: input.email ?? null,
        name: input.name,
        organizationId: context.organizationId,
        paymentTerms: input.paymentTerms ?? null,
        phone: input.phone ?? null,
        status: input.status
      }
    });

    await createAuditLog(prisma, context, {
      action: 'CUSTOMER_CREATED',
      entityId: customer.id,
      entityType: 'customer'
    });

    return customer;
  }

  static async getCustomer(context: SalesContext, customerId: string) {
    return getCustomerOrThrow(prisma, context, customerId);
  }

  static async updateCustomer(context: SalesContext, customerId: string, input: UpdateCustomerInput) {
    await getCustomerOrThrow(prisma, context, customerId);

    const updated = await prisma.customer.update({
      where: {
        id: customerId
      },
      data: {
        address: input.address,
        creditLimit: input.creditLimit,
        customerType: input.customerType,
        email: input.email,
        name: input.name,
        paymentTerms: input.paymentTerms,
        phone: input.phone,
        status: input.status
      }
    });

    await createAuditLog(prisma, context, {
      action: 'CUSTOMER_UPDATED',
      entityId: customerId,
      entityType: 'customer'
    });

    return updated;
  }

  static async deleteCustomer(context: SalesContext, customerId: string) {
    await getCustomerOrThrow(prisma, context, customerId);

    const deleted = await prisma.customer.update({
      where: {
        id: customerId
      },
      data: {
        deletedAt: new Date(),
        status: CustomerStatus.INACTIVE
      }
    });

    await createAuditLog(prisma, context, {
      action: 'CUSTOMER_DELETED',
      entityId: customerId,
      entityType: 'customer'
    });

    return deleted;
  }

  static async listQuotations(context: SalesContext, query: QuotationsListQuery) {
    const rows = await prisma.quotation.findMany({
      where: {
        customerId: query.customerId,
        deletedAt: null,
        organizationId: context.organizationId,
        quotationDate: getDateRange(query.startDate, query.endDate),
        status: query.status
      },
      include: {
        customer: true,
        items: true
      },
      orderBy: {
        quotationDate: 'desc'
      }
    });

    return createPaginationResult(
      rows.map((row) => ({
        id: row.id,
        quotationNumber: row.quotationNumber,
        customer: {
          id: row.customer.id,
          name: row.customer.name
        },
        quotationDate: row.quotationDate,
        validUntil: row.validUntil,
        status: row.status,
        itemsCount: row.items.length,
        total: decimalToNumber(row.total)
      })),
      query.page,
      query.pageSize,
    );
  }

  static async createQuotation(context: SalesContext, input: CreateQuotationInput) {
    return prisma.$transaction(async (db) => {
      await getCustomerOrThrow(db, context, input.customerId);
      const itemIds = [...new Set(input.items.map((item) => item.itemId))];
      const items = await db.item.findMany({
        where: {
          deletedAt: null,
          id: {
            in: itemIds
          },
          organizationId: context.organizationId
        }
      });

      if (items.length !== itemIds.length) {
        throw new Error('One or more quotation items are invalid.');
      }

      const { subtotal, lineDiscountTotal } = mapLineTotals(input.items);
      const count = await db.quotation.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const quotation = await db.quotation.create({
        data: {
          createdBy: context.userProfileId,
          customerId: input.customerId,
          discountAmount: decimal(input.discountAmount),
          notes: input.notes ?? null,
          organizationId: context.organizationId,
          quotationDate: toDate(input.quotationDate ?? undefined) ?? new Date(),
          quotationNumber: `QT-${String(count + 1).padStart(5, '0')}`,
          status: QuotationStatus.DRAFT,
          subtotal: decimal(subtotal),
          taxAmount: decimal(input.taxAmount),
          total: decimal(subtotal + input.taxAmount - input.discountAmount - lineDiscountTotal),
          validUntil: toDate(input.validUntil ?? undefined) ?? null
        }
      });

      await db.quotationItem.createMany({
        data: input.items.map((item) => ({
          discountPercent: item.discountPercent ?? null,
          itemId: item.itemId,
          quantity: decimal(item.quantity),
          quotationId: quotation.id,
          totalPrice: decimal(
            item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100),
          ),
          unitPrice: decimal(item.unitPrice)
        }))
      });

      await createAuditLog(db, context, {
        action: 'QUOTATION_CREATED',
        entityId: quotation.id,
        entityType: 'quotation'
      });

      return getQuotationOrThrow(db, context, quotation.id);
    });
  }

  static async getQuotation(context: SalesContext, quotationId: string) {
    return getQuotationOrThrow(prisma, context, quotationId);
  }

  static async updateQuotation(context: SalesContext, quotationId: string, input: UpdateQuotationInput) {
    return prisma.$transaction(async (db) => {
      const quotation = await getQuotationOrThrow(db, context, quotationId);

      if (quotation.status !== QuotationStatus.DRAFT && input.items) {
        throw new Error('Only draft quotations can modify line items.');
      }

      const nextItems = input.items
        ? input.items
        : quotation.items.map((item) => ({
            discountPercent: decimalToNumber(item.discountPercent),
            itemId: item.itemId,
            quantity: decimalToNumber(item.quantity),
            unitPrice: decimalToNumber(item.unitPrice)
          }));
      const discountAmount =
        input.discountAmount === undefined ? decimalToNumber(quotation.discountAmount) : input.discountAmount;
      const taxAmount = input.taxAmount === undefined ? decimalToNumber(quotation.taxAmount) : input.taxAmount;
      const { subtotal, lineDiscountTotal } = mapLineTotals(nextItems);

      await db.quotation.update({
        where: {
          id: quotationId
        },
        data: {
          discountAmount: input.discountAmount === undefined ? undefined : decimal(input.discountAmount),
          notes: input.notes,
          quotationDate: input.quotationDate === undefined ? undefined : toDate(input.quotationDate),
          status: input.status,
          subtotal: decimal(subtotal),
          taxAmount: input.taxAmount === undefined ? undefined : decimal(input.taxAmount),
          total: decimal(subtotal + taxAmount - discountAmount - lineDiscountTotal),
          validUntil: input.validUntil === undefined ? undefined : toDate(input.validUntil) ?? null
        }
      });

      if (input.items) {
        const itemIds = [...new Set(input.items.map((item) => item.itemId))];
        const items = await db.item.findMany({
          where: {
            deletedAt: null,
            id: {
              in: itemIds
            },
            organizationId: context.organizationId
          }
        });

        if (items.length !== itemIds.length) {
          throw new Error('One or more quotation items are invalid.');
        }

        await db.quotationItem.deleteMany({
          where: {
            quotationId
          }
        });

        await db.quotationItem.createMany({
          data: input.items.map((item) => ({
            discountPercent: item.discountPercent ?? null,
            itemId: item.itemId,
            quantity: decimal(item.quantity),
            quotationId,
            totalPrice: decimal(
              item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100),
            ),
            unitPrice: decimal(item.unitPrice)
          }))
        });
      }

      await createAuditLog(db, context, {
        action: 'QUOTATION_UPDATED',
        entityId: quotationId,
        entityType: 'quotation'
      });

      return getQuotationOrThrow(db, context, quotationId);
    });
  }

  static async convertQuotationToOrder(context: SalesContext, quotationId: string) {
    return prisma.$transaction(async (db) => {
      const quotation = await getQuotationOrThrow(db, context, quotationId);

      if (
        quotation.status === QuotationStatus.CANCELLED ||
        quotation.status === QuotationStatus.REJECTED ||
        quotation.status === QuotationStatus.EXPIRED
      ) {
        throw new Error('Quotation cannot be converted in its current status.');
      }

      const warehouse = await db.warehouse.findFirst({
        where: {
          isActive: true,
          organizationId: context.organizationId,
          branchId: context.isBranchScoped ? context.branchId : undefined
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      if (!warehouse) {
        throw new Error('No warehouse available for sales order conversion.');
      }

      ensureBranchAccess(context, warehouse.branchId);

      const orderCount = await db.salesOrder.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const order = await db.salesOrder.create({
        data: {
          branchId: warehouse.branchId,
          createdBy: context.userProfileId,
          customerId: quotation.customerId,
          discountAmount: quotation.discountAmount,
          notes: quotation.notes,
          orderDate: new Date(),
          orderNumber: `SO-${String(orderCount + 1).padStart(5, '0')}`,
          organizationId: context.organizationId,
          quotationId: quotation.id,
          requiredDate: quotation.validUntil,
          status: SalesOrderStatus.DRAFT,
          subtotal: quotation.subtotal,
          taxAmount: quotation.taxAmount,
          total: quotation.total,
          warehouseId: warehouse.id
        }
      });

      await db.salesOrderItem.createMany({
        data: quotation.items.map((item) => ({
          discountPercent: item.discountPercent,
          itemId: item.itemId,
          quantityDelivered: decimal(0),
          quantityOrdered: item.quantity,
          salesOrderId: order.id,
          totalPrice: item.totalPrice,
          unitPrice: item.unitPrice
        }))
      });

      await db.quotation.update({
        where: {
          id: quotation.id
        },
        data: {
          status: QuotationStatus.ACCEPTED
        }
      });

      await createAuditLog(db, context, {
        action: 'QUOTATION_CONVERTED_TO_ORDER',
        entityId: order.id,
        entityType: 'sales_order',
        newValues: {
          quotationId
        }
      });

      return getOrderOrThrow(db, context, order.id);
    });
  }

  static async listSalesOrders(context: SalesContext, query: OrdersListQuery) {
    const rows = await prisma.salesOrder.findMany({
      where: {
        branchId: context.isBranchScoped ? context.branchId : query.branchId,
        customerId: query.customerId,
        deletedAt: null,
        orderDate: getDateRange(query.startDate, query.endDate),
        organizationId: context.organizationId,
        status: query.status
      },
      include: {
        customer: true,
        items: true
      },
      orderBy: {
        orderDate: 'desc'
      }
    });

    return createPaginationResult(
      rows.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        customer: {
          id: row.customer.id,
          name: row.customer.name
        },
        orderDate: row.orderDate,
        requiredDate: row.requiredDate,
        status: row.status,
        itemsCount: row.items.length,
        total: decimalToNumber(row.total)
      })),
      query.page,
      query.pageSize,
    );
  }

  static async createSalesOrder(context: SalesContext, input: CreateSalesOrderInput) {
    return prisma.$transaction(async (db) => {
      await getCustomerOrThrow(db, context, input.customerId);
      ensureBranchAccess(context, input.branchId ?? null);
      const warehouse = await db.warehouse.findFirst({
        where: {
          id: input.warehouseId,
          isActive: true,
          organizationId: context.organizationId
        }
      });

      if (!warehouse) {
        throw new Error('Warehouse not found.');
      }

      ensureBranchAccess(context, warehouse.branchId);

      if (input.branchId && warehouse.branchId !== input.branchId) {
        throw new Error('Selected warehouse does not belong to the selected branch.');
      }

      if (input.quotationId) {
        await getQuotationOrThrow(db, context, input.quotationId);
      }

      const itemIds = [...new Set(input.items.map((item) => item.itemId))];
      const items = await db.item.findMany({
        where: {
          deletedAt: null,
          id: {
            in: itemIds
          },
          organizationId: context.organizationId
        }
      });

      if (items.length !== itemIds.length) {
        throw new Error('One or more sales order items are invalid.');
      }

      const { subtotal, lineDiscountTotal } = mapLineTotals(input.items);
      const count = await db.salesOrder.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const order = await db.salesOrder.create({
        data: {
          branchId: input.branchId ?? warehouse.branchId,
          createdBy: context.userProfileId,
          customerId: input.customerId,
          discountAmount: decimal(input.discountAmount),
          notes: input.notes ?? null,
          orderDate: toDate(input.orderDate ?? undefined) ?? new Date(),
          orderNumber: `SO-${String(count + 1).padStart(5, '0')}`,
          organizationId: context.organizationId,
          quotationId: input.quotationId ?? null,
          requiredDate: toDate(input.requiredDate ?? undefined) ?? null,
          status: SalesOrderStatus.DRAFT,
          subtotal: decimal(subtotal),
          taxAmount: decimal(input.taxAmount),
          total: decimal(subtotal + input.taxAmount - input.discountAmount - lineDiscountTotal),
          warehouseId: input.warehouseId
        }
      });

      await db.salesOrderItem.createMany({
        data: input.items.map((item) => ({
          discountPercent: item.discountPercent ?? null,
          itemId: item.itemId,
          quantityDelivered: decimal(0),
          quantityOrdered: decimal(item.quantity),
          salesOrderId: order.id,
          totalPrice: decimal(item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100)),
          unitPrice: decimal(item.unitPrice)
        }))
      });

      await createAuditLog(db, context, {
        action: 'SALES_ORDER_CREATED',
        entityId: order.id,
        entityType: 'sales_order'
      });

      return getOrderOrThrow(db, context, order.id);
    });
  }

  static async getSalesOrder(context: SalesContext, orderId: string) {
    return getOrderOrThrow(prisma, context, orderId);
  }

  static async confirmOrder(context: SalesContext, orderId: string) {
    return prisma.$transaction(async (db) => {
      const order = await getOrderOrThrow(db, context, orderId);

      if (order.status !== SalesOrderStatus.DRAFT) {
        throw new Error('Only draft sales orders can be confirmed.');
      }

      const updated = await db.salesOrder.update({
        where: {
          id: orderId
        },
        data: {
          status: SalesOrderStatus.CONFIRMED
        }
      });

      await createAuditLog(db, context, {
        action: 'SALES_ORDER_CONFIRMED',
        entityId: orderId,
        entityType: 'sales_order'
      });

      return updated;
    });
  }

  static async cancelOrder(context: SalesContext, orderId: string) {
    return prisma.$transaction(async (db) => {
      const order = await getOrderOrThrow(db, context, orderId);

      if (order.status === SalesOrderStatus.DELIVERED || order.status === SalesOrderStatus.INVOICED) {
        throw new Error('Delivered or invoiced orders cannot be cancelled.');
      }

      const updated = await db.salesOrder.update({
        where: {
          id: orderId
        },
        data: {
          status: SalesOrderStatus.CANCELLED
        }
      });

      await createAuditLog(db, context, {
        action: 'SALES_ORDER_CANCELLED',
        entityId: orderId,
        entityType: 'sales_order'
      });

      return updated;
    });
  }

  static async createDeliveryNote(context: SalesContext, input: CreateDeliveryNoteInput) {
    return prisma.$transaction(async (db) => {
      const order = await getOrderOrThrow(db, context, input.salesOrderId);

      if (order.status !== SalesOrderStatus.CONFIRMED && order.status !== SalesOrderStatus.PICKING) {
        throw new Error('Delivery notes can only be created for confirmed orders.');
      }

      const count = await db.deliveryNote.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const delivery = await db.deliveryNote.create({
        data: {
          deliveredBy: context.userProfileId,
          deliveryDate: toDate(input.deliveryDate ?? undefined) ?? new Date(),
          deliveryNumber: `DN-${String(count + 1).padStart(5, '0')}`,
          notes: input.notes ?? null,
          organizationId: context.organizationId,
          salesOrderId: input.salesOrderId,
          status: DeliveryNoteStatus.DRAFT
        }
      });

      await createAuditLog(db, context, {
        action: 'DELIVERY_NOTE_CREATED',
        entityId: delivery.id,
        entityType: 'delivery_note'
      });

      return delivery;
    });
  }

  static async confirmDelivery(context: SalesContext, deliveryNoteId: string) {
    return prisma.$transaction(async (db) => {
      const note = await db.deliveryNote.findFirst({
        where: {
          deletedAt: null,
          id: deliveryNoteId,
          organizationId: context.organizationId
        },
        include: {
          salesOrder: {
            include: {
              customer: true,
              items: {
                include: {
                  item: true
                }
              }
            }
          }
        }
      });

      if (!note) {
        throw new Error('Delivery note not found.');
      }

      ensureBranchAccess(context, note.salesOrder.branchId);

      if (note.status !== DeliveryNoteStatus.DRAFT && note.status !== DeliveryNoteStatus.DISPATCHED) {
        throw new Error('Only draft or dispatched delivery notes can be confirmed.');
      }

      await db.salesOrderItem.updateMany({
        where: {
          salesOrderId: note.salesOrderId
        },
        data: {
          quantityDelivered: decimal(0)
        }
      });

      for (const item of note.salesOrder.items) {
        await db.salesOrderItem.update({
          where: {
            id: item.id
          },
          data: {
            quantityDelivered: item.quantityOrdered
          }
        });
      }

      const updated = await db.deliveryNote.update({
        where: {
          id: deliveryNoteId
        },
        data: {
          status: DeliveryNoteStatus.DELIVERED
        }
      });

      await db.salesOrder.update({
        where: {
          id: note.salesOrderId
        },
        data: {
          status: SalesOrderStatus.DELIVERED
        }
      });

      const pdf = await buildDeliveryNotePdf({
        deliveryAddress: note.salesOrder.customer.address,
        deliveryDate: note.deliveryDate.toISOString().slice(0, 10),
        deliveryNumber: note.deliveryNumber,
        items: note.salesOrder.items.map((item) => ({
          item: `${item.item.code} - ${item.item.name}`,
          qty: decimalToNumber(item.quantityOrdered)
        }))
      });

      await storeDocument(db, context, {
        buffer: pdf,
        fileName: `${note.deliveryNumber}.pdf`,
        fileType: 'application/pdf',
        referenceId: note.id,
        referenceType: 'delivery_note'
      });

      await createAuditLog(db, context, {
        action: 'DELIVERY_NOTE_CONFIRMED',
        entityId: deliveryNoteId,
        entityType: 'delivery_note'
      });

      return updated;
    });
  }

  static async listInvoices(context: SalesContext, query: InvoicesListQuery) {
    const rows = await prisma.invoice.findMany({
      where: {
        customerId: query.customerId,
        deletedAt: null,
        invoiceDate: getDateRange(query.startDate, query.endDate),
        organizationId: context.organizationId,
        status: query.status,
        salesOrder: context.isBranchScoped && context.branchId ? { branchId: context.branchId } : undefined
      },
      include: {
        customer: true,
        items: true
      },
      orderBy: {
        invoiceDate: 'desc'
      }
    });

    return createPaginationResult(
      rows.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        customer: {
          id: row.customer.id,
          name: row.customer.name
        },
        invoiceDate: row.invoiceDate,
        dueDate: row.dueDate,
        status: row.status,
        total: decimalToNumber(row.total),
        amountPaid: decimalToNumber(row.amountPaid),
        balanceDue: decimalToNumber(row.balanceDue),
        itemsCount: row.items.length
      })),
      query.page,
      query.pageSize,
    );
  }

  static async createInvoice(context: SalesContext, input: CreateInvoiceInput) {
    return prisma.$transaction(async (db) => {
      const customer = await getCustomerOrThrow(db, context, input.customerId);
      let orderItems: Array<{
        discountPercent: Decimal | null;
        itemId: string;
        quantityOrdered: Decimal;
        totalPrice: Decimal;
        unitPrice: Decimal;
      }> = [];
      let branchId: string | null = null;

      if (input.salesOrderId) {
        const order = await getOrderOrThrow(db, context, input.salesOrderId);
        branchId = order.branchId;
        orderItems = order.items.map((item) => ({
          discountPercent: item.discountPercent,
          itemId: item.itemId,
          quantityOrdered: item.quantityOrdered,
          totalPrice: item.totalPrice,
          unitPrice: item.unitPrice
        }));
      }

      ensureBranchAccess(context, branchId);

      const items = input.items?.length
        ? input.items
        : orderItems.map((item) => ({
            discountPercent: decimalToNumber(item.discountPercent),
            itemId: item.itemId,
            quantity: decimalToNumber(item.quantityOrdered),
            unitPrice: decimalToNumber(item.unitPrice)
          }));

      if (!items.length) {
        throw new Error('Invoice requires at least one line item.');
      }

      const itemIds = [...new Set(items.map((item) => item.itemId))];
      const validItems = await db.item.findMany({
        where: {
          deletedAt: null,
          id: {
            in: itemIds
          },
          organizationId: context.organizationId
        }
      });

      if (validItems.length !== itemIds.length) {
        throw new Error('One or more invoice items are invalid.');
      }

      const { subtotal, lineDiscountTotal } = mapLineTotals(items);
      const count = await db.invoice.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const total = subtotal + input.taxAmount - input.discountAmount - lineDiscountTotal;
      const invoice = await db.invoice.create({
        data: {
          amountPaid: decimal(0),
          balanceDue: decimal(total),
          createdBy: context.userProfileId,
          customerId: input.customerId,
          discountAmount: decimal(input.discountAmount),
          dueDate: toDate(input.dueDate ?? undefined) ?? null,
          invoiceDate: toDate(input.invoiceDate ?? undefined) ?? new Date(),
          invoiceNumber: `INV-${String(count + 1).padStart(5, '0')}`,
          notes: input.notes ?? null,
          organizationId: context.organizationId,
          salesOrderId: input.salesOrderId ?? null,
          status: InvoiceStatus.SENT,
          subtotal: decimal(subtotal),
          taxAmount: decimal(input.taxAmount),
          total: decimal(total)
        }
      });

      await db.invoiceItem.createMany({
        data: items.map((item) => ({
          discountPercent: item.discountPercent ?? null,
          invoiceId: invoice.id,
          itemId: item.itemId,
          quantity: decimal(item.quantity),
          totalPrice: decimal(item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100)),
          unitPrice: decimal(item.unitPrice)
        }))
      });

      await db.customer.update({
        where: {
          id: customer.id
        },
        data: {
          currentBalance: (customer.currentBalance ?? decimal(0)).plus(decimal(total))
        }
      });

      if (input.salesOrderId) {
        await db.salesOrder.update({
          where: {
            id: input.salesOrderId
          },
          data: {
            status: SalesOrderStatus.INVOICED
          }
        });
      }

      await createAuditLog(db, context, {
        action: 'INVOICE_CREATED',
        entityId: invoice.id,
        entityType: 'invoice',
        newValues: {
          total
        }
      });

      return getInvoiceOrThrow(db, context, invoice.id);
    });
  }

  static async getInvoice(context: SalesContext, invoiceId: string) {
    return getInvoiceOrThrow(prisma, context, invoiceId);
  }

  static async updateInvoice(context: SalesContext, invoiceId: string, input: UpdateInvoiceInput) {
    return prisma.$transaction(async (db) => {
      const invoice = await getInvoiceOrThrow(db, context, invoiceId);

      if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
        throw new Error('Paid or cancelled invoices cannot be edited.');
      }

      const nextItems = input.items
        ? input.items
        : invoice.items.map((item) => ({
            discountPercent: decimalToNumber(item.discountPercent),
            itemId: item.itemId,
            quantity: decimalToNumber(item.quantity),
            unitPrice: decimalToNumber(item.unitPrice)
          }));
      const discountAmount =
        input.discountAmount === undefined ? decimalToNumber(invoice.discountAmount) : input.discountAmount;
      const taxAmount = input.taxAmount === undefined ? decimalToNumber(invoice.taxAmount) : input.taxAmount;
      const { subtotal, lineDiscountTotal } = mapLineTotals(nextItems);
      const total = subtotal + taxAmount - discountAmount - lineDiscountTotal;
      const nextAmountPaid = decimalToNumber(invoice.amountPaid);
      const balanceDue = Math.max(0, total - nextAmountPaid);

      await db.invoice.update({
        where: {
          id: invoiceId
        },
        data: {
          balanceDue: decimal(balanceDue),
          discountAmount: input.discountAmount === undefined ? undefined : decimal(input.discountAmount),
          dueDate: input.dueDate === undefined ? undefined : toDate(input.dueDate) ?? null,
          notes: input.notes,
          status: input.status ?? normalizeInvoiceStatus(nextAmountPaid, total),
          subtotal: decimal(subtotal),
          taxAmount: input.taxAmount === undefined ? undefined : decimal(input.taxAmount),
          total: decimal(total)
        }
      });

      if (input.items) {
        const itemIds = [...new Set(input.items.map((item) => item.itemId))];
        const items = await db.item.findMany({
          where: {
            deletedAt: null,
            id: {
              in: itemIds
            },
            organizationId: context.organizationId
          }
        });

        if (items.length !== itemIds.length) {
          throw new Error('One or more invoice items are invalid.');
        }

        await db.invoiceItem.deleteMany({
          where: {
            invoiceId
          }
        });

        await db.invoiceItem.createMany({
          data: input.items.map((item) => ({
            discountPercent: item.discountPercent ?? null,
            invoiceId,
            itemId: item.itemId,
            quantity: decimal(item.quantity),
            totalPrice: decimal(item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100)),
            unitPrice: decimal(item.unitPrice)
          }))
        });
      }

      await createAuditLog(db, context, {
        action: 'INVOICE_UPDATED',
        entityId: invoiceId,
        entityType: 'invoice'
      });

      return getInvoiceOrThrow(db, context, invoiceId);
    });
  }

  static async recordPayment(
    context: SalesContext,
    invoiceId: string,
    amount: number,
    method: PaymentMethodCode,
    reference?: string | null,
  ) {
    return prisma.$transaction(async (db) => {
      const invoice = await getInvoiceOrThrow(db, context, invoiceId);
      const customer = await getCustomerOrThrow(db, context, invoice.customerId);

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new Error('Cannot apply payment to cancelled invoice.');
      }

      const paymentCount = await db.payment.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const payment = await db.payment.create({
        data: {
          amount: decimal(amount),
          createdBy: context.userProfileId,
          customerId: invoice.customerId,
          notes: `Invoice payment for ${invoice.invoiceNumber}`,
          organizationId: context.organizationId,
          paymentDate: new Date(),
          paymentMethod: method,
          paymentNumber: `PAY-${String(paymentCount + 1).padStart(5, '0')}`,
          referenceNumber: reference ?? null,
          supplierId: null
        }
      });

      const nextAmountPaid = decimalToNumber(invoice.amountPaid.plus(decimal(amount)));
      const total = decimalToNumber(invoice.total);
      const nextBalanceDue = Math.max(0, total - nextAmountPaid);
      const nextStatus = normalizeInvoiceStatus(nextAmountPaid, total);
      const updatedInvoice = await db.invoice.update({
        where: {
          id: invoiceId
        },
        data: {
          amountPaid: decimal(nextAmountPaid),
          balanceDue: decimal(nextBalanceDue),
          status: nextStatus
        }
      });

      const nextCustomerBalance = Math.max(
        0,
        decimalToNumber(customer.currentBalance) - amount,
      );
      await db.customer.update({
        where: {
          id: customer.id
        },
        data: {
          currentBalance: decimal(nextCustomerBalance)
        }
      });

      const receiptPdf = await buildReceiptPdf({
        amountPaid: amount,
        invoiceNumber: invoice.invoiceNumber,
        method,
        paymentDate: payment.paymentDate.toISOString().slice(0, 10),
        paymentNumber: payment.paymentNumber,
        reference
      });

      const receipt = await storeDocument(db, context, {
        buffer: receiptPdf,
        fileName: `${payment.paymentNumber}.pdf`,
        fileType: 'application/pdf',
        referenceId: payment.id,
        referenceType: 'payment_receipt'
      });

      await createAuditLog(db, context, {
        action: 'INVOICE_PAYMENT_RECORDED',
        entityId: invoiceId,
        entityType: 'invoice',
        newValues: {
          amount,
          method
        }
      });
      await (db as unknown as { notification?: { create?: (input: unknown) => Promise<unknown> } }).notification?.create?.({
        data: {
          message: `Payment of ${amount.toFixed(2)} received for invoice ${invoice.invoiceNumber}.`,
          organizationId: context.organizationId,
          referenceId: invoiceId,
          referenceType: 'PAYMENT_RECEIVED',
          title: 'Payment received',
          type: 'SUCCESS',
          userProfileId: context.userProfileId
        }
      });

      return {
        invoice: updatedInvoice,
        payment,
        receipt
      };
    });
  }

  static async createCustomerReturn(context: SalesContext, input: CreateCustomerReturnInput) {
    return prisma.$transaction(async (db) => {
      await getCustomerOrThrow(db, context, input.customerId);

      if (input.invoiceId) {
        await getInvoiceOrThrow(db, context, input.invoiceId);
      }

      const count = await db.customerReturn.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const customerReturn = await db.customerReturn.create({
        data: {
          createdBy: context.userProfileId,
          customerId: input.customerId,
          invoiceId: input.invoiceId ?? null,
          organizationId: context.organizationId,
          reason: input.reason,
          returnDate: toDate(input.returnDate ?? undefined) ?? new Date(),
          returnNumber: `CRN-${String(count + 1).padStart(5, '0')}`,
          status: ReturnStatus.DRAFT,
          totalValue: decimal(input.totalValue)
        }
      });

      await createAuditLog(db, context, {
        action: 'CUSTOMER_RETURN_CREATED',
        entityId: customerReturn.id,
        entityType: 'customer_return'
      });

      return customerReturn;
    });
  }

  static async createInvoicePdf(context: SalesContext, invoiceId: string) {
    return prisma.$transaction(async (db) => {
      const invoice = await getInvoiceOrThrow(db, context, invoiceId);
      const pdf = await buildInvoicePdf({
        amountPaid: decimalToNumber(invoice.amountPaid),
        balanceDue: decimalToNumber(invoice.balanceDue),
        customerAddress: invoice.customer.address,
        customerName: invoice.customer.name,
        discount: decimalToNumber(invoice.discountAmount),
        dueDate: invoice.dueDate?.toISOString().slice(0, 10),
        invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
        invoiceNumber: invoice.invoiceNumber,
        items: invoice.items.map((item) => ({
          discount: decimalToNumber(item.discountPercent),
          item: `${item.item.code} - ${item.item.name}`,
          qty: decimalToNumber(item.quantity),
          total: decimalToNumber(item.totalPrice),
          unitPrice: decimalToNumber(item.unitPrice)
        })),
        paymentTerms: invoice.customer.paymentTerms,
        subtotal: decimalToNumber(invoice.subtotal),
        tax: decimalToNumber(invoice.taxAmount),
        total: decimalToNumber(invoice.total)
      });
      const document = await storeDocument(db, context, {
        buffer: pdf,
        fileName: `${invoice.invoiceNumber}.pdf`,
        fileType: 'application/pdf',
        referenceId: invoice.id,
        referenceType: 'invoice'
      });

      return {
        content: pdf,
        document,
        fileName: `${invoice.invoiceNumber}.pdf`,
        mimeType: 'application/pdf'
      };
    });
  }

  static async createQuotationPdf(context: SalesContext, quotationId: string) {
    return prisma.$transaction(async (db) => {
      const quotation = await getQuotationOrThrow(db, context, quotationId);
      const pdf = await buildQuotationPdf({
        customerAddress: quotation.customer.address,
        customerName: quotation.customer.name,
        discount: decimalToNumber(quotation.discountAmount),
        items: quotation.items.map((item) => ({
          discount: decimalToNumber(item.discountPercent),
          item: `${item.item.code} - ${item.item.name}`,
          qty: decimalToNumber(item.quantity),
          total: decimalToNumber(item.totalPrice),
          unitPrice: decimalToNumber(item.unitPrice)
        })),
        quotationDate: quotation.quotationDate.toISOString().slice(0, 10),
        quotationNumber: quotation.quotationNumber,
        subtotal: decimalToNumber(quotation.subtotal),
        tax: decimalToNumber(quotation.taxAmount),
        total: decimalToNumber(quotation.total),
        validUntil: quotation.validUntil?.toISOString().slice(0, 10)
      });
      const document = await storeDocument(db, context, {
        buffer: pdf,
        fileName: `${quotation.quotationNumber}.pdf`,
        fileType: 'application/pdf',
        referenceId: quotation.id,
        referenceType: 'quotation'
      });

      return {
        content: pdf,
        document,
        fileName: `${quotation.quotationNumber}.pdf`,
        mimeType: 'application/pdf'
      };
    });
  }
}
