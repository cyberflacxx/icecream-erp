import {
  Prisma,
  ProductionBatchStatus,
  QualityStatus
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@absolute-ice-cream/database';

import { AppError } from '../../lib/app-error';
import { InventoryService } from '../inventory/inventory.service';
import type {
  CancelProductionBatchInput,
  CloseProductionBatchInput,
  CreateProductionBatchInput,
  ProductionBatchesQuery,
  ProductionDashboardQuery,
  RecordQualityResultInput
} from './production.schemas';

interface ProductionContext {
  branchId: string | null;
  isBranchScoped: boolean;
  organizationId: string;
  userProfileId: string;
}

const BATCH_TRANSITIONS: Record<ProductionBatchStatus, ProductionBatchStatus[]> = {
  DRAFT: ['PLANNED', 'CANCELLED'],
  PLANNED: ['MATERIALS_REQUESTED', 'CANCELLED'],
  MATERIALS_REQUESTED: ['MATERIALS_APPROVED', 'CANCELLED'],
  MATERIALS_APPROVED: ['MATERIALS_RESERVED', 'CANCELLED'],
  MATERIALS_RESERVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WIP', 'QUALITY_CHECK', 'CANCELLED'],
  WIP: ['QUALITY_CHECK', 'CANCELLED'],
  QUALITY_CHECK: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

function assertValidTransition(
  batchNumber: string,
  current: ProductionBatchStatus,
  next: ProductionBatchStatus,
) {
  const allowed = BATCH_TRANSITIONS[current] ?? [];

  if (!allowed.includes(next)) {
    throw new AppError(
      `Batch ${batchNumber}: cannot transition from ${current} to ${next}. Allowed next states: ${
        allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
      }`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }
}

function decimal(value: Decimal | number | string) {
  return value instanceof Decimal ? value : new Decimal(value);
}

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

function resolveBranchScope(context: ProductionContext, requestedBranchId?: string) {
  if (context.isBranchScoped && context.branchId) {
    return context.branchId;
  }

  return requestedBranchId;
}

async function createAuditLog(
  context: ProductionContext,
  input: {
    action: string;
    entityId: string;
    entityType: string;
    newValues?: Prisma.InputJsonValue;
    oldValues?: Prisma.InputJsonValue;
  },
  tx: Prisma.TransactionClient,
) {
  await tx.auditLog.create({
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

async function getBatchOrThrow(
  tx: Prisma.TransactionClient,
  context: ProductionContext,
  batchId: string,
) {
  const batch = await tx.productionBatch.findFirst({
    where: {
      deletedAt: null,
      id: batchId,
      organizationId: context.organizationId
    },
    include: {
      materials: true,
      outputs: true,
      recipe: {
        include: {
          items: {
            include: {
              item: {
                select: {
                  code: true,
                  name: true
                }
              },
              unit: {
                select: {
                  abbreviation: true
                }
              }
            }
          },
          packagingItems: {
            select: {
              itemId: true,
              quantityRequired: true,
              unitId: true
            }
          }
        }
      },
      warehouse: true
    }
  });

  if (!batch) {
    throw new AppError('Production batch not found', 404);
  }

  if (context.isBranchScoped && context.branchId && batch.warehouse.branchId !== context.branchId) {
    throw new AppError('This role is limited to its assigned branch.', 403);
  }

  return batch;
}

function mapBatch(batch: Awaited<ReturnType<typeof getBatchOrThrow>>) {
  return {
    id: batch.id,
    batchNumber: batch.batchNumber,
    productionDate: batch.productionDate,
    productionLine: batch.productionLine,
    shift: batch.shift,
    status: batch.status,
    qualityStatus: batch.qualityStatus,
    plannedQuantity: decimalToNumber(batch.plannedQuantity),
    expectedOutput: decimalToNumber(batch.expectedOutput),
    actualOutput: decimalToNumber(batch.actualOutput),
    wastageQuantity: decimalToNumber(batch.wastageQuantity),
    wastagePercentage: decimalToNumber(batch.wastagePercentage),
    efficiencyPercentage: decimalToNumber(batch.efficiencyPercentage),
    warehouseId: batch.warehouseId,
    recipeId: batch.recipeId,
    startTime: batch.startTime,
    endTime: batch.endTime
  };
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

  static async listBatches(context: ProductionContext, query: ProductionBatchesQuery) {
    const branchId = resolveBranchScope(context, query.branchId);
    const rows = await prisma.productionBatch.findMany({
      where: {
        deletedAt: null,
        organizationId: context.organizationId,
        productionDate: toDateRange(query.startDate, query.endDate),
        recipeId: query.recipeId,
        status: query.status,
        warehouseId: query.warehouseId,
        warehouse: branchId ? { branchId } : undefined,
        OR: query.search
          ? [
              {
                batchNumber: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              },
              {
                productionLine: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              }
            ]
          : undefined
      },
      include: {
        recipe: true,
        warehouse: true
      },
      orderBy: {
        productionDate: 'desc'
      }
    });

    return createPaginationResult(
      rows.map((row) => ({
        id: row.id,
        batchNumber: row.batchNumber,
        productionDate: row.productionDate,
        shift: row.shift,
        productionLine: row.productionLine,
        status: row.status,
        qualityStatus: row.qualityStatus,
        plannedQuantity: decimalToNumber(row.plannedQuantity),
        expectedOutput: decimalToNumber(row.expectedOutput),
        actualOutput: decimalToNumber(row.actualOutput),
        recipe: {
          id: row.recipe.id,
          code: row.recipe.code,
          name: row.recipe.name
        },
        warehouse: {
          id: row.warehouse.id,
          name: row.warehouse.name
        }
      })),
      query.page,
      query.pageSize,
    );
  }

  static async createBatch(context: ProductionContext, input: CreateProductionBatchInput) {
    return prisma.$transaction(async (tx) => {
      const [recipe, warehouse] = await Promise.all([
        tx.recipe.findFirst({
          where: {
            deletedAt: null,
            id: input.recipeId,
            organizationId: context.organizationId,
            status: 'ACTIVE'
          }
        }),
        tx.warehouse.findFirst({
          where: {
            id: input.warehouseId,
            isActive: true,
            organizationId: context.organizationId
          }
        })
      ]);

      if (!recipe) {
        throw new AppError('Recipe not found or inactive.', 404);
      }

      if (!warehouse) {
        throw new AppError('Warehouse not found.', 404);
      }

      if (context.isBranchScoped && context.branchId && warehouse.branchId !== context.branchId) {
        throw new AppError('This role is limited to its assigned branch.', 403);
      }

      const batchCount = await tx.productionBatch.count({
        where: {
          organizationId: context.organizationId
        }
      });
      const batchNumber = `PB-${String(batchCount + 1).padStart(5, '0')}`;

      const batch = await tx.productionBatch.create({
        data: {
          batchNumber,
          expectedOutput: decimal(input.expectedOutput),
          organizationId: context.organizationId,
          plannedQuantity: decimal(input.plannedQuantity),
          productionDate: toDate(input.productionDate) ?? new Date(),
          productionLine: input.productionLine,
          recipeId: input.recipeId,
          shift: input.shift,
          status: ProductionBatchStatus.PLANNED,
          warehouseId: input.warehouseId
        }
      });

      await tx.productionBatchOutput.create({
        data: {
          batchId: batch.id,
          expectedQuantity: decimal(input.expectedOutput),
          itemId: recipe.finishedItemId,
          unitId: recipe.outputUnitId
        }
      });

      await createAuditLog(
        context,
        {
          action: 'PRODUCTION_BATCH_CREATED',
          entityId: batch.id,
          entityType: 'production_batch',
          newValues: {
            batchNumber: batch.batchNumber,
            status: batch.status
          }
        },
        tx,
      );

      return mapBatch(await getBatchOrThrow(tx, context, batch.id));
    });
  }

  static async getBatch(context: ProductionContext, batchId: string) {
    return prisma.$transaction(async (tx) => mapBatch(await getBatchOrThrow(tx, context, batchId)));
  }

  static async requestMaterials(context: ProductionContext, batchId: string) {
    return prisma.$transaction(async (tx) => {
      const batch = await getBatchOrThrow(tx, context, batchId);
      assertValidTransition(batch.batchNumber, batch.status, ProductionBatchStatus.MATERIALS_REQUESTED);

      const updated = await tx.productionBatch.update({
        where: {
          id: batchId
        },
        data: {
          status: ProductionBatchStatus.MATERIALS_REQUESTED
        }
      });

      await createAuditLog(
        context,
        {
          action: 'PRODUCTION_MATERIALS_REQUESTED',
          entityId: batchId,
          entityType: 'production_batch',
          newValues: {
            status: updated.status
          }
        },
        tx,
      );

      return updated;
    });
  }

  static async approveMaterials(context: ProductionContext, batchId: string) {
    return prisma.$transaction(async (tx) => {
      const batch = await getBatchOrThrow(tx, context, batchId);
      assertValidTransition(batch.batchNumber, batch.status, ProductionBatchStatus.MATERIALS_APPROVED);

      const updated = await tx.productionBatch.update({
        where: {
          id: batchId
        },
        data: {
          status: ProductionBatchStatus.MATERIALS_APPROVED
        }
      });

      await createAuditLog(
        context,
        {
          action: 'PRODUCTION_MATERIALS_APPROVED',
          entityId: batchId,
          entityType: 'production_batch',
          newValues: {
            status: updated.status
          }
        },
        tx,
      );

      return updated;
    });
  }

  static async reserveMaterials(context: ProductionContext, batchId: string) {
    return prisma.$transaction(
      async (tx) => {
        const batch = await getBatchOrThrow(tx, context, batchId);
        assertValidTransition(batch.batchNumber, batch.status, ProductionBatchStatus.MATERIALS_RESERVED);

        const baseOutput = decimalToNumber(batch.recipe.expectedOutputQuantity);
        const scaleFactor =
          baseOutput > 0 ? decimalToNumber(batch.plannedQuantity) / baseOutput : 1;
        const packagingItemIds = [...new Set(batch.recipe.packagingItems.map((item) => item.itemId))];
        const packagingUnitIds = [...new Set(batch.recipe.packagingItems.map((item) => item.unitId))];
        const [packagingItems, packagingUnits] = await Promise.all([
          tx.item.findMany({
            where: {
              id: {
                in: packagingItemIds
              }
            },
            select: {
              id: true,
              code: true,
              name: true
            }
          }),
          tx.unitOfMeasure.findMany({
            where: {
              id: {
                in: packagingUnitIds
              }
            },
            select: {
              id: true,
              abbreviation: true
            }
          })
        ]);
        const packagingItemMap = new Map(packagingItems.map((item) => [item.id, item]));
        const packagingUnitMap = new Map(packagingUnits.map((unit) => [unit.id, unit]));
        const ingredients = [
          ...batch.recipe.items.map((item) => ({
            itemId: item.itemId,
            itemName: item.item.name,
            itemCode: item.item.code,
            quantityRequired: decimalToNumber(item.quantityRequired) * scaleFactor,
            unitAbbreviation: item.unit.abbreviation,
            unitId: item.unitId
          })),
          ...batch.recipe.packagingItems.map((item) => ({
            itemId: item.itemId,
            itemName: packagingItemMap.get(item.itemId)?.name ?? 'Unknown item',
            itemCode: packagingItemMap.get(item.itemId)?.code ?? 'N/A',
            quantityRequired: decimalToNumber(item.quantityRequired) * scaleFactor,
            unitAbbreviation: packagingUnitMap.get(item.unitId)?.abbreviation ?? '-',
            unitId: item.unitId
          }))
        ];

        const failures: string[] = [];

        for (const ingredient of ingredients) {
          const required = decimal(ingredient.quantityRequired);
          const balance = await tx.stockBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: ingredient.itemId,
                warehouseId: batch.warehouseId
              }
            }
          });

          const available = balance
            ? balance.quantityOnHand.minus(balance.quantityReserved)
            : decimal(0);

          if (available.lessThan(required)) {
            failures.push(
              `${ingredient.itemName} (${ingredient.itemCode}): need ${required.toFixed(3)} ${ingredient.unitAbbreviation}, available ${available.toFixed(3)} ${ingredient.unitAbbreviation}`,
            );
          }
        }

        if (failures.length > 0) {
          throw new AppError(
            `Cannot reserve materials. Insufficient stock for ${failures.length} item(s):\n${failures.join('\n')}`,
            400,
            'INSUFFICIENT_STOCK_FOR_BATCH',
          );
        }

        for (const ingredient of ingredients) {
          const required = decimal(ingredient.quantityRequired);
          const balance = await tx.stockBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: ingredient.itemId,
                warehouseId: batch.warehouseId
              }
            }
          });

          if (!balance) {
            throw new AppError(
              `Stock balance missing for ingredient ${ingredient.itemName}.`,
              400,
              'INSUFFICIENT_STOCK_FOR_BATCH',
            );
          }

          await tx.stockBalance.update({
            where: {
              itemId_warehouseId: {
                itemId: ingredient.itemId,
                warehouseId: batch.warehouseId
              }
            },
            data: {
              quantityReserved: balance.quantityReserved.plus(required),
              quantityAvailable: balance.quantityOnHand.minus(balance.quantityReserved.plus(required)),
              lastUpdated: new Date()
            }
          });

          const existingMaterial = await tx.productionBatchMaterial.findFirst({
            where: {
              batchId,
              itemId: ingredient.itemId
            }
          });

          if (existingMaterial) {
            await tx.productionBatchMaterial.update({
              where: {
                id: existingMaterial.id
              },
              data: {
                quantityRequired: required
              }
            });
          } else {
            await tx.productionBatchMaterial.create({
              data: {
                batchId,
                itemId: ingredient.itemId,
                quantityActual: decimal(0),
                quantityIssued: decimal(0),
                quantityRequired: required,
                unitId: ingredient.unitId,
                variance: decimal(0)
              }
            });
          }
        }

        await tx.productionBatch.update({
          where: {
            id: batchId
          },
          data: {
            status: ProductionBatchStatus.MATERIALS_RESERVED
          }
        });

        await createAuditLog(
          context,
          {
            action: 'MATERIALS_RESERVED',
            entityId: batchId,
            entityType: 'production_batch',
            newValues: {
              itemsReserved: ingredients.length,
              status: ProductionBatchStatus.MATERIALS_RESERVED
            }
          },
          tx,
        );

        return mapBatch(await getBatchOrThrow(tx, context, batchId));
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      },
    );
  }

  static async startBatch(context: ProductionContext, batchId: string) {
    return prisma.$transaction(async (tx) => {
      const batch = await getBatchOrThrow(tx, context, batchId);
      assertValidTransition(batch.batchNumber, batch.status, ProductionBatchStatus.IN_PROGRESS);

      const updated = await tx.productionBatch.update({
        where: {
          id: batchId
        },
        data: {
          startTime: new Date(),
          startedBy: context.userProfileId,
          status: ProductionBatchStatus.IN_PROGRESS
        }
      });

      await createAuditLog(
        context,
        {
          action: 'PRODUCTION_BATCH_STARTED',
          entityId: batchId,
          entityType: 'production_batch',
          newValues: {
            status: updated.status
          }
        },
        tx,
      );

      return updated;
    });
  }

  static async submitBatchQuality(context: ProductionContext, batchId: string) {
    return prisma.$transaction(async (tx) => {
      const batch = await getBatchOrThrow(tx, context, batchId);
      assertValidTransition(batch.batchNumber, batch.status, ProductionBatchStatus.QUALITY_CHECK);

      const updated = await tx.productionBatch.update({
        where: {
          id: batchId
        },
        data: {
          qualityStatus: QualityStatus.PENDING,
          status: ProductionBatchStatus.QUALITY_CHECK
        }
      });

      await createAuditLog(
        context,
        {
          action: 'PRODUCTION_BATCH_SUBMIT_QUALITY',
          entityId: batchId,
          entityType: 'production_batch',
          newValues: {
            status: updated.status
          }
        },
        tx,
      );

      return updated;
    });
  }

  static async recordQualityResult(
    context: ProductionContext,
    batchId: string,
    input: RecordQualityResultInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const batch = await getBatchOrThrow(tx, context, batchId);
      if (batch.status !== ProductionBatchStatus.QUALITY_CHECK) {
        assertValidTransition(batch.batchNumber, batch.status, ProductionBatchStatus.QUALITY_CHECK);
      }
      if (input.status === 'FAILED' && !input.rejectionReason) {
        throw new AppError(
          'Rejection reason required when quality check fails',
          400,
          'QUALITY_REJECTION_REASON_REQUIRED',
        );
      }

      const updated = await tx.productionBatch.update({
        where: {
          id: batchId
        },
        data: {
          qualityNotes: input.notes ?? batch.qualityNotes,
          qualityStatus: input.status,
          status: ProductionBatchStatus.QUALITY_CHECK
        }
      });

      await tx.qualityCheck.create({
        data: {
          checkDate: new Date(),
          checkedBy: context.userProfileId,
          failedQuantity: input.failedQuantity ? decimal(input.failedQuantity) : null,
          notes: input.notes ?? null,
          organizationId: context.organizationId,
          passedQuantity: input.passedQuantity ? decimal(input.passedQuantity) : null,
          referenceId: batchId,
          referenceType: 'production_batch',
          status: input.status
        }
      });

      await createAuditLog(
        context,
        {
          action: 'PRODUCTION_BATCH_QUALITY_RESULT',
          entityId: batchId,
          entityType: 'production_batch',
          newValues: {
            qualityStatus: input.status,
            rejectionReason: input.rejectionReason ?? null
          }
        },
        tx,
      );

      return updated;
    });
  }

  static async closeBatch(
    context: ProductionContext,
    batchId: string,
    input: CloseProductionBatchInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const batch = await getBatchOrThrow(tx, context, batchId);
      assertValidTransition(batch.batchNumber, batch.status, ProductionBatchStatus.COMPLETED);

      if (batch.qualityStatus === QualityStatus.FAILED) {
        throw new AppError(
          `Cannot close batch ${batch.batchNumber}: quality check FAILED. Cancel this batch instead and investigate.`,
          400,
          'QUALITY_CHECK_FAILED',
        );
      }

      if (batch.qualityStatus === QualityStatus.PENDING) {
        throw new AppError(
          `Cannot close batch ${batch.batchNumber}: quality check has not been completed yet.`,
          400,
          'QUALITY_CHECK_PENDING',
        );
      }

      const actualByItemId = new Map(input.actualMaterials.map((row) => [row.itemId, row.quantityActual]));

      for (const material of batch.materials) {
        const requiredQty = decimalToNumber(material.quantityRequired);
        const defaultIssued = decimalToNumber(material.quantityIssued);
        const actualQty = (actualByItemId.get(material.itemId) ?? defaultIssued) || requiredQty;

        if (actualQty <= 0) {
          continue;
        }

        await InventoryService.issueStock(
          {
            branchId: context.branchId,
            isBranchScoped: context.isBranchScoped,
            organizationId: context.organizationId,
            userProfileId: context.userProfileId
          },
          {
            itemId: material.itemId,
            movementType: 'PRODUCTION_ISSUE',
            quantity: actualQty,
            reference: {
              id: batchId,
              type: 'production_batch'
            },
            warehouseId: batch.warehouseId
          },
          tx,
        );

        await tx.productionBatchMaterial.update({
          where: {
            id: material.id
          },
          data: {
            quantityActual: decimal(actualQty),
            quantityIssued: decimal(actualQty),
            variance: decimal(requiredQty - actualQty)
          }
        });
      }

      const refreshedMaterials = await tx.productionBatchMaterial.findMany({
        where: {
          batchId
        }
      });

      for (const material of refreshedMaterials) {
        const toRelease = Math.max(
          0,
          decimalToNumber(material.quantityRequired) - decimalToNumber(material.quantityIssued),
        );

        if (toRelease <= 0) {
          continue;
        }

        const balance = await tx.stockBalance.findUnique({
          where: {
            itemId_warehouseId: {
              itemId: material.itemId,
              warehouseId: batch.warehouseId
            }
          }
        });

        if (!balance) {
          continue;
        }

        const releaseAmount = balance.quantityReserved.lessThan(decimal(toRelease))
          ? balance.quantityReserved
          : decimal(toRelease);

        await tx.stockBalance.update({
          where: {
            itemId_warehouseId: {
              itemId: material.itemId,
              warehouseId: batch.warehouseId
            }
          },
          data: {
            quantityAvailable: balance.quantityAvailable.plus(releaseAmount),
            quantityReserved: balance.quantityReserved.minus(releaseAmount),
            lastUpdated: new Date()
          }
        });
      }

      const outputs = batch.outputs.length
        ? batch.outputs
        : [
            await tx.productionBatchOutput.create({
              data: {
                batchId: batch.id,
                expectedQuantity: batch.expectedOutput,
                itemId: batch.recipe.finishedItemId,
                unitId: batch.recipe.outputUnitId
              }
            })
          ];

      let totalActualOutput = 0;

      for (const output of outputs) {
        const actualQty = decimalToNumber(output.actualQuantity);

        if (actualQty <= 0) {
          continue;
        }

        totalActualOutput += actualQty;
        await InventoryService.addFinishedGoods(
          {
            branchId: context.branchId,
            isBranchScoped: context.isBranchScoped,
            organizationId: context.organizationId,
            userProfileId: context.userProfileId
          },
          {
            batchNumber: batch.batchNumber,
            itemId: output.itemId,
            productionBatchId: batch.id,
            quantity: actualQty,
            unitCost: 0,
            warehouseId: batch.warehouseId
          },
          tx,
        );
      }

      const expectedOutput = decimalToNumber(batch.expectedOutput);
      const wastageQuantity = Math.max(0, expectedOutput - totalActualOutput);
      const wastagePercentage = expectedOutput > 0 ? (wastageQuantity / expectedOutput) * 100 : 0;
      const efficiencyPercentage = expectedOutput > 0 ? (totalActualOutput / expectedOutput) * 100 : 0;

      const updated = await tx.productionBatch.update({
        where: {
          id: batchId
        },
        data: {
          actualOutput: decimal(totalActualOutput),
          closedBy: context.userProfileId,
          efficiencyPercentage: decimal(efficiencyPercentage),
          endTime: new Date(),
          qualityNotes: batch.qualityNotes,
          status: ProductionBatchStatus.COMPLETED,
          wastagePercentage: decimal(wastagePercentage),
          wastageQuantity: decimal(wastageQuantity),
          wastageReason: input.wastageReason ?? batch.wastageReason
        }
      });

      await createAuditLog(
        context,
        {
          action: 'PRODUCTION_BATCH_COMPLETED',
          entityId: batchId,
          entityType: 'production_batch',
          newValues: {
            actualOutput: totalActualOutput,
            efficiencyPercentage,
            status: updated.status,
            wastageQuantity
          }
        },
        tx,
      );

      return mapBatch(await getBatchOrThrow(tx, context, batchId));
    });
  }

  static async cancelBatch(
    context: ProductionContext,
    batchId: string,
    input: CancelProductionBatchInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const batch = await getBatchOrThrow(tx, context, batchId);

      if (batch.status === ProductionBatchStatus.COMPLETED) {
        throw new AppError('Cannot cancel a completed batch', 400);
      }

      assertValidTransition(batch.batchNumber, batch.status, ProductionBatchStatus.CANCELLED);

      const statusesWithReservation: ProductionBatchStatus[] = [
        ProductionBatchStatus.MATERIALS_RESERVED,
        ProductionBatchStatus.IN_PROGRESS,
        ProductionBatchStatus.WIP,
        ProductionBatchStatus.QUALITY_CHECK
      ];

      if (statusesWithReservation.includes(batch.status)) {
        for (const material of batch.materials) {
          const toRelease = Math.max(
            0,
            decimalToNumber(material.quantityRequired) - decimalToNumber(material.quantityIssued),
          );

          if (toRelease <= 0) {
            continue;
          }

          const balance = await tx.stockBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: material.itemId,
                warehouseId: batch.warehouseId
              }
            }
          });

          if (!balance) {
            continue;
          }

          const releaseAmount = balance.quantityReserved.lessThan(decimal(toRelease))
            ? balance.quantityReserved
            : decimal(toRelease);

          await tx.stockBalance.update({
            where: {
              itemId_warehouseId: {
                itemId: material.itemId,
                warehouseId: batch.warehouseId
              }
            },
            data: {
              quantityAvailable: balance.quantityAvailable.plus(releaseAmount),
              quantityReserved: balance.quantityReserved.minus(releaseAmount),
              lastUpdated: new Date()
            }
          });
        }
      }

      const updated = await tx.productionBatch.update({
        where: {
          id: batchId
        },
        data: {
          closedBy: context.userProfileId,
          endTime: new Date(),
          status: ProductionBatchStatus.CANCELLED,
          wastageReason: input.reason
        }
      });

      await createAuditLog(
        context,
        {
          action: 'PRODUCTION_BATCH_CANCELLED',
          entityId: batchId,
          entityType: 'production_batch',
          newValues: {
            reason: input.reason,
            status: updated.status
          }
        },
        tx,
      );

      return updated;
    });
  }
}

export { assertValidTransition };
