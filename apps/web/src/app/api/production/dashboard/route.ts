import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

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

    const { data: batches, error: batchError } = await batchQuery;
    if (batchError) throw batchError;

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

    const { data: openBatches } = await openBatchQuery;

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

    const { data: stockBalances } = await stockQuery;

    // Aggregate from batches
    const statusMap = new Map<string, number>();
    const outputMap = new Map<string, number>();
    let completedToday = 0;
    let efficiencySum = 0;
    let wastageSum = 0;

    for (const batch of batches ?? []) {
      statusMap.set(batch.status, (statusMap.get(batch.status) ?? 0) + 1);
      const day = batch.production_date.slice(0, 10);
      outputMap.set(day, (outputMap.get(day) ?? 0) + Number(batch.actual_output ?? 0));
      efficiencySum += Number(batch.efficiency_percentage ?? 0);
      wastageSum += Number(batch.wastage_quantity ?? 0);
      if (batch.status === 'COMPLETED' && day === todayKey) {
        completedToday += 1;
      }
    }

    const total = batches?.length ?? 0;
    const materialsAtRisk = (stockBalances ?? [])
      .filter((row: { quantity_available: number; items: { reorder_level: number } }) =>
        row.items && row.quantity_available <= row.items.reorder_level
      )
      .map((row: { items: { name: string; reorder_level: number }; warehouses: { name: string }; quantity_available: number }) => ({
        item: row.items.name,
        warehouse: row.warehouses.name,
        available: Number(row.quantity_available),
        reorderLevel: Number(row.items.reorder_level),
        deficit: Math.max(0, Number(row.items.reorder_level) - Number(row.quantity_available)),
      }))
      .sort((a: { deficit: number }, b: { deficit: number }) => b.deficit - a.deficit)
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
      openBatches: (openBatches ?? []).map((b: { batch_number: string; actual_output: number; production_date: string; production_line: string; shift: string; status: string }) => ({
        batchNumber: b.batch_number,
        output: Number(b.actual_output ?? 0),
        productionDate: b.production_date.slice(0, 10),
        productionLine: b.production_line,
        shift: b.shift,
        status: b.status,
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
