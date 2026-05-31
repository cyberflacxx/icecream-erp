import assert from 'node:assert/strict';
import test from 'node:test';

import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { runDailyReportJob } from '../jobs/daily-report.job';
import { runExpiryAlertJob } from '../jobs/expiry-alert.job';
import { runLowStockCheckJob } from '../jobs/low-stock-check.job';
import { ReportType } from '../modules/reports/reports.constants';
import { ReportsService } from '../modules/reports/reports.service';

function decimal(value: number | string) {
  return new Decimal(value);
}

function cloneValue<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value instanceof Decimal) {
    return new Decimal(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneValue(item)]),
    ) as T;
  }

  return value;
}

async function withMockedPrisma<T>(
  mocks: Partial<Record<keyof typeof prisma, unknown>>,
  callback: () => Promise<T>,
) {
  const prismaAny = prisma as unknown as Record<string, unknown>;
  const originals = Object.fromEntries(
    Object.keys(mocks).map((key) => [key, prismaAny[key]]),
  );

  Object.assign(prismaAny, mocks);

  try {
    return await callback();
  } finally {
    Object.assign(prismaAny, originals);
  }
}

test('low stock check finds correct items', async () => {
  const createdNotifications: Array<Record<string, unknown>> = [];

  await withMockedPrisma(
    {
      stockBalance: {
        findMany: async () =>
          cloneValue([
            {
              item: { code: 'RM-LOW', reorderLevel: decimal(40) },
              quantityAvailable: decimal(12),
              warehouse: { code: 'MAIN' }
            },
            {
              item: { code: 'RM-OK', reorderLevel: decimal(10) },
              quantityAvailable: decimal(40),
              warehouse: { code: 'MAIN' }
            }
          ])
      },
      userProfile: {
        findMany: async () =>
          cloneValue([
            { id: 'user-1', organizationId: 'org-1' },
            { id: 'user-2', organizationId: 'org-1' }
          ])
      },
      notification: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdNotifications.push(cloneValue(data));

          return cloneValue(data);
        }
      }
    },
    async () => {
      const result = await runLowStockCheckJob();

      assert.equal(result.notifications, 2);
      assert.equal(createdNotifications.length, 2);
      assert.match(String(createdNotifications[0]?.message ?? ''), /RM-LOW/);
      assert.doesNotMatch(String(createdNotifications[0]?.message ?? ''), /RM-OK/);
    },
  );
});

test('expiry alert finds correct batches', async () => {
  const createdNotifications: Array<Record<string, unknown>> = [];

  await withMockedPrisma(
    {
      inventoryBatch: {
        findMany: async () =>
          cloneValue([
            {
              batchNumber: 'BATCH-EXP-1',
              item: { code: 'FG-001' },
              organization: { id: 'org-1' },
              quantityRemaining: decimal(25),
              warehouse: { code: 'MAIN' }
            }
          ])
      },
      userProfile: {
        findMany: async () =>
          cloneValue([{ id: 'warehouse-user', organizationId: 'org-1' }])
      },
      notification: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdNotifications.push(cloneValue(data));

          return cloneValue(data);
        }
      }
    },
    async () => {
      const result = await runExpiryAlertJob(7);

      assert.equal(result.notifications, 1);
      assert.match(String(createdNotifications[0]?.message ?? ''), /BATCH-EXP-1/);
    },
  );
});

test('daily report generates correct data', async () => {
  const createdDocuments: Array<Record<string, unknown>> = [];

  await withMockedPrisma(
    {
      productionBatch: {
        findMany: async () =>
          cloneValue([
            {
              actualOutput: decimal(200),
              efficiencyPercentage: decimal(95),
              wastageQuantity: decimal(6)
            },
            {
              actualOutput: decimal(180),
              efficiencyPercentage: decimal(90),
              wastageQuantity: decimal(9)
            }
          ])
      },
      organization: {
        findMany: async () => cloneValue([{ id: 'org-1' }, { id: 'org-2' }])
      },
      documentFile: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdDocuments.push(cloneValue(data));

          return cloneValue({ id: `doc-${createdDocuments.length}`, ...data });
        }
      }
    },
    async () => {
      const result = await runDailyReportJob('2026-05-30');

      assert.equal(result.records, 2);
      assert.equal(result.summary.batches, 2);
      assert.equal(result.summary.totalOutput, 380);
      assert.equal(result.summary.totalWastage, 15);
      assert.equal(result.summary.avgEfficiency, 92.5);
      assert.equal(createdDocuments.length, 2);
    },
  );
});

test('CSV export contains correct columns', async () => {
  await withMockedPrisma(
    {
      stockBalance: {
        findMany: async () =>
          cloneValue([
            {
              item: { name: 'Milk Powder', reorderLevel: decimal(50) },
              quantityAvailable: decimal(20),
              warehouse: { name: 'Main Warehouse' }
            }
          ])
      }
    },
    async () => {
      const result = await ReportsService.exportCsv(
        {
          branchId: null,
          isBranchScoped: false,
          organizationId: 'org-1',
          userProfileId: 'user-1'
        },
        {
          reportType: ReportType.LOW_STOCK
        },
      );

      const headerLine = result.content.split('\n')[0];
      assert.equal(headerLine, 'item,warehouse,reorderLevel,available,deficit');
    },
  );
});
