import { NextRequest, NextResponse } from 'next/server';

import { getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const service = createServiceRoleClient();

  try {
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
    const { data: salesRows } = await salesQuery;

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

    const { data: batches } = await batchQuery;
    const productionByDay = new Map<string, number>();
    let totalOutput = 0;
    let efficiencySum = 0;
    let wastageSum = 0;
    let completedBatches = 0;
    for (const b of batches ?? []) {
      const day = b.production_date.slice(0, 10);
      const out = Number(b.actual_output ?? 0);
      productionByDay.set(day, (productionByDay.get(day) ?? 0) + out);
      totalOutput += out;
      efficiencySum += Number(b.efficiency_percentage ?? 0);
      wastageSum += Number(b.wastage_quantity ?? 0);
      if (b.status === 'COMPLETED') completedBatches++;
    }
    const batchCount = batches?.length ?? 0;

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

    const { data: openBatches } = await openBatchQuery;

    // Low stock items
    const { data: lowStock } = await service
      .schema('icecream_erp')
      .from('stock_balances')
      .select('quantity_available, items!inner(name, reorder_level)')
      .not('items.reorder_level', 'is', null)
      .limit(5);

    const lowStockTop5 = (lowStock ?? [])
      .map((row: Record<string, unknown>) => {
        const items = row.items as { name?: string; reorder_level?: number } | Array<{ name?: string; reorder_level?: number }> | null;
        const item = Array.isArray(items) ? items[0] : items;
        return {
          name: String(item?.name ?? ''),
          currentStock: Number(row.quantity_available ?? 0),
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
      role: ctx.role,
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
        productionDate: b.production_date,
        plannedQuantity: Number(b.planned_quantity ?? 0),
        actualQuantity: b.actual_output !== null ? Number(b.actual_output) : null,
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
