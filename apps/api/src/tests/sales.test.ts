import assert from 'node:assert/strict';
import test from 'node:test';

import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { InvoiceStatus, SalesOrderStatus } from '../modules/sales/sales.constants';
import { SalesService } from '../modules/sales/sales.service';

interface MockCustomer {
  creditLimit: Decimal | null;
  currentBalance: Decimal | null;
  deletedAt: Date | null;
  id: string;
  name: string;
  organizationId: string;
  paymentTerms: string | null;
}

interface MockInvoice {
  amountPaid: Decimal;
  balanceDue: Decimal;
  customerId: string;
  deletedAt: Date | null;
  id: string;
  invoiceNumber: string;
  organizationId: string;
  salesOrderId: string | null;
  status: InvoiceStatus;
  total: Decimal;
}

interface MockSalesOrder {
  customerId: string;
  deletedAt: Date | null;
  id: string;
  organizationId: string;
  status: SalesOrderStatus;
  total: Decimal;
  warehouseId: string;
}

interface MockState {
  auditLogs: Array<{ action: string; entityId: string }>;
  customers: MockCustomer[];
  documents: Array<{ referenceId: string }>;
  invoices: MockInvoice[];
  payments: Array<{ amount: Decimal; customerId: string; id: string; paymentNumber: string }>;
  salesOrders: MockSalesOrder[];
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
    customers: [
      {
        creditLimit: decimal(5000),
        currentBalance: decimal(1000),
        deletedAt: null,
        id: 'customer-1',
        name: 'Retail Mart',
        organizationId: context.organizationId,
        paymentTerms: 'CREDIT_30'
      }
    ],
    documents: [],
    invoices: [
      {
        amountPaid: decimal(0),
        balanceDue: decimal(1000),
        customerId: 'customer-1',
        deletedAt: null,
        id: 'invoice-1',
        invoiceNumber: 'INV-0001',
        organizationId: context.organizationId,
        salesOrderId: null,
        status: InvoiceStatus.SENT,
        total: decimal(1000)
      }
    ],
    payments: [],
    salesOrders: [
      {
        customerId: 'customer-1',
        deletedAt: null,
        id: 'order-1',
        organizationId: context.organizationId,
        status: SalesOrderStatus.DRAFT,
        total: decimal(200),
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
      create: async ({ data }: { data: { action: string; entityId: string } }) => {
        state.auditLogs.push(cloneValue(data));
        return data;
      }
    },
    customer: {
      findFirst: async ({ where }: { where: { deletedAt?: null; id?: string; organizationId?: string } }) =>
        cloneValue(
          state.customers.find(
            (row) =>
              (!where.id || row.id === where.id) &&
              (!where.organizationId || row.organizationId === where.organizationId) &&
              (where.deletedAt === undefined ? true : row.deletedAt === where.deletedAt),
          ) ?? null,
        ),
      findUnique: async ({ where }: { where: { id: string } }) =>
        cloneValue(state.customers.find((row) => row.id === where.id) ?? null),
      update: async ({ data, where }: { data: Partial<MockCustomer>; where: { id: string } }) => {
        const customer = state.customers.find((row) => row.id === where.id);
        if (!customer) throw new Error('Customer not found');
        Object.assign(customer, cloneValue(data));
        return cloneValue(customer);
      }
    },
    documentFile: {
      create: async ({ data }: { data: { referenceId: string } }) => {
        state.documents.push(cloneValue(data));
        return data;
      }
    },
    invoice: {
      findFirst: async ({ where }: { where: { deletedAt?: null; id?: string; organizationId?: string } }) => {
        const invoice = state.invoices.find(
          (row) =>
            (!where.id || row.id === where.id) &&
            (!where.organizationId || row.organizationId === where.organizationId) &&
            (where.deletedAt === undefined ? true : row.deletedAt === where.deletedAt),
        );
        if (!invoice) return null;
        const customer = state.customers.find((row) => row.id === invoice.customerId);
        if (!customer) return null;
        return cloneValue({
          ...invoice,
          customer,
          items: []
        });
      },
      update: async ({ data, where }: { data: Partial<MockInvoice>; where: { id: string } }) => {
        const invoice = state.invoices.find((row) => row.id === where.id);
        if (!invoice) throw new Error('Invoice not found');
        Object.assign(invoice, cloneValue(data));
        return cloneValue(invoice);
      }
    },
    payment: {
      count: async ({ where }: { where: { organizationId?: string } }) =>
        state.payments.filter((row) => !where.organizationId || row.id.startsWith('payment-')).length,
      create: async ({ data }: { data: { amount: Decimal; customerId: string; paymentNumber: string } }) => {
        const payment = { id: `payment-${idCounter++}`, ...cloneValue(data) };
        state.payments.push(payment);
        return cloneValue({
          ...payment,
          paymentDate: new Date()
        });
      }
    },
    salesOrder: {
      findFirst: async ({ where }: { where: { deletedAt?: null; id?: string; organizationId?: string } }) => {
        const order = state.salesOrders.find(
          (row) =>
            (!where.id || row.id === where.id) &&
            (!where.organizationId || row.organizationId === where.organizationId) &&
            (where.deletedAt === undefined ? true : row.deletedAt === where.deletedAt),
        );
        if (!order) return null;
        const customer = state.customers.find((row) => row.id === order.customerId);
        if (!customer) return null;
        return cloneValue({
          ...order,
          customer,
          items: [],
          warehouse: { branchId: null, id: order.warehouseId }
        });
      },
      update: async ({ data, where }: { data: Partial<MockSalesOrder>; where: { id: string } }) => {
        const order = state.salesOrders.find((row) => row.id === where.id);
        if (!order) throw new Error('Order not found');
        Object.assign(order, cloneValue(data));
        return cloneValue(order);
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
    getState: () => cloneValue(state)
  };

  return mock;
}

async function withMockState<T>(
  initialState: MockState,
  callback: (mock: ReturnType<typeof createMockPrisma>) => Promise<T>,
) {
  const prismaAny = prisma as unknown as Record<string, unknown>;
  const mock = createMockPrisma(initialState);
  const original = {
    $transaction: prismaAny.$transaction,
    auditLog: prismaAny.auditLog,
    customer: prismaAny.customer,
    documentFile: prismaAny.documentFile,
    invoice: prismaAny.invoice,
    payment: prismaAny.payment,
    salesOrder: prismaAny.salesOrder
  };

  Object.assign(prismaAny, {
    $transaction: mock.$transaction,
    auditLog: mock.auditLog,
    customer: mock.customer,
    documentFile: mock.documentFile,
    invoice: mock.invoice,
    payment: mock.payment,
    salesOrder: mock.salesOrder
  });

  try {
    return await callback(mock);
  } finally {
    Object.assign(prismaAny, original);
  }
}

test('recordPayment updates invoice amountPaid and balanceDue', async () => {
  await withMockState(createState(), async (mock) => {
    await SalesService.recordPayment(context, 'invoice-1', {
      amount: 400,
      paymentDate: new Date().toISOString(),
      paymentMethod: 'CASH'
    });
    const state = mock.getState();
    const invoice = state.invoices[0]!;
    assert.equal(invoice.amountPaid.toNumber(), 400);
    assert.equal(invoice.balanceDue.toNumber(), 600);
    assert.equal(invoice.status, InvoiceStatus.PARTIAL_PAID);
  });
});

test('full payment sets invoice status to PAID', async () => {
  await withMockState(createState(), async (mock) => {
    await SalesService.recordPayment(context, 'invoice-1', {
      amount: 1000,
      paymentDate: new Date().toISOString(),
      paymentMethod: 'CARD'
    });
    const invoice = mock.getState().invoices[0]!;
    assert.equal(invoice.status, InvoiceStatus.PAID);
    assert.equal(invoice.balanceDue.toNumber(), 0);
  });
});

test('overpayment throws error', async () => {
  await withMockState(createState(), async () => {
    await assert.rejects(
      () =>
        SalesService.recordPayment(context, 'invoice-1', {
          amount: 1200,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'CASH'
        }),
      (error: Error & { code?: string }) => error.code === 'OVERPAYMENT',
    );
  });
});

test('payment on cancelled invoice throws error', async () => {
  await withMockState(
    createState({
      invoices: [{ ...createState().invoices[0]!, status: InvoiceStatus.CANCELLED }]
    }),
    async () => {
      await assert.rejects(
        () =>
          SalesService.recordPayment(context, 'invoice-1', {
            amount: 200,
            paymentDate: new Date().toISOString(),
            paymentMethod: 'CASH'
          }),
        /cancelled invoice/i,
      );
    },
  );
});

test('customer balance decreases after payment', async () => {
  await withMockState(createState(), async (mock) => {
    await SalesService.recordPayment(context, 'invoice-1', {
      amount: 400,
      paymentDate: new Date().toISOString(),
      paymentMethod: 'ECOCASH'
    });
    const customer = mock.getState().customers[0]!;
    assert.equal(customer.currentBalance?.toNumber(), 600);
  });
});

test('credit limit exceeded throws error', async () => {
  await withMockState(
    createState({
      customers: [
        {
          creditLimit: decimal(500),
          currentBalance: decimal(400),
          deletedAt: null,
          id: 'customer-1',
          name: 'Retail Mart',
          organizationId: context.organizationId,
          paymentTerms: 'CREDIT_30'
        }
      ],
      salesOrders: [
        {
          customerId: 'customer-1',
          deletedAt: null,
          id: 'order-1',
          organizationId: context.organizationId,
          status: SalesOrderStatus.DRAFT,
          total: decimal(200),
          warehouseId: 'warehouse-1'
        }
      ]
    }),
    async () => {
      await assert.rejects(
        () => SalesService.confirmOrder(context, 'order-1'),
        (error: Error & { code?: string }) => error.code === 'CREDIT_LIMIT_EXCEEDED',
      );
    },
  );
});
