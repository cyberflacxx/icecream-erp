import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { firstRelation } from '@/lib/supabase-relations';
import { createServiceRoleClient } from '@/lib/supabase/server';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

function isMissingColumn(error: unknown, table: string, column: string) {
  return getErrorMessage(error).toLowerCase().includes(`column ${table.toLowerCase()}.${column.toLowerCase()} does not exist`);
}

type QueryRows = {
  data: Array<Record<string, unknown>> | null;
  error: unknown;
};

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  const branchId = searchParams.get('branchId') ?? undefined;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const resolvedStart = startDate ?? sevenDaysAgo.toISOString().slice(0, 10);
    const resolvedEnd = endDate ?? today.toISOString().slice(0, 10);
    const todayKey = today.toISOString().slice(0, 10);

    // Resolve branch scope
    const effectiveBranchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : (branchId ?? null);

    // Get warehouses for branch scope
    let warehouseIds: string[] | null = null;
    if (effectiveBranchId) {
      const { data: warehouses } = await service
        .schema('icecream_erp')
        .from('warehouses')
        .select('id')
        .eq('branch_id', effectiveBranchId);
      warehouseIds = (warehouses ?? []).map((w: { id: string }) => w.id);
    }

    // Query production batches in date range
    let batchQuery = service
      .schema('icecream_erp')
      .from('production_batches')
      .select('id, batch_number, status, quality_status, production_date, production_line, shift, actual_output, efficiency_percentage, wastage_quantity, planned_quantity, warehouse_id')
      .is('deleted_at', null)
      .gte('production_date', `${resolvedStart}T00:00:00.000Z`)
      .lte('production_date', `${resolvedEnd}T23:59:59.999Z`)
      .order('production_date', { ascending: true });

    if (warehouseIds && warehouseIds.length > 0) {
      batchQuery = batchQuery.in('warehouse_id', warehouseIds);
    }

    let batchResult = await batchQuery as QueryRows;
    if (
      batchResult.error &&
      (
        isMissingColumn(batchResult.error, 'production_batches', 'quality_status') ||
        isMissingColumn(batchResult.error, 'production_batches', 'deleted_at') ||
        isMissingColumn(batchResult.error, 'production_batches', 'production_date') ||
        isMissingColumn(batchResult.error, 'production_batches', 'production_line') ||
        isMissingColumn(batchResult.error, 'production_batches', 'actual_output') ||
        isMissingColumn(batchResult.error, 'production_batches', 'efficiency_percentage') ||
        isMissingColumn(batchResult.error, 'production_batches', 'wastage_quantity') ||
        isMissingColumn(batchResult.error, 'production_batches', 'planned_quantity')
      )
    ) {
      let fallbackQuery = service
        .schema('icecream_erp')
        .from('production_batches')
        .select('id, batch_number, status, planned_date, shift, actual_qty, yield_percent, wastage_qty, planned_qty, warehouse_id')
        .gte('planned_date', resolvedStart)
        .lte('planned_date', resolvedEnd)
        .order('planned_date', { ascending: true });

      if (warehouseIds && warehouseIds.length > 0) {
        fallbackQuery = fallbackQuery.in('warehouse_id', warehouseIds);
      }

      batchResult = await fallbackQuery as QueryRows;
    }
    if (batchResult.error) throw batchResult.error;
    const batches = batchResult.data ?? [];

    // Open batches
    let openBatchQuery = service
      .schema('icecream_erp')
      .from('production_batches')
      .select('id, batch_number, status, production_date, production_line, shift, actual_output, warehouse_id')
      .is('deleted_at', null)
      .in('status', ['PLANNED', 'MATERIALS_RESERVED', 'IN_PROGRESS', 'QUALITY_CHECK'])
      .order('production_date', { ascending: false })
      .limit(8);

    if (warehouseIds && warehouseIds.length > 0) {
      openBatchQuery = openBatchQuery.in('warehouse_id', warehouseIds);
    }

    let openBatchResult = await openBatchQuery as QueryRows;
    if (
      openBatchResult.error &&
      (
        isMissingColumn(openBatchResult.error, 'production_batches', 'deleted_at') ||
        isMissingColumn(openBatchResult.error, 'production_batches', 'production_date') ||
        isMissingColumn(openBatchResult.error, 'production_batches', 'production_line') ||
        isMissingColumn(openBatchResult.error, 'production_batches', 'actual_output')
      )
    ) {
      let fallbackOpenBatchQuery = service
        .schema('icecream_erp')
        .from('production_batches')
        .select('id, batch_number, status, planned_date, shift, actual_qty, warehouse_id')
        .in('status', ['PLANNED', 'IN_PROGRESS', 'QUALITY_CHECK'])
        .order('planned_date', { ascending: false })
        .limit(8);

      if (warehouseIds && warehouseIds.length > 0) {
        fallbackOpenBatchQuery = fallbackOpenBatchQuery.in('warehouse_id', warehouseIds);
      }

      openBatchResult = await fallbackOpenBatchQuery as QueryRows;
    }
    if (openBatchResult.error) throw openBatchResult.error;
    const openBatches = openBatchResult.data ?? [];

    // Quality check counts
    const { count: qualityFailed } = await service
      .schema('icecream_erp')
      .from('quality_checks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'FAILED');

    const { count: qualityPending } = await service
      .schema('icecream_erp')
      .from('quality_checks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    // Materials at risk
    let stockQuery = service
      .schema('icecream_erp')
      .from('stock_balances')
      .select('id, quantity_available, quantity_on_hand, item_id, warehouse_id, items!inner(id, name, reorder_level), warehouses!inner(id, name)')
      .not('items.reorder_level', 'is', null);

    if (warehouseIds && warehouseIds.length > 0) {
      stockQuery = stockQuery.in('warehouse_id', warehouseIds);
    }

    let stockResult = await stockQuery as QueryRows;
    if (
      stockResult.error &&
      (
        isMissingColumn(stockResult.error, 'stock_balances', 'quantity_available') ||
        isMissingColumn(stockResult.error, 'stock_balances', 'quantity_on_hand')
      )
    ) {
      let fallbackStockQuery = service
        .schema('icecream_erp')
        .from('stock_balances')
        .select('id, quantity, item_id, warehouse_id, items!inner(id, name, reorder_level), warehouses!inner(id, name)')
        .not('items.reorder_level', 'is', null);

      if (warehouseIds && warehouseIds.length > 0) {
        fallbackStockQuery = fallbackStockQuery.in('warehouse_id', warehouseIds);
      }

      stockResult = await fallbackStockQuery as QueryRows;
    }
    if (stockResult.error) throw stockResult.error;
    const stockBalances = stockResult.data ?? [];

    // Aggregate from batches
    const statusMap = new Map<string, number>();
    const outputMap = new Map<string, number>();
    let completedToday = 0;
    let efficiencySum = 0;
    let wastageSum = 0;

    for (const batch of batches as Array<Record<string, unknown>>) {
      const status = String(batch.status ?? '');
      const day = String(batch.production_date ?? batch.planned_date ?? '').slice(0, 10);
      const output = Number(batch.actual_output ?? batch.actual_qty ?? 0);
      const efficiency = Number(batch.efficiency_percentage ?? batch.yield_percent ?? 0);
      const wastage = Number(batch.wastage_quantity ?? batch.wastage_qty ?? 0);

      statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
      outputMap.set(day, (outputMap.get(day) ?? 0) + output);
      efficiencySum += efficiency;
      wastageSum += wastage;
      if (status === 'COMPLETED' && day === todayKey) {
        completedToday += 1;
      }
    }

    const total = batches.length;
    const materialsAtRisk = stockBalances
      .filter((row) => {
        const item = firstRelation(row.items as { reorder_level: number } | Array<{ reorder_level: number }> | null);
        return item && Number(row.quantity_available ?? row.quantity ?? 0) <= Number(item.reorder_level);
      })
      .map((row) => {
        const item = firstRelation(row.items as { name: string; reorder_level: number } | Array<{ name: string; reorder_level: number }> | null);
        const warehouse = firstRelation(row.warehouses as { name: string } | Array<{ name: string }> | null);
        const available = Number(row.quantity_available ?? row.quantity ?? 0);
        const reorderLevel = Number(item?.reorder_level ?? 0);
        return {
          item: item?.name ?? 'Unknown',
          warehouse: warehouse?.name ?? 'Unknown',
          available,
          reorderLevel,
          deficit: Math.max(0, reorderLevel - available),
        };
      })
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 8);

    return NextResponse.json({
      stats: {
        plannedBatches: statusMap.get('PLANNED') ?? 0,
        inProgressBatches:
          (statusMap.get('MATERIALS_RESERVED') ?? 0) +
          (statusMap.get('IN_PROGRESS') ?? 0) +
          (statusMap.get('QUALITY_CHECK') ?? 0),
        completedToday,
        avgEfficiency: total > 0 ? efficiencySum / total : 0,
        totalWastage: wastageSum,
      },
      charts: {
        outputLast7Days: Array.from(outputMap.entries()).map(([day, output]) => ({ day, output })),
        statusBreakdown: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
      },
      openBatches: openBatches.map((b: Record<string, unknown>) => ({
        batchNumber: String(b.batch_number ?? ''),
        output: Number(b.actual_output ?? b.actual_qty ?? 0),
        productionDate: String(b.production_date ?? b.planned_date ?? '').slice(0, 10),
        productionLine: String(b.production_line ?? 'N/A'),
        shift: String(b.shift ?? ''),
        status: String(b.status ?? ''),
      })),
      materialsAtRisk,
      qualityAlerts: {
        failed: qualityFailed ?? 0,
        pending: qualityPending ?? 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
