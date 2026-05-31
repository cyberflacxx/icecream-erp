import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import type { ProductionDashboardQuery } from './production.schemas';

interface ProductionContext {
  branchId: string | null;
  isBranchScoped: boolean;
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

function resolveBranchScope(context: ProductionContext, requestedBranchId?: string) {
  if (context.isBranchScoped && context.branchId) {
    return context.branchId;
  }

  return requestedBranchId;
}

function getFallbackDashboard() {
  return {
    stats: {
      plannedBatches: 0,
      inProgressBatches: 0,
      completedToday: 0,
      avgEfficiency: 0,
      totalWastage: 0
    },
    charts: {
      outputLast7Days: [],
      statusBreakdown: []
    },
    openBatches: [],
    materialsAtRisk: [],
    qualityAlerts: {
      failed: 0,
      pending: 0
    }
  };
}

export class ProductionService {
  static async getDashboard(context: ProductionContext, query: ProductionDashboardQuery) {
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
      const branchId = resolveBranchScope(context, query.branchId);

      const batches = await prisma.productionBatch.findMany({
        where: {
          deletedAt: null,
          organizationId: context.organizationId,
          productionDate: toDateRange(startDate, endDate),
          warehouse: branchId ? { branchId } : undefined
        },
        orderBy: {
          productionDate: 'asc'
        }
      });

      const openBatches = await prisma.productionBatch.findMany({
        where: {
          deletedAt: null,
          organizationId: context.organizationId,
          status: {
            in: ['PLANNED', 'MATERIALS_RESERVED', 'IN_PROGRESS', 'QUALITY_CHECK']
          },
          warehouse: branchId ? { branchId } : undefined
        },
        orderBy: {
          productionDate: 'desc'
        },
        take: 8
      });

      const qualityFailed = await prisma.qualityCheck.count({
        where: {
          organizationId: context.organizationId,
          status: 'FAILED'
        }
      });

      const qualityPending = await prisma.qualityCheck.count({
        where: {
          organizationId: context.organizationId,
          status: 'PENDING'
        }
      });

      const stockBalances = await prisma.stockBalance.findMany({
        where: {
          organizationId: context.organizationId,
          warehouse: branchId ? { branchId } : undefined,
          item: {
            itemType: 'RAW_MATERIAL'
          }
        },
        include: {
          item: true,
          warehouse: true
        }
      });

      const statusMap = new Map<string, number>();
      const outputMap = new Map<string, number>();
      let completedToday = 0;
      let efficiencySum = 0;
      let wastageSum = 0;

      const todayKey = today.toISOString().slice(0, 10);

      for (const batch of batches) {
        statusMap.set(batch.status, (statusMap.get(batch.status) ?? 0) + 1);
        const day = batch.productionDate.toISOString().slice(0, 10);
        outputMap.set(day, (outputMap.get(day) ?? 0) + decimalToNumber(batch.actualOutput));
        efficiencySum += decimalToNumber(batch.efficiencyPercentage);
        wastageSum += decimalToNumber(batch.wastageQuantity);

        if (batch.status === 'COMPLETED' && day === todayKey) {
          completedToday += 1;
        }
      }

      const materialsAtRisk = stockBalances
        .filter(
          (row) =>
            row.item.reorderLevel !== null &&
            row.item.reorderLevel.greaterThanOrEqualTo(row.quantityAvailable),
        )
        .map((row) => {
          const reorderLevel = decimalToNumber(row.item.reorderLevel);
          const available = decimalToNumber(row.quantityAvailable);

          return {
            item: row.item.name,
            warehouse: row.warehouse.name,
            available,
            reorderLevel,
            deficit: Math.max(0, reorderLevel - available)
          };
        })
        .sort((a, b) => b.deficit - a.deficit)
        .slice(0, 8);

      return {
        stats: {
          plannedBatches: statusMap.get('PLANNED') ?? 0,
          inProgressBatches:
            (statusMap.get('MATERIALS_RESERVED') ?? 0) +
            (statusMap.get('IN_PROGRESS') ?? 0) +
            (statusMap.get('QUALITY_CHECK') ?? 0),
          completedToday,
          avgEfficiency: batches.length ? efficiencySum / batches.length : 0,
          totalWastage: wastageSum
        },
        charts: {
          outputLast7Days: Array.from(outputMap.entries()).map(([day, output]) => ({
            day,
            output
          })),
          statusBreakdown: Array.from(statusMap.entries()).map(([status, count]) => ({
            status,
            count
          }))
        },
        openBatches: openBatches.map((batch) => ({
          batchNumber: batch.batchNumber,
          output: decimalToNumber(batch.actualOutput),
          productionDate: batch.productionDate.toISOString().slice(0, 10),
          productionLine: batch.productionLine,
          shift: batch.shift,
          status: batch.status
        })),
        materialsAtRisk,
        qualityAlerts: {
          failed: qualityFailed,
          pending: qualityPending
        }
      };
    } catch {
      return getFallbackDashboard();
    }
  }
}

