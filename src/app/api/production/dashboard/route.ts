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

function isInvalidBatchStatusEnum(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('invalid input value for enum batch_status');
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
      .select('id, batch_number, status, quality_status, production_date, production_line, shift, actual_output, efficiency_percentage, wastage_quantity, planned_quantity, warehouse_id, start_time, end_time')
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
        .select('id, batch_number, status, planned_date, shift, actual_qty, yield_percent, wastage_qty, planned_qty, warehouse_id, start_time, end_time')
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
      .select('id, batch_number, status, production_date, production_line, shift, actual_output, warehouse_id, start_time, end_time')
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
        isMissingColumn(openBatchResult.error, 'production_batches', 'actual_output') ||
        isInvalidBatchStatusEnum(openBatchResult.error)
      )
    ) {
      let fallbackOpenBatchQuery = service
        .schema('icecream_erp')
        .from('production_batches')
        .select('id, batch_number, status, planned_date, shift, actual_qty, warehouse_id, start_time, end_time')
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
    const batchIds = batches.map((batch) => String(batch.id ?? '')).filter(Boolean);

    const [materialResult, movementResult, salesResult, finishedGoodsStockResult] = await Promise.all([
      batchIds.length
        ? service
            .schema('icecream_erp')
            .from('production_batch_materials')
            .select('batch_id, item_id, quantity_required, quantity_issued, quantity_actual, quantity_remaining')
            .in('batch_id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      (() => {
        let query = service
          .schema('icecream_erp')
          .from('stock_movements')
          .select('movement_type, quantity, created_at, item_id, warehouse_id')
          .gte('created_at', `${todayKey}T00:00:00.000Z`)
          .lt('created_at', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

        if (warehouseIds && warehouseIds.length > 0) {
          query = query.in('warehouse_id', warehouseIds);
        }

        return query;
      })(),
      (() => {
        let query = service
          .schema('icecream_erp')
          .from('branch_sales')
          .select('sale_date, item_id, quantity, branch_id, items(id, code, name)')
          .gte('sale_date', `${resolvedStart}T00:00:00.000Z`)
          .lte('sale_date', `${resolvedEnd}T23:59:59.999Z`);

        if (effectiveBranchId) {
          query = query.eq('branch_id', effectiveBranchId);
        }

        return query;
      })(),
      (() => {
        let query = service
          .schema('icecream_erp')
          .from('stock_balances')
          .select('item_id, quantity_available, quantity_on_hand, warehouse_id, items!inner(id, code, name, type, item_type)');

        if (warehouseIds && warehouseIds.length > 0) {
          query = query.in('warehouse_id', warehouseIds);
        }

        return query;
      })()
    ]);
    if (materialResult.error) throw materialResult.error;
    if (movementResult.error) throw movementResult.error;
    if (salesResult.error) throw salesResult.error;
    if (finishedGoodsStockResult.error) throw finishedGoodsStockResult.error;

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
    const materials = (materialResult.data ?? []) as Array<Record<string, unknown>>;
    let totalIssued = 0;
    let totalConsumed = 0;
    let totalSurplus = 0;

    for (const material of materials) {
      const issued = Number(material.quantity_issued ?? 0);
      const consumed = Number(material.quantity_actual ?? material.quantity_required ?? 0);
      const remaining = Number(material.quantity_remaining ?? Math.max(0, issued - consumed));
      totalIssued += issued;
      totalConsumed += consumed;
      totalSurplus += Math.max(0, remaining);
    }

    const movementSummary = {
      damagedToday: 0,
      receivedIntoProductionToday: 0,
      returnedToStoresToday: 0,
    };
    for (const movement of (movementResult.data ?? []) as Array<Record<string, unknown>>) {
      const movementType = String(movement.movement_type ?? '');
      const quantity = Number(movement.quantity ?? 0);

      if (movementType === 'WAREHOUSE_TRANSFER_IN') {
        movementSummary.receivedIntoProductionToday += quantity;
      }
      if (movementType === 'PRODUCTION_RETURN') {
        movementSummary.returnedToStoresToday += quantity;
      }
      if (movementType === 'DAMAGE' || movementType === 'WASTAGE') {
        movementSummary.damagedToday += quantity;
      }
    }

    const salesByProduct = new Map<string, { code: string | null; name: string; quantity: number; todayQuantity: number }>();
    for (const sale of (salesResult.data ?? []) as Array<Record<string, unknown>>) {
      const item = firstRelation(sale.items as { code?: string; name?: string } | Array<{ code?: string; name?: string }> | null);
      const key = String(sale.item_id ?? '');
      if (!key) continue;
      const quantity = Number(sale.quantity ?? 0);
      const date = String(sale.sale_date ?? '').slice(0, 10);
      const current = salesByProduct.get(key) ?? {
        code: item?.code ? String(item.code) : null,
        name: item?.name ? String(item.name) : 'Unknown product',
        quantity: 0,
        todayQuantity: 0,
      };
      current.quantity += quantity;
      if (date === todayKey) current.todayQuantity += quantity;
      salesByProduct.set(key, current);
    }

    const finishedGoodsStockByItem = new Map<string, number>();
    for (const row of (finishedGoodsStockResult.data ?? []) as Array<Record<string, unknown>>) {
      const item = firstRelation(row.items as { type?: string; item_type?: string } | Array<{ type?: string; item_type?: string }> | null);
      const itemType = String(item?.item_type ?? item?.type ?? '');
      if (itemType !== 'FINISHED_GOOD') continue;
      const itemId = String(row.item_id ?? '');
      finishedGoodsStockByItem.set(
        itemId,
        (finishedGoodsStockByItem.get(itemId) ?? 0) + Number(row.quantity_available ?? row.quantity_on_hand ?? 0),
      );
    }

    const rankedSales = Array.from(salesByProduct.entries())
      .map(([itemId, row]) => {
        const currentStock = finishedGoodsStockByItem.get(itemId) ?? 0;
        const avgDailySales = row.quantity / 7;
        const suggestedProductionQuantity = Math.max(0, Math.ceil((avgDailySales * 3) - currentStock));
        return {
          currentStock,
          itemId,
          productCode: row.code,
          productName: row.name,
          quantitySoldLast7Days: row.quantity,
          quantitySoldToday: row.todayQuantity,
          suggestedProductionQuantity,
        };
      })
      .sort((left, right) => right.quantitySoldLast7Days - left.quantitySoldLast7Days);

    const shiftSummaryMap = new Map<string, { batches: number; date: string; output: number; shift: string; wastage: number }>();
    for (const batch of batches as Array<Record<string, unknown>>) {
      const date = String(batch.production_date ?? batch.planned_date ?? '').slice(0, 10);
      const shift = String(batch.shift ?? 'UNSPECIFIED');
      const key = `${date}:${shift}`;
      const current = shiftSummaryMap.get(key) ?? { batches: 0, date, output: 0, shift, wastage: 0 };
      current.batches += 1;
      current.output += Number(batch.actual_output ?? batch.actual_qty ?? 0);
      current.wastage += Number(batch.wastage_quantity ?? batch.wastage_qty ?? 0);
      shiftSummaryMap.set(key, current);
    }

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
        finishedAt: b.end_time ? String(b.end_time) : null,
        output: Number(b.actual_output ?? b.actual_qty ?? 0),
        productionDate: String(b.production_date ?? b.planned_date ?? '').slice(0, 10),
        productionLine: String(b.production_line ?? 'N/A'),
        runHours:
          b.start_time && b.end_time
            ? Number(((new Date(String(b.end_time)).getTime() - new Date(String(b.start_time)).getTime()) / (1000 * 60 * 60)).toFixed(2))
            : null,
        shift: String(b.shift ?? ''),
        startedAt: b.start_time ? String(b.start_time) : null,
        status: String(b.status ?? ''),
      })),
      materialFlow: {
        damagedToday: movementSummary.damagedToday,
        issued: totalIssued,
        consumed: totalConsumed,
        receivedIntoProductionToday: movementSummary.receivedIntoProductionToday,
        returnedToStoresToday: movementSummary.returnedToStoresToday,
        surplus: totalSurplus,
      },
      materialsAtRisk,
      qualityAlerts: {
        failed: qualityFailed ?? 0,
        pending: qualityPending ?? 0,
      },
      salesPlanning: {
        bestSellingProducts: rankedSales.slice(0, 5),
        demandSignals: rankedSales.slice(0, 8).map((row) => ({
          currentStock: row.currentStock,
          productCode: row.productCode,
          productName: row.productName,
          quantitySoldLast7Days: row.quantitySoldLast7Days,
          suggestedProductionQuantity: row.suggestedProductionQuantity,
        })),
        last7DaysSalesByProduct: rankedSales.slice(0, 8).map((row) => ({
          productCode: row.productCode,
          productName: row.productName,
          quantity: row.quantitySoldLast7Days,
        })),
        todaySalesByProduct: rankedSales
          .filter((row) => row.quantitySoldToday > 0)
          .slice(0, 8)
          .map((row) => ({
            productCode: row.productCode,
            productName: row.productName,
            quantity: row.quantitySoldToday,
          })),
      },
      shiftSummary: Array.from(shiftSummaryMap.values())
        .sort((left, right) => `${right.date}:${right.shift}`.localeCompare(`${left.date}:${left.shift}`))
        .slice(0, 8),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
