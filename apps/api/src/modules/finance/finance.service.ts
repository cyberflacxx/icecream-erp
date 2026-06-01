import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { AppError } from '../../lib/app-error';
import type {
  CreateJournalEntryInput,
  FinanceDashboardQuery,
  FinanceJournalListQuery,
  UpdateJournalEntryInput
} from './finance.schemas';

interface FinanceContext {
  organizationId: string;
  userProfileId: string;
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

export function validateJournalBalance(
  lines: Array<{
    creditAmount: number;
    debitAmount: number;
  }>,
) {
  if (lines.length < 2) {
    throw new AppError(
      'Journal entry must have at least 2 lines (one debit, one credit)',
      400,
      'INSUFFICIENT_LINES',
    );
  }

  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debitAmount) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.creditAmount) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);

  if (difference > 0.01) {
    throw new AppError(
      `Journal entry is not balanced. Total debit: $${totalDebit.toFixed(2)}. Total credit: $${totalCredit.toFixed(2)}. Difference: $${difference.toFixed(2)}. Debits must equal credits.`,
      400,
      'JOURNAL_UNBALANCED',
    );
  }

  for (const line of lines) {
    const hasBoth = line.debitAmount > 0 && line.creditAmount > 0;
    const hasNeither = line.debitAmount <= 0 && line.creditAmount <= 0;

    if (hasBoth) {
      throw new AppError(
        'A journal line cannot have both debit and credit amounts. Each line must be one or the other.',
        400,
        'INVALID_JOURNAL_LINE',
      );
    }

    if (hasNeither) {
      throw new AppError(
        'Each journal line must have either a debit or credit amount greater than zero.',
        400,
        'EMPTY_JOURNAL_LINE',
      );
    }
  }
}

async function getJournalOrThrow(
  context: FinanceContext,
  journalId: string,
) {
  const entry = await prisma.journalEntry.findFirst({
    where: {
      id: journalId,
      organizationId: context.organizationId
    },
    include: {
      lines: true
    }
  });

  if (!entry) {
    throw new AppError('Journal entry not found', 404);
  }

  return entry;
}

function mapJournalEntry(
  entry: Awaited<ReturnType<typeof getJournalOrThrow>>,
) {
  const totalDebit = decimalToNumber(entry.totalDebit);
  const totalCredit = decimalToNumber(entry.totalCredit);

  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    entryDate: entry.entryDate,
    description: entry.description,
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    status: entry.status,
    isPosted: entry.isPosted,
    postedBy: entry.postedBy,
    postedAt: entry.postedAt,
    totalDebit: totalDebit || entry.lines.reduce((sum, line) => sum + decimalToNumber(line.debitAmount), 0),
    totalCredit:
      totalCredit || entry.lines.reduce((sum, line) => sum + decimalToNumber(line.creditAmount), 0),
    lines: entry.lines.map((line) => ({
      id: line.id,
      accountId: line.accountId,
      description: line.description,
      debitAmount: decimalToNumber(line.debitAmount),
      creditAmount: decimalToNumber(line.creditAmount)
    }))
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

      return {
        stats: {
          revenue: payments.reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0),
          payments: payments.length,
          outstandingReceivables,
          outstandingPayables: 0
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

  static async listJournalEntries(context: FinanceContext, query: FinanceJournalListQuery) {
    const rows = await prisma.journalEntry.findMany({
      where: {
        organizationId: context.organizationId,
        entryDate: toDateRange(query.startDate, query.endDate),
        status: query.status,
        OR: query.search
          ? [
              { entryNumber: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } }
            ]
          : undefined
      },
      include: {
        lines: true
      },
      orderBy: {
        entryDate: 'desc'
      }
    });

    return createPaginationResult(rows.map(mapJournalEntry), query.page, query.pageSize);
  }

  static async createJournalEntry(context: FinanceContext, input: CreateJournalEntryInput) {
    validateJournalBalance(input.lines);

    return prisma.$transaction(async (tx) => {
      const accountIds = [...new Set(input.lines.map((line) => line.accountId))];
      const accounts = await tx.account.findMany({
        where: {
          id: {
            in: accountIds
          },
          organizationId: context.organizationId
        },
        select: {
          id: true
        }
      });

      if (accounts.length !== accountIds.length) {
        throw new AppError('One or more journal line accounts are invalid.', 400);
      }

      const count = await tx.journalEntry.count({
        where: {
          organizationId: context.organizationId
        }
      });

      const totalDebit = input.lines.reduce((sum, line) => sum + line.debitAmount, 0);
      const totalCredit = input.lines.reduce((sum, line) => sum + line.creditAmount, 0);

      const entry = await tx.journalEntry.create({
        data: {
          createdBy: context.userProfileId,
          description: input.description,
          entryDate: new Date(input.entryDate),
          entryNumber: `JE-${String(count + 1).padStart(5, '0')}`,
          isPosted: false,
          organizationId: context.organizationId,
          referenceId: input.referenceId ?? null,
          referenceType: input.referenceType ?? null,
          status: 'DRAFT',
          totalCredit: new Decimal(totalCredit),
          totalDebit: new Decimal(totalDebit)
        }
      });

      await tx.journalEntryLine.createMany({
        data: input.lines.map((line) => ({
          accountId: line.accountId,
          creditAmount: new Decimal(line.creditAmount),
          debitAmount: new Decimal(line.debitAmount),
          description: line.description ?? null,
          journalEntryId: entry.id
        }))
      });

      await tx.auditLog.create({
        data: {
          action: 'JOURNAL_ENTRY_CREATED',
          entityId: entry.id,
          entityType: 'journal_entry',
          organizationId: context.organizationId,
          userProfileId: context.userProfileId
        }
      });

      return mapJournalEntry(await getJournalOrThrow(context, entry.id));
    });
  }

  static async getJournalEntry(context: FinanceContext, journalId: string) {
    return mapJournalEntry(await getJournalOrThrow(context, journalId));
  }

  static async updateJournalEntry(
    context: FinanceContext,
    journalId: string,
    input: UpdateJournalEntryInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({
        where: {
          id: journalId,
          organizationId: context.organizationId
        },
        include: {
          lines: true
        }
      });

      if (!entry) {
        throw new AppError('Journal entry not found', 404);
      }

      if (entry.isPosted) {
        throw new AppError(
          `Journal entry ${entry.entryNumber} has been posted and cannot be modified. Create a reversal entry instead.`,
          403,
          'POSTED_RECORD_LOCKED',
        );
      }

      const nextLines = input.lines
        ? input.lines
        : entry.lines.map((line) => ({
            accountId: line.accountId,
            creditAmount: decimalToNumber(line.creditAmount),
            debitAmount: decimalToNumber(line.debitAmount),
            description: line.description ?? undefined
          }));

      validateJournalBalance(nextLines);
      const totalDebit = nextLines.reduce((sum, line) => sum + line.debitAmount, 0);
      const totalCredit = nextLines.reduce((sum, line) => sum + line.creditAmount, 0);

      await tx.journalEntry.update({
        where: {
          id: journalId
        },
        data: {
          description: input.description,
          entryDate: input.entryDate ? new Date(input.entryDate) : undefined,
          referenceId: input.referenceId,
          referenceType: input.referenceType,
          totalCredit: new Decimal(totalCredit),
          totalDebit: new Decimal(totalDebit)
        }
      });

      if (input.lines) {
        await tx.journalEntryLine.deleteMany({
          where: {
            journalEntryId: journalId
          }
        });

        await tx.journalEntryLine.createMany({
          data: input.lines.map((line) => ({
            accountId: line.accountId,
            creditAmount: new Decimal(line.creditAmount),
            debitAmount: new Decimal(line.debitAmount),
            description: line.description ?? null,
            journalEntryId: journalId
          }))
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'JOURNAL_ENTRY_UPDATED',
          entityId: journalId,
          entityType: 'journal_entry',
          organizationId: context.organizationId,
          userProfileId: context.userProfileId
        }
      });

      return mapJournalEntry(await getJournalOrThrow(context, journalId));
    });
  }

  static async postJournalEntry(context: FinanceContext, journalId: string) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({
        where: {
          id: journalId,
          organizationId: context.organizationId
        },
        include: {
          lines: true
        }
      });

      if (!entry) {
        throw new AppError('Journal entry not found', 404);
      }

      const lines = entry.lines.map((line) => ({
        creditAmount: decimalToNumber(line.creditAmount),
        debitAmount: decimalToNumber(line.debitAmount)
      }));
      validateJournalBalance(lines);

      const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
      const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);

      const updated = await tx.journalEntry.update({
        where: {
          id: journalId
        },
        data: {
          isPosted: true,
          postedAt: new Date(),
          postedBy: context.userProfileId,
          status: 'POSTED',
          totalCredit: new Decimal(totalCredit),
          totalDebit: new Decimal(totalDebit)
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'JOURNAL_ENTRY_POSTED',
          entityId: journalId,
          entityType: 'journal_entry',
          organizationId: context.organizationId,
          userProfileId: context.userProfileId
        }
      });

      return updated;
    });
  }

  static async deleteJournalEntry(context: FinanceContext, journalId: string) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({
        where: {
          id: journalId,
          organizationId: context.organizationId
        }
      });

      if (!entry) {
        throw new AppError('Journal entry not found', 404);
      }

      if (entry.isPosted) {
        throw new AppError(
          `Journal entry ${entry.entryNumber} has been posted and cannot be modified. Create a reversal entry instead.`,
          403,
          'POSTED_RECORD_LOCKED',
        );
      }

      await tx.journalEntryLine.deleteMany({
        where: {
          journalEntryId: journalId
        }
      });

      await tx.journalEntry.delete({
        where: {
          id: journalId
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'JOURNAL_ENTRY_DELETED',
          entityId: journalId,
          entityType: 'journal_entry',
          organizationId: context.organizationId,
          userProfileId: context.userProfileId
        }
      });

      return {
        id: journalId,
        success: true
      };
    });
  }
}
