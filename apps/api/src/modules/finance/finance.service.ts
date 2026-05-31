import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import type { FinanceDashboardQuery } from './finance.schemas';

interface FinanceContext {
  organizationId: string;
}

const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

function decimalToNumber(value: Decimal | null | undefined) {
  return value ? Number(value.toString()) : 0;
}

function toDate(date?: string | null) {
  if (!date) {
    return undefined;
  }

  return new Date(`${date}T00:00:00.000Z`);
}

function toDateRange(startDate?: string, endDate?: string) {
  return {
    gte: startDate ? toDate(startDate) : undefined,
    lte: endDate ? toDate(endDate) : undefined
  };
}

function getFallbackDashboard() {
  return {
    stats: {
      revenue: 0,
      payments: 0,
      outstandingReceivables: 0,
      outstandingPayables: 0
    },
    charts: {
      cashflowLast7Days: [],
      paymentMethodBreakdown: []
    },
    overdueInvoices: [],
    recentEntries: []
  };
}

export class FinanceService {
  static async getDashboard(context: FinanceContext, query: FinanceDashboardQuery) {
    if (!isDatabaseConfigured) {
      return getFallbackDashboard();
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);
      const startDate = query.startDate ?? sevenDaysAgo.toISOString().slice(0, 10);
      const endDate = query.endDate ?? today.toISOString().slice(0, 10);

      const [payments, expenses, overdueInvoices, recentEntries] = await Promise.all([
        prisma.payment.findMany({
          where: {
            organizationId: context.organizationId,
            paymentDate: toDateRange(startDate, endDate)
          },
          orderBy: {
            paymentDate: 'asc'
          }
        }),
        prisma.branchExpense.findMany({
          where: {
            deletedAt: null,
            organizationId: context.organizationId,
            expenseDate: toDateRange(startDate, endDate)
          },
          orderBy: {
            expenseDate: 'asc'
          }
        }),
        prisma.invoice.findMany({
          where: {
            deletedAt: null,
            organizationId: context.organizationId,
            status: {
              in: ['SENT', 'PARTIAL_PAID', 'OVERDUE']
            }
          },
          include: {
            customer: true
          },
          orderBy: {
            dueDate: 'asc'
          },
          take: 8
        }),
        prisma.journalEntry.findMany({
          where: {
            organizationId: context.organizationId,
            entryDate: toDateRange(startDate, endDate)
          },
          include: {
            lines: true
          },
          orderBy: {
            entryDate: 'desc'
          },
          take: 10
        })
      ]);

      const revenueByDay = new Map<string, number>();
      const expenseByDay = new Map<string, number>();
      const paymentMethodMap = new Map<string, number>();

      for (const payment of payments) {
        const day = payment.paymentDate.toISOString().slice(0, 10);
        const amount = decimalToNumber(payment.amount);
        revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + amount);
        paymentMethodMap.set(
          payment.paymentMethod,
          (paymentMethodMap.get(payment.paymentMethod) ?? 0) + amount,
        );
      }

      for (const expense of expenses) {
        const day = expense.expenseDate.toISOString().slice(0, 10);
        const amount = decimalToNumber(expense.amount);
        expenseByDay.set(day, (expenseByDay.get(day) ?? 0) + amount);
      }

      const cashflowDays = new Set([...revenueByDay.keys(), ...expenseByDay.keys()]);
      const cashflowLast7Days = Array.from(cashflowDays)
        .sort()
        .map((day) => ({
          day,
          revenue: revenueByDay.get(day) ?? 0,
          expenses: expenseByDay.get(day) ?? 0
        }));

      const outstandingReceivables = overdueInvoices.reduce(
        (sum, invoice) => sum + decimalToNumber(invoice.balanceDue),
        0,
      );

      const outstandingPayables = 0;

      return {
        stats: {
          revenue: payments.reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0),
          payments: payments.length,
          outstandingReceivables,
          outstandingPayables
        },
        charts: {
          cashflowLast7Days,
          paymentMethodBreakdown: Array.from(paymentMethodMap.entries()).map(([method, total]) => ({
            method,
            total
          }))
        },
        overdueInvoices: overdueInvoices.map((invoice) => ({
          balance: decimalToNumber(invoice.balanceDue),
          customer: invoice.customer?.name ?? 'Walk-in',
          dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : 'N/A',
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status
        })),
        recentEntries: recentEntries.map((entry) => ({
          credit: entry.lines.reduce((sum, line) => sum + decimalToNumber(line.creditAmount), 0),
          debit: entry.lines.reduce((sum, line) => sum + decimalToNumber(line.debitAmount), 0),
          description: entry.description,
          entryDate: entry.entryDate.toISOString().slice(0, 10),
          entryNumber: entry.entryNumber
        }))
      };
    } catch {
      return getFallbackDashboard();
    }
  }
}
