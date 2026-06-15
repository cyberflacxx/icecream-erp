import { NextRequest, NextResponse } from 'next/server';

import { getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { resolveDashboardPersona } from '@/lib/dashboard-access';
import { createServiceRoleClient } from '@/lib/supabase/server';

function isMissingColumnError(error: unknown, table: string, columnName: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';
  return message.includes(`column ${table}.${columnName} does not exist`);
}

type QueryResultRow = Record<string, unknown>;
type QueryResult = { data: QueryResultRow[] | null; error: { message: string } | null };

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const service = createServiceRoleClient();

  try {
    const persona = resolveDashboardPersona({
      permissions: ctx.permissions,
      role: ctx.role,
      roleNames: ctx.roles.map((role) => role.name),
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const startDate = sevenDaysAgo.toISOString().slice(0, 10);
    const endDate = today.toISOString().slice(0, 10);

    // Branch scoping
    const branchFilter = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : null;

    // Sales last 7 days
    let salesQuery = service
      .schema('icecream_erp')
      .from('branch_sales')
      .select('sale_date, total_amount, branch_id')
      .is('deleted_at', null)
      .gte('sale_date', `${startDate}T00:00:00.000Z`)
      .lte('sale_date', `${endDate}T23:59:59.999Z`);
    if (branchFilter) salesQuery = salesQuery.eq('branch_id', branchFilter);
    let salesResult = await salesQuery;
    if (salesResult.error && isMissingColumnError(salesResult.error, 'branch_sales', 'deleted_at')) {
      let fallbackQuery = service
        .schema('icecream_erp')
        .from('branch_sales')
        .select('sale_date, total_amount, branch_id')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate);
      if (branchFilter) fallbackQuery = fallbackQuery.eq('branch_id', branchFilter);
      salesResult = await fallbackQuery;
    }
    const salesRows = salesResult.data ?? [];

    const salesByDay = new Map<string, number>();
    let totalSales = 0;
    for (const s of salesRows ?? []) {
      const day = s.sale_date.slice(0, 10);
      const amt = Number(s.total_amount ?? 0);
      salesByDay.set(day, (salesByDay.get(day) ?? 0) + amt);
      totalSales += amt;
    }

    // Production batches last 7 days
    let batchQuery = service
      .schema('icecream_erp')
      .from('production_batches')
      .select('production_date, status, actual_output, efficiency_percentage, wastage_quantity, warehouse_id')
      .is('deleted_at', null)
      .gte('production_date', `${startDate}T00:00:00.000Z`)
      .lte('production_date', `${endDate}T23:59:59.999Z`);

    if (branchFilter) {
      const { data: whs } = await service.schema('icecream_erp').from('warehouses').select('id').eq('branch_id', branchFilter);
      const whIds = (whs ?? []).map((w: { id: string }) => w.id);
      if (whIds.length > 0) batchQuery = batchQuery.in('warehouse_id', whIds);
    }

    let batchResult: QueryResult = await batchQuery;
    if (
      batchResult.error &&
      (
        isMissingColumnError(batchResult.error, 'production_batches', 'production_date') ||
        isMissingColumnError(batchResult.error, 'production_batches', 'actual_output') ||
        isMissingColumnError(batchResult.error, 'production_batches', 'efficiency_percentage') ||
        isMissingColumnError(batchResult.error, 'production_batches', 'wastage_quantity') ||
        isMissingColumnError(batchResult.error, 'production_batches', 'deleted_at')
      )
    ) {
      let fallbackQuery = service
        .schema('icecream_erp')
        .from('production_batches')
        .select('planned_date, status, actual_qty, yield_percent, wastage_qty, warehouse_id')
        .gte('planned_date', startDate)
        .lte('planned_date', endDate);
      if (branchFilter) {
        const { data: whs } = await service.schema('icecream_erp').from('warehouses').select('id').eq('branch_id', branchFilter);
        const whIds = (whs ?? []).map((w: { id: string }) => w.id);
        if (whIds.length > 0) fallbackQuery = fallbackQuery.in('warehouse_id', whIds);
      }
      batchResult = await fallbackQuery;
    }
    const batches = batchResult.data ?? [];
    const productionByDay = new Map<string, number>();
    let totalOutput = 0;
    let efficiencySum = 0;
    let wastageSum = 0;
    let completedBatches = 0;
    for (const b of batches ?? []) {
      const day = String((b as Record<string, unknown>).production_date ?? (b as Record<string, unknown>).planned_date ?? '').slice(0, 10);
      const out = Number((b as Record<string, unknown>).actual_output ?? (b as Record<string, unknown>).actual_qty ?? 0);
      productionByDay.set(day, (productionByDay.get(day) ?? 0) + out);
      totalOutput += out;
      efficiencySum += Number((b as Record<string, unknown>).efficiency_percentage ?? (b as Record<string, unknown>).yield_percent ?? 0);
      wastageSum += Number((b as Record<string, unknown>).wastage_quantity ?? (b as Record<string, unknown>).wastage_qty ?? 0);
      if (b.status === 'COMPLETED') completedBatches++;
    }
    const batchCount = batches.length;

    // Open production batches
    let openBatchQuery = service
      .schema('icecream_erp')
      .from('production_batches')
      .select('id, batch_number, status, production_date, planned_quantity, actual_output')
      .is('deleted_at', null)
      .in('status', ['PLANNED', 'MATERIALS_RESERVED', 'IN_PROGRESS', 'QUALITY_CHECK'])
      .order('production_date', { ascending: false })
      .limit(5);

    if (branchFilter) {
      const { data: whs } = await service.schema('icecream_erp').from('warehouses').select('id').eq('branch_id', branchFilter);
      const whIds = (whs ?? []).map((w: { id: string }) => w.id);
      if (whIds.length > 0) openBatchQuery = openBatchQuery.in('warehouse_id', whIds);
    }

    let openBatchResult: QueryResult = await openBatchQuery;
    if (
      openBatchResult.error &&
      (
        isMissingColumnError(openBatchResult.error, 'production_batches', 'production_date') ||
        isMissingColumnError(openBatchResult.error, 'production_batches', 'planned_quantity') ||
        isMissingColumnError(openBatchResult.error, 'production_batches', 'actual_output') ||
        isMissingColumnError(openBatchResult.error, 'production_batches', 'deleted_at')
      )
    ) {
      let fallbackQuery = service
        .schema('icecream_erp')
        .from('production_batches')
        .select('id, batch_number, status, planned_date, planned_qty, actual_qty, shift, warehouse_id')
        .in('status', ['PLANNED', 'IN_PROGRESS', 'QUALITY_CHECK'])
        .order('planned_date', { ascending: false })
        .limit(5);
      if (branchFilter) {
        const { data: whs } = await service.schema('icecream_erp').from('warehouses').select('id').eq('branch_id', branchFilter);
        const whIds = (whs ?? []).map((w: { id: string }) => w.id);
        if (whIds.length > 0) fallbackQuery = fallbackQuery.in('warehouse_id', whIds);
      }
      openBatchResult = await fallbackQuery;
    }
    const openBatches = openBatchResult.data ?? [];

    // Low stock items
    let lowStockResult: QueryResult = await service
      .schema('icecream_erp')
      .from('stock_balances')
      .select('quantity_available, items!inner(name, reorder_level)')
      .not('items.reorder_level', 'is', null)
      .limit(5);
    if (lowStockResult.error && isMissingColumnError(lowStockResult.error, 'stock_balances', 'quantity_available')) {
      lowStockResult = await service
        .schema('icecream_erp')
        .from('stock_balances')
        .select('quantity, items!inner(name, reorder_level)')
        .not('items.reorder_level', 'is', null)
        .limit(5);
    }
    const lowStock = lowStockResult.data ?? [];

    const lowStockTop5 = (lowStock ?? [])
      .map((row: Record<string, unknown>) => {
        const items = row.items as { name?: string; reorder_level?: number } | Array<{ name?: string; reorder_level?: number }> | null;
        const item = Array.isArray(items) ? items[0] : items;
        return {
          name: String(item?.name ?? ''),
          currentStock: Number(row.quantity_available ?? row.quantity ?? 0),
          reorderPoint: Number(item?.reorder_level ?? 0),
        };
      })
      .filter((row) => row.currentStock <= row.reorderPoint)
      .slice(0, 5);

    // Recent audit logs
    const { data: recentAudit } = await service
      .schema('icecream_erp')
      .from('audit_logs')
      .select('id, action, entity_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      persona,
      role: persona,
      stats: {
        production: {
          batches: batchCount,
          completedBatches,
          totalOutput,
          avgEfficiency: batchCount > 0 ? efficiencySum / batchCount : 0,
          totalWastage: wastageSum,
        },
        sales: {
          totalSales,
          totalTransactions: salesRows?.length ?? 0,
        },
      },
      charts: {
        productionLast7Days: Array.from(productionByDay.entries()).map(([day, total]) => ({ day, total })),
        salesLast7Days: Array.from(salesByDay.entries()).map(([day, total]) => ({ day, total })),
      },
      lowStockTop5,
      openProductionBatches: (openBatches ?? []).map((b: Record<string, unknown>) => ({
        id: b.id,
        batchNumber: b.batch_number,
        status: b.status,
        productionDate: b.production_date ?? b.planned_date,
        plannedQuantity: Number(b.planned_quantity ?? b.planned_qty ?? 0),
        actualQuantity: b.actual_output !== null && b.actual_output !== undefined ? Number(b.actual_output) : (b.actual_qty !== null && b.actual_qty !== undefined ? Number(b.actual_qty) : null),
        shift: b.shift ?? null,
      })),
      recentAuditLogs: (recentAudit ?? []).map((log: Record<string, unknown>) => ({
        id: log.id,
        action: log.action,
        entityType: log.entity_type,
        createdAt: log.created_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
