import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import PDFDocument from 'pdfkit';

import { prisma } from '@absolute-ice-cream/database';
import {
  getAllowedReportTypesForRoles,
  resolveDashboardRoleBucket,
  resolveOperationsFocus
} from '@absolute-ice-cream/shared';

import type { ReportType } from './reports.constants';
import { ReportType as ReportTypeCode } from './reports.constants';
import type { ReportQuery } from './reports.schemas';

type DbClient = PrismaClient;

interface ReportsContext {
  branchId: string | null;
  isBranchScoped: boolean;
  organizationId: string;
  roles?: Array<{ name: string }>;
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

function getDateRange(startDate?: string, endDate?: string) {
  return {
    gte: startDate ? toDate(startDate) : undefined,
    lte: endDate ? toDate(endDate) : undefined
  };
}

function applyBranchScope(context: ReportsContext, branchId?: string) {
  if (!context.isBranchScoped || !context.branchId) {
    return branchId;
  }

  return context.branchId;
}

function getRoleNames(context: ReportsContext) {
  return context.roles?.map((role) => role.name) ?? [];
}

function ensureReportAccess(context: ReportsContext, reportType: ReportType) {
  const allowed = getAllowedReportTypesForRoles(getRoleNames(context));
  if (!allowed.includes(reportType)) {
    throw new Error(`Forbidden: report type "${reportType}" is not available for your role.`);
  }
}

function toCsv(data: Array<Record<string, unknown>>) {
  if (!data.length) {
    return 'No data';
  }

  const headers = Object.keys(data[0] ?? {});
  const lines = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((key) => {
          const value = row[key];

          if (value === null || value === undefined) {
            return '';
          }

          const text = String(value).replace(/"/g, '""');

          return `"${text}"`;
        })
        .join(','),
    )
  ];

  return lines.join('\n');
}

function toPdfBuffer(title: string, summary: Record<string, unknown>, rows: Array<Record<string, unknown>>) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4'
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Absolute Quality Icecream');
    doc.fontSize(14).text(title.toUpperCase(), { align: 'right' });
    doc.moveDown(0.8);
    doc.fontSize(10).text('Summary');
    Object.entries(summary).forEach(([key, value]) => {
      doc.text(`${key}: ${String(value)}`);
    });
    doc.moveDown(0.6);
    doc.text('Rows');
    rows.slice(0, 40).forEach((row, index) => {
      doc.text(`${index + 1}. ${JSON.stringify(row)}`);
    });
    doc.end();
  });
}

async function getDailyProductionReport(context: ReportsContext, query: ReportQuery) {
  const rows = await prisma.productionBatch.findMany({
    where: {
      deletedAt: null,
      organizationId: context.organizationId,
      productionDate: getDateRange(query.startDate, query.endDate),
      productionLine: query.productionLine,
      shift: query.shift,
      warehouse: {
        branchId: applyBranchScope(context, query.branchId)
      }
    },
    include: {
      outputs: true
    },
    orderBy: {
      productionDate: 'asc'
    }
  });

  const data = rows.map((row) => ({
    batchNumber: row.batchNumber,
    productionDate: row.productionDate.toISOString().slice(0, 10),
    shift: row.shift,
    productionLine: row.productionLine,
    output: decimalToNumber(row.actualOutput),
    efficiency: decimalToNumber(row.efficiencyPercentage),
    wastage: decimalToNumber(row.wastageQuantity)
  }));
  const chart = Array.from(
    data.reduce((map, row) => {
      const current = map.get(row.productionDate) ?? 0;
      map.set(row.productionDate, current + row.output);

      return map;
    }, new Map<string, number>()),
  ).map(([day, output]) => ({
    day,
    output
  }));

  return {
    chart,
    data,
    summary: {
      batches: data.length,
      totalOutput: data.reduce((sum, row) => sum + row.output, 0),
      avgEfficiency:
        data.length === 0
          ? 0
          : data.reduce((sum, row) => sum + row.efficiency, 0) / data.length,
      totalWastage: data.reduce((sum, row) => sum + row.wastage, 0)
    }
  };
}

async function getWastageReport(context: ReportsContext, query: ReportQuery) {
  const rows = await prisma.productionBatch.findMany({
    where: {
      deletedAt: null,
      organizationId: context.organizationId,
      productionDate: getDateRange(query.startDate, query.endDate),
      recipe: query.productId ? { finishedItemId: query.productId } : undefined,
      shift: query.shift,
      warehouse: {
        branchId: applyBranchScope(context, query.branchId)
      }
    },
    include: {
      recipe: {
        include: {
          finishedItem: true
        }
      }
    },
    orderBy: {
      productionDate: 'asc'
    }
  });

  const data = rows.map((row) => ({
    date: row.productionDate.toISOString().slice(0, 10),
    product: row.recipe.finishedItem.name,
    shift: row.shift,
    wastageQty: decimalToNumber(row.wastageQuantity),
    wastagePercent: decimalToNumber(row.wastagePercentage),
    reason: row.wastageReason ?? 'Unspecified'
  }));
  const chart = Array.from(
    data.reduce((map, row) => {
      map.set(row.reason, (map.get(row.reason) ?? 0) + row.wastageQty);

      return map;
    }, new Map<string, number>()),
  ).map(([reason, value]) => ({
    reason,
    value
  }));

  return {
    chart,
    data,
    summary: {
      totalWastageQty: data.reduce((sum, row) => sum + row.wastageQty, 0),
      avgWastagePercent:
        data.length === 0
          ? 0
          : data.reduce((sum, row) => sum + row.wastagePercent, 0) / data.length
    }
  };
}

async function getRawMaterialUsageReport(context: ReportsContext, query: ReportQuery) {
  const movements = await prisma.stockMovement.findMany({
    where: {
      createdAt: getDateRange(query.startDate, query.endDate),
      itemId: query.itemId,
      organizationId: context.organizationId,
      warehouseId: query.warehouseId
    },
    include: {
      item: true,
      warehouse: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  const daily = new Map<string, { issued: number; received: number }>();

  movements.forEach((row) => {
    const date = row.createdAt.toISOString().slice(0, 10);
    const current = daily.get(date) ?? { issued: 0, received: 0 };
    const quantity = decimalToNumber(row.quantity);

    if (['PURCHASE_RECEIVE', 'TRANSFER_IN', 'ADJUSTMENT_IN'].includes(row.movementType)) {
      current.received += quantity;
    } else if (
      ['PRODUCTION_ISSUE', 'SALES_ISSUE', 'TRANSFER_OUT', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY_WRITE_OFF'].includes(
        row.movementType,
      )
    ) {
      current.issued += quantity;
    }

    daily.set(date, current);
  });

  const chart = Array.from(daily.entries()).map(([date, values]) => ({
    date,
    issued: values.issued,
    received: values.received
  }));
  const data = chart.map((row) => ({
    date: row.date,
    opening: 0,
    received: row.received,
    issued: row.issued,
    closing: row.received - row.issued
  }));

  return {
    chart,
    data,
    summary: {
      totalIssued: data.reduce((sum, row) => sum + row.issued, 0),
      totalReceived: data.reduce((sum, row) => sum + row.received, 0)
    }
  };
}

async function getBranchSalesReport(context: ReportsContext, query: ReportQuery) {
  const rows = await prisma.branchSale.findMany({
    where: {
      branchId: applyBranchScope(context, query.branchId),
      deletedAt: null,
      organizationId: context.organizationId,
      saleDate: getDateRange(query.startDate, query.endDate)
    },
    include: {
      branch: true,
      items: {
        include: {
          item: true
        }
      }
    }
  });

  const data: Array<Record<string, unknown>> = [];
  const byBranch = new Map<string, number>();
  const byPayment = new Map<string, number>();

  rows.forEach((sale) => {
    byBranch.set(sale.branch.name, (byBranch.get(sale.branch.name) ?? 0) + decimalToNumber(sale.totalAmount));
    byPayment.set(sale.paymentMethod, (byPayment.get(sale.paymentMethod) ?? 0) + decimalToNumber(sale.totalAmount));

    sale.items.forEach((item) => {
      if (query.productId && item.itemId !== query.productId) {
        return;
      }

      data.push({
        saleNumber: sale.saleNumber,
        date: sale.saleDate.toISOString().slice(0, 10),
        branch: sale.branch.name,
        product: item.item.name,
        quantity: decimalToNumber(item.quantity),
        paymentMethod: sale.paymentMethod,
        total: decimalToNumber(item.totalPrice)
      });
    });
  });

  const chart = Array.from(byBranch.entries()).map(([branch, total]) => ({
    branch,
    total
  }));

  return {
    chart,
    data,
    summary: {
      totalSales: data.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
      paymentBreakdown: Object.fromEntries(byPayment)
    }
  };
}

async function getInventoryValuationReport(context: ReportsContext, query: ReportQuery) {
  const balances = await prisma.stockBalance.findMany({
    where: {
      organizationId: context.organizationId,
      warehouseId: query.warehouseId,
      warehouse: {
        branchId: applyBranchScope(context, query.branchId)
      }
    },
    include: {
      item: true,
      warehouse: true
    },
    orderBy: {
      item: {
        name: 'asc'
      }
    }
  });

  const data = balances.map((row) => ({
    item: row.item.name,
    warehouse: row.warehouse.name,
    qty: decimalToNumber(row.quantityOnHand),
    unitCost: decimalToNumber(row.item.unitCost),
    totalValue: decimalToNumber((row.item.unitCost ?? new Decimal(0)).mul(row.quantityOnHand))
  }));

  return {
    chart: data.slice(0, 25).map((row) => ({
      item: row.item,
      value: row.totalValue
    })),
    data,
    summary: {
      totalWarehouseValue: data.reduce((sum, row) => sum + row.totalValue, 0)
    }
  };
}

async function getLowStockReport(context: ReportsContext) {
  const rows = await prisma.stockBalance.findMany({
    where: {
      organizationId: context.organizationId,
      warehouse: {
        branchId: applyBranchScope(context)
      }
    },
    include: {
      item: true,
      warehouse: true
    }
  });

  const data = rows
    .filter(
      (row) =>
        row.item.reorderLevel !== null && row.item.reorderLevel.greaterThanOrEqualTo(row.quantityAvailable),
    )
    .map((row) => ({
      item: row.item.name,
      warehouse: row.warehouse.name,
      reorderLevel: decimalToNumber(row.item.reorderLevel),
      available: decimalToNumber(row.quantityAvailable),
      deficit:
        decimalToNumber(row.item.reorderLevel) - decimalToNumber(row.quantityAvailable)
    }))
    .sort((a, b) => b.deficit - a.deficit);

  return {
    chart: data.slice(0, 20).map((row) => ({
      item: row.item,
      deficit: row.deficit
    })),
    data,
    summary: {
      criticalCount: data.length
    }
  };
}

async function getExpiryAlertReport(context: ReportsContext, query: ReportQuery) {
  const daysAhead = query.daysAhead ?? 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(today.getDate() + daysAhead);

  const rows = await prisma.inventoryBatch.findMany({
    where: {
      expiryDate: {
        gte: today,
        lte: end
      },
      organizationId: context.organizationId,
      quantityRemaining: {
        gt: new Decimal(0)
      },
      warehouse: {
        branchId: applyBranchScope(context, query.branchId)
      }
    },
    include: {
      item: true,
      warehouse: true
    },
    orderBy: {
      expiryDate: 'asc'
    }
  });

  const data = rows.map((row) => ({
    batchNumber: row.batchNumber,
    item: row.item.name,
    expiryDate: row.expiryDate?.toISOString().slice(0, 10),
    qty: decimalToNumber(row.quantityRemaining),
    location: row.warehouse.name
  }));

  return {
    chart: data.map((row) => ({
      batch: row.batchNumber,
      qty: row.qty
    })),
    data,
    summary: {
      expiringBatches: data.length
    }
  };
}

async function getSupplierPurchaseReport(context: ReportsContext, query: ReportQuery) {
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      deletedAt: null,
      orderDate: getDateRange(query.startDate, query.endDate),
      organizationId: context.organizationId,
      supplierId: query.supplierId
    },
    include: {
      supplier: true,
      goodsReceivedNotes: true
    }
  });

  const grouped = new Map<
    string,
    {
      grns: number;
      pos: number;
      spend: number;
      supplier: string;
    }
  >();

  orders.forEach((order) => {
    const key = order.supplierId;
    const current = grouped.get(key) ?? {
      grns: 0,
      pos: 0,
      spend: 0,
      supplier: order.supplier.name
    };
    current.pos += 1;
    current.grns += order.goodsReceivedNotes.length;
    current.spend += decimalToNumber(order.total);
    grouped.set(key, current);
  });

  const data = Array.from(grouped.values()).map((row) => ({
    supplier: row.supplier,
    pos: row.pos,
    grns: row.grns,
    totalSpend: row.spend
  }));

  return {
    chart: data.map((row) => ({
      spend: row.totalSpend,
      supplier: row.supplier
    })),
    data,
    summary: {
      totalSpend: data.reduce((sum, row) => sum + row.totalSpend, 0)
    }
  };
}

async function getWorkerProductivityReport(context: ReportsContext, query: ReportQuery) {
  const assignments = await prisma.productionWorkerAssignment.findMany({
    where: {
      employeeId: query.employeeId,
      batch: {
        deletedAt: null,
        organizationId: context.organizationId,
        productionDate: getDateRange(query.startDate, query.endDate),
        warehouse: {
          branchId: applyBranchScope(context, query.branchId)
        }
      }
    },
    include: {
      batch: true,
      employee: true
    }
  });

  const grouped = new Map<
    string,
    {
      batches: number;
      employee: string;
      output: number;
    }
  >();

  assignments.forEach((assignment) => {
    const key = assignment.employeeId;
    const current = grouped.get(key) ?? {
      batches: 0,
      employee: `${assignment.employee.firstName} ${assignment.employee.lastName}`.trim(),
      output: 0
    };
    current.batches += 1;
    current.output += decimalToNumber(assignment.batch.actualOutput);
    grouped.set(key, current);
  });

  const data = Array.from(grouped.values()).map((row) => ({
    employee: row.employee,
    batches: row.batches,
    output: row.output,
    productivityScore: row.batches === 0 ? 0 : row.output / row.batches
  }));

  return {
    chart: data.map((row) => ({
      employee: row.employee,
      score: row.productivityScore
    })),
    data,
    summary: {
      activeWorkers: data.length
    }
  };
}

async function getBranchShiftCloseSummary(context: ReportsContext, query: ReportQuery) {
  const rows = await prisma.branchShiftClose.findMany({
    where: {
      branchId: applyBranchScope(context, query.branchId),
      deletedAt: null,
      organizationId: context.organizationId,
      shiftDate: getDateRange(query.startDate, query.endDate)
    },
    include: {
      branch: true
    },
    orderBy: {
      shiftDate: 'desc'
    }
  });

  const data = rows.map((row) => ({
    branch: row.branch.name,
    shiftDate: row.shiftDate.toISOString().slice(0, 10),
    shiftType: row.shiftType,
    status: row.status,
    expectedCash: decimalToNumber(row.expectedCash),
    actualCash: decimalToNumber(row.actualCash),
    cashVariance: decimalToNumber(row.cashVariance),
    stockVariance: decimalToNumber(row.stockVariance)
  }));

  return {
    chart: data.map((row) => ({
      branch: row.branch,
      cashVariance: row.cashVariance
    })),
    data,
    summary: {
      totalShiftCloses: data.length,
      totalCashVariance: data.reduce((sum, row) => sum + row.cashVariance, 0)
    }
  };
}

function buildMockReport(reportType: ReportType) {
  return {
    chart: [],
    data: [],
    summary: {
      message: `Database is not configured. Returning empty data for ${reportType}.`
    }
  };
}

function buildMockDashboardData(context: ReportsContext) {
  const roleBucket = resolveDashboardRoleBucket(getRoleNames(context));

  if (roleBucket === 'production_manager') {
    return {
      role: 'production_manager',
      stats: {
        batches: 0,
        totalOutput: 0,
        avgEfficiency: 0,
        totalWastage: 0
      },
      charts: {
        efficiencyGauge: {
          avgEfficiency: 0
        },
        wastageTrend: []
      },
      rawMaterialAvailability: [],
      activeWorkersCount: 0
    };
  }

  if (roleBucket === 'branch_manager') {
    return {
      role: 'branch_manager',
      stats: {
        totalSales: 0,
        paymentBreakdown: {}
      },
      charts: {
        paymentBreakdown: {},
        salesByBranch: []
      },
      shiftCloseStatus: null
    };
  }

  if (roleBucket === 'operations_specialist') {
    const focus = resolveOperationsFocus(getRoleNames(context));
    const reportTypeByFocus: Record<string, ReportType> = {
      audit: ReportTypeCode.BRANCH_SHIFT_CLOSE_SUMMARY,
      finance: ReportTypeCode.BRANCH_SALES,
      general: ReportTypeCode.LOW_STOCK,
      inventory: ReportTypeCode.LOW_STOCK,
      procurement: ReportTypeCode.SUPPLIER_PURCHASE
    };

    const summaryByFocus: Record<string, Record<string, number | string>> = {
      audit: {
        reviewedItems: 0,
        flaggedItems: 0,
        complianceScore: 0,
        dataMode: 'local'
      },
      finance: {
        dailySales: 0,
        totalTransactions: 0,
        outstandingVariance: 0,
        dataMode: 'local'
      },
      general: {
        trackedItems: 0,
        pendingActions: 0,
        alerts: 0,
        dataMode: 'local'
      },
      inventory: {
        criticalItems: 0,
        nearExpiryBatches: 0,
        warehousesTracked: 0,
        dataMode: 'local'
      },
      procurement: {
        activeSuppliers: 0,
        openPurchaseOrders: 0,
        monthlySpend: 0,
        dataMode: 'local'
      }
    };

    return {
      role: 'operations_specialist',
      focus,
      reportType: reportTypeByFocus[focus] ?? ReportTypeCode.LOW_STOCK,
      summary: summaryByFocus[focus] ?? summaryByFocus.general,
      chart: [],
      dataPreview: []
    };
  }

  return {
    role: 'system_admin',
    stats: {
      production: {
        batches: 0,
        totalOutput: 0,
        avgEfficiency: 0,
        totalWastage: 0
      },
      sales: {
        totalSales: 0,
        totalTransactions: 0
      }
    },
    charts: {
      productionLast7Days: [],
      salesLast7Days: []
    },
    lowStockTop5: [],
    openProductionBatches: [],
    recentAuditLogs: []
  };
}

export class ReportsService {
  static async generateReport(context: ReportsContext, query: ReportQuery) {
    ensureReportAccess(context, query.reportType);

    if (!isDatabaseConfigured) {
      return buildMockReport(query.reportType);
    }

    switch (query.reportType) {
      case ReportTypeCode.DAILY_PRODUCTION:
        return getDailyProductionReport(context, query);
      case ReportTypeCode.WASTAGE:
        return getWastageReport(context, query);
      case ReportTypeCode.RAW_MATERIAL_USAGE:
        return getRawMaterialUsageReport(context, query);
      case ReportTypeCode.BRANCH_SALES:
        return getBranchSalesReport(context, query);
      case ReportTypeCode.INVENTORY_VALUATION:
        return getInventoryValuationReport(context, query);
      case ReportTypeCode.LOW_STOCK:
        return getLowStockReport(context);
      case ReportTypeCode.EXPIRY_ALERT:
        return getExpiryAlertReport(context, query);
      case ReportTypeCode.SUPPLIER_PURCHASE:
        return getSupplierPurchaseReport(context, query);
      case ReportTypeCode.WORKER_PRODUCTIVITY:
        return getWorkerProductivityReport(context, query);
      case ReportTypeCode.BRANCH_SHIFT_CLOSE_SUMMARY:
        return getBranchShiftCloseSummary(context, query);
      default:
        throw new Error('Unsupported report type.');
    }
  }

  static async exportCsv(context: ReportsContext, query: ReportQuery) {
    const report = await this.generateReport(context, query);
    const csv = toCsv(report.data as Array<Record<string, unknown>>);

    return {
      content: csv,
      fileName: `${query.reportType}-${Date.now()}.csv`,
      mimeType: 'text/csv'
    };
  }

  static async exportPdf(context: ReportsContext, query: ReportQuery) {
    const report = await this.generateReport(context, query);
    const rows = report.data as Array<Record<string, unknown>>;
    const summary = report.summary as Record<string, unknown>;
    const buffer = await toPdfBuffer(query.reportType, summary, rows);

    if (!isDatabaseConfigured) {
      return {
        content: buffer,
        document: null,
        fileName: `${query.reportType}-${Date.now()}.pdf`,
        mimeType: 'application/pdf'
      };
    }

    const fileName = `${query.reportType}-${Date.now()}.pdf`;
    const document = await prisma.documentFile.create({
      data: {
        fileName,
        fileSize: buffer.byteLength,
        fileType: 'application/pdf',
        fileUrl: `memory://reports/${fileName}`,
        organizationId: context.organizationId,
        referenceId: context.userProfileId,
        referenceType: 'report',
        uploadedBy: context.userProfileId
      }
    });

    return {
      content: buffer,
      document,
      fileName,
      mimeType: 'application/pdf'
    };
  }

  static async getDashboardData(context: ReportsContext) {
    if (!isDatabaseConfigured) {
      return buildMockDashboardData(context);
    }

    const roleNames = getRoleNames(context);
    const roleBucket = resolveDashboardRoleBucket(roleNames);

    if (roleBucket === 'system_admin') {
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 6);
      const startDate = sevenDaysAgo.toISOString().slice(0, 10);
      const endDate = today.toISOString().slice(0, 10);
      const production = await this.generateReport(context, {
        reportType: ReportTypeCode.DAILY_PRODUCTION,
        startDate,
        endDate
      });
      const salesRows = await prisma.branchSale.findMany({
        where: {
          deletedAt: null,
          organizationId: context.organizationId,
          saleDate: getDateRange(startDate, endDate)
        },
        select: {
          saleDate: true,
          totalAmount: true
        },
        orderBy: {
          saleDate: 'asc'
        }
      });
      const lowStock = await this.generateReport(context, {
        reportType: ReportTypeCode.LOW_STOCK
      });
      const recentAudit = await prisma.auditLog.findMany({
        where: {
          organizationId: context.organizationId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      });
      const openBatches = await prisma.productionBatch.findMany({
        where: {
          deletedAt: null,
          organizationId: context.organizationId,
          status: {
            in: ['PLANNED', 'MATERIALS_RESERVED', 'IN_PROGRESS', 'QUALITY_CHECK']
          }
        },
        take: 5,
        orderBy: {
          productionDate: 'desc'
        }
      });
      const salesByDay = Array.from(
        salesRows.reduce((map, row) => {
          const day = row.saleDate.toISOString().slice(0, 10);
          map.set(day, (map.get(day) ?? 0) + decimalToNumber(row.totalAmount));

          return map;
        }, new Map<string, number>()),
      ).map(([day, total]) => ({
        day,
        total
      }));
      const totalSales = salesByDay.reduce((sum, row) => sum + row.total, 0);

      return {
        role: 'system_admin',
        stats: {
          production: production.summary,
          sales: {
            totalSales,
            totalTransactions: salesRows.length
          }
        },
        charts: {
          productionLast7Days: production.chart,
          salesLast7Days: salesByDay
        },
        lowStockTop5: (lowStock.data as Array<Record<string, unknown>>).slice(0, 5),
        openProductionBatches: openBatches,
        recentAuditLogs: recentAudit
      };
    }

    if (roleBucket === 'production_manager') {
      const todayDate = new Date();
      const today = todayDate.toISOString().slice(0, 10);
      const sevenDaysAgo = new Date(todayDate);
      sevenDaysAgo.setDate(todayDate.getDate() - 6);
      const production = await this.generateReport(context, {
        reportType: ReportTypeCode.DAILY_PRODUCTION,
        startDate: today,
        endDate: today
      });
      const wastageRows = await prisma.productionBatch.findMany({
        where: {
          deletedAt: null,
          organizationId: context.organizationId,
          productionDate: getDateRange(sevenDaysAgo.toISOString().slice(0, 10), today),
          warehouse: context.isBranchScoped && context.branchId ? { branchId: context.branchId } : undefined
        },
        select: {
          productionDate: true,
          wastageQuantity: true
        },
        orderBy: {
          productionDate: 'asc'
        }
      });
      const wastageTrend = Array.from(
        wastageRows.reduce((map, row) => {
          const day = row.productionDate.toISOString().slice(0, 10);
          map.set(day, (map.get(day) ?? 0) + decimalToNumber(row.wastageQuantity));

          return map;
        }, new Map<string, number>()),
      ).map(([day, wastage]) => ({
        day,
        wastage
      }));
      const rawMaterialAvailability = await prisma.stockBalance.findMany({
        where: {
          organizationId: context.organizationId,
          warehouse: context.isBranchScoped && context.branchId ? { branchId: context.branchId } : undefined,
          item: {
            itemType: 'RAW_MATERIAL'
          }
        },
        include: {
          item: true,
          warehouse: true
        },
        orderBy: {
          quantityAvailable: 'asc'
        },
        take: 10
      });
      const activeWorkers = await prisma.productionWorkerAssignment.findMany({
        where: {
          batch: {
            deletedAt: null,
            organizationId: context.organizationId,
            productionDate: {
              gte: toDate(today),
              lte: toDate(today)
            },
            warehouse: context.isBranchScoped && context.branchId ? { branchId: context.branchId } : undefined
          }
        },
        select: {
          employeeId: true
        }
      });
      const activeWorkersCount = new Set(activeWorkers.map((row) => row.employeeId)).size;

      return {
        role: 'production_manager',
        stats: production.summary,
        charts: {
          efficiencyGauge: production.summary,
          wastageTrend
        },
        rawMaterialAvailability: rawMaterialAvailability.map((row) => ({
          item: row.item.name,
          quantityAvailable: decimalToNumber(row.quantityAvailable),
          quantityOnHand: decimalToNumber(row.quantityOnHand),
          reorderLevel: decimalToNumber(row.item.reorderLevel),
          warehouse: row.warehouse.name
        })),
        activeWorkersCount
      };
    }

    if (roleBucket === 'branch_manager') {
      const today = new Date().toISOString().slice(0, 10);
      const branchSales = await this.generateReport(context, {
        reportType: ReportTypeCode.BRANCH_SALES,
        startDate: today,
        endDate: today,
        branchId: context.branchId ?? undefined
      });
      const shiftClose = await this.generateReport(context, {
        reportType: ReportTypeCode.BRANCH_SHIFT_CLOSE_SUMMARY,
        startDate: today,
        endDate: today,
        branchId: context.branchId ?? undefined
      });

      return {
        role: 'branch_manager',
        stats: branchSales.summary,
        charts: {
          paymentBreakdown: (branchSales.summary as { paymentBreakdown?: Record<string, number> }).paymentBreakdown,
          salesByBranch: branchSales.chart
        },
        shiftCloseStatus: (shiftClose.data as Array<Record<string, unknown>>)[0] ?? null
      };
    }

    const focus = resolveOperationsFocus(roleNames);
    const allowedReportTypes = getAllowedReportTypesForRoles(roleNames);

    if (!allowedReportTypes.length) {
      return {
        role: 'operations_specialist',
        focus,
        reportType: null,
        summary: {
          message: 'No report types are enabled for this role.'
        },
        chart: [],
        dataPreview: []
      };
    }

    const defaultReportByFocus: Record<string, ReportType> = {
      audit: ReportTypeCode.BRANCH_SHIFT_CLOSE_SUMMARY,
      finance: ReportTypeCode.BRANCH_SALES,
      general: ReportTypeCode.LOW_STOCK,
      inventory: ReportTypeCode.LOW_STOCK,
      procurement: ReportTypeCode.SUPPLIER_PURCHASE
    };

    const preferred = defaultReportByFocus[focus] ?? ReportTypeCode.LOW_STOCK;
    const selectedReportType = (allowedReportTypes.includes(preferred)
      ? preferred
      : allowedReportTypes[0]) as ReportType;

    const todayDate = new Date();
    const endDate = todayDate.toISOString().slice(0, 10);
    const startDate = new Date(todayDate.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const query: ReportQuery =
      selectedReportType === ReportTypeCode.LOW_STOCK
        ? { reportType: selectedReportType }
        : selectedReportType === ReportTypeCode.EXPIRY_ALERT
          ? { daysAhead: 30, reportType: selectedReportType }
          : {
              reportType: selectedReportType,
              startDate,
              endDate,
              branchId: context.branchId ?? undefined
            };

    const report = await this.generateReport(context, query);

    return {
      role: 'operations_specialist',
      focus,
      reportType: selectedReportType,
      summary: report.summary,
      chart: (report.chart as Array<Record<string, unknown>>).slice(0, 12),
      dataPreview: (report.data as Array<Record<string, unknown>>).slice(0, 12)
    };
  }
}
