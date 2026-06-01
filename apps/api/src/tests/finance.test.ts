import assert from 'node:assert/strict';
import test from 'node:test';

import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { FinanceService } from '../modules/finance/finance.service';

interface MockJournalEntry {
  description: string;
  entryDate: Date;
  entryNumber: string;
  id: string;
  isPosted: boolean;
  organizationId: string;
  postedAt: Date | null;
  postedBy: string | null;
  referenceId: string | null;
  referenceType: string | null;
  status: string;
  totalCredit: Decimal;
  totalDebit: Decimal;
}

interface MockJournalLine {
  accountId: string;
  creditAmount: Decimal;
  debitAmount: Decimal;
  description: string | null;
  id: string;
  journalEntryId: string;
}

interface MockState {
  accounts: Array<{ id: string; organizationId: string }>;
  auditLogs: Array<{ action: string; entityId: string }>;
  entries: MockJournalEntry[];
  lines: MockJournalLine[];
}

const context = {
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
    accounts: [
      { id: 'account-dr', organizationId: context.organizationId },
      { id: 'account-cr', organizationId: context.organizationId }
    ],
    auditLogs: [],
    entries: [],
    lines: [],
    ...overrides
  };
}

function createMockPrisma(initialState: MockState) {
  let state = cloneValue(initialState);
  let idCounter = 1;

  const mock = {
    account: {
      findMany: async ({ where }: { where: { id: { in: string[] }; organizationId: string } }) =>
        cloneValue(
          state.accounts.filter(
            (row) => row.organizationId === where.organizationId && where.id.in.includes(row.id),
          ),
        )
    },
    auditLog: {
      create: async ({ data }: { data: { action: string; entityId: string } }) => {
        state.auditLogs.push(cloneValue(data));
        return data;
      }
    },
    journalEntry: {
      count: async ({ where }: { where: { organizationId: string } }) =>
        state.entries.filter((row) => row.organizationId === where.organizationId).length,
      create: async ({ data }: { data: Omit<MockJournalEntry, 'id'> }) => {
        const entry = { id: `entry-${idCounter++}`, ...cloneValue(data) };
        state.entries.push(entry);
        return cloneValue(entry);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        state.entries = state.entries.filter((row) => row.id !== where.id);
      },
      findFirst: async ({ where }: { where: { id?: string; organizationId?: string } }) => {
        const entry = state.entries.find(
          (row) =>
            (!where.id || row.id === where.id) &&
            (!where.organizationId || row.organizationId === where.organizationId),
        );
        if (!entry) return null;
        return cloneValue({
          ...entry,
          lines: state.lines.filter((line) => line.journalEntryId === entry.id)
        });
      },
      update: async ({ data, where }: { data: Partial<MockJournalEntry>; where: { id: string } }) => {
        const entry = state.entries.find((row) => row.id === where.id);
        if (!entry) throw new Error('Entry not found');
        Object.assign(entry, cloneValue(data));
        return cloneValue(entry);
      }
    },
    journalEntryLine: {
      createMany: async ({ data }: { data: Array<Omit<MockJournalLine, 'id'>> }) => {
        data.forEach((line) => state.lines.push({ id: `line-${idCounter++}`, ...cloneValue(line) }));
        return { count: data.length };
      },
      deleteMany: async ({ where }: { where: { journalEntryId: string } }) => {
        state.lines = state.lines.filter((line) => line.journalEntryId !== where.journalEntryId);
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
    account: prismaAny.account,
    auditLog: prismaAny.auditLog,
    journalEntry: prismaAny.journalEntry,
    journalEntryLine: prismaAny.journalEntryLine
  };

  Object.assign(prismaAny, {
    $transaction: mock.$transaction,
    account: mock.account,
    auditLog: mock.auditLog,
    journalEntry: mock.journalEntry,
    journalEntryLine: mock.journalEntryLine
  });

  try {
    return await callback(mock);
  } finally {
    Object.assign(prismaAny, original);
  }
}

test('createJournalEntry throws when unbalanced', async () => {
  await withMockState(createState(), async () => {
    await assert.rejects(
      () =>
        FinanceService.createJournalEntry(context, {
          description: 'Unbalanced test',
          entryDate: new Date().toISOString(),
          lines: [
            { accountId: 'account-dr', creditAmount: 0, debitAmount: 500 },
            { accountId: 'account-cr', creditAmount: 400, debitAmount: 0 }
          ]
        }),
      (error: Error & { code?: string }) => error.code === 'JOURNAL_UNBALANCED',
    );
  });
});

test('createJournalEntry succeeds when balanced', async () => {
  await withMockState(createState(), async (mock) => {
    const result = await FinanceService.createJournalEntry(context, {
      description: 'Balanced test',
      entryDate: new Date().toISOString(),
      lines: [
        { accountId: 'account-dr', creditAmount: 0, debitAmount: 500 },
        { accountId: 'account-cr', creditAmount: 500, debitAmount: 0 }
      ]
    });

    assert.equal(result.totalDebit, 500);
    assert.equal(result.totalCredit, 500);
    assert.equal(mock.getState().entries.length, 1);
  });
});

test('cannot edit posted journal entry', async () => {
  await withMockState(
    createState({
      entries: [
        {
          description: 'Posted',
          entryDate: new Date(),
          entryNumber: 'JE-0001',
          id: 'entry-1',
          isPosted: true,
          organizationId: context.organizationId,
          postedAt: new Date(),
          postedBy: context.userProfileId,
          referenceId: null,
          referenceType: null,
          status: 'POSTED',
          totalCredit: decimal(200),
          totalDebit: decimal(200)
        }
      ],
      lines: [
        {
          accountId: 'account-dr',
          creditAmount: decimal(0),
          debitAmount: decimal(200),
          description: null,
          id: 'line-1',
          journalEntryId: 'entry-1'
        },
        {
          accountId: 'account-cr',
          creditAmount: decimal(200),
          debitAmount: decimal(0),
          description: null,
          id: 'line-2',
          journalEntryId: 'entry-1'
        }
      ]
    }),
    async () => {
      await assert.rejects(
        () => FinanceService.updateJournalEntry(context, 'entry-1', { description: 'Edit attempt' }),
        (error: Error & { code?: string }) => error.code === 'POSTED_RECORD_LOCKED',
      );
    },
  );
});

test('journal line cannot have both debit and credit', async () => {
  await withMockState(createState(), async () => {
    await assert.rejects(
      () =>
        FinanceService.createJournalEntry(context, {
          description: 'Invalid line',
          entryDate: new Date().toISOString(),
          lines: [
            { accountId: 'account-dr', creditAmount: 50, debitAmount: 100 },
            { accountId: 'account-cr', creditAmount: 50, debitAmount: 0 }
          ]
        }),
      (error: Error & { code?: string }) => error.code === 'INVALID_JOURNAL_LINE',
    );
  });
});
