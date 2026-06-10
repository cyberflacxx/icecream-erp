import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

const REPORT_TYPES = [
  'DAILY_PRODUCTION', 'WASTAGE', 'RAW_MATERIAL_USAGE', 'BRANCH_SALES',
  'INVENTORY_VALUATION', 'LOW_STOCK', 'EXPIRY_ALERT', 'SUPPLIER_PURCHASE',
  'WORKER_PRODUCTIVITY', 'BRANCH_SHIFT_CLOSE_SUMMARY',
] as const;

type ReportType = typeof REPORT_TYPES[number];

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const reportType = searchParams.get('reportType') as ReportType | null;
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  const branchId = searchParams.get('branchId') ?? undefined;
  const warehouseId = searchParams.get('warehouseId') ?? undefined;
  const productId = searchParams.get('productId') ?? undefined;
  const supplierId = searchParams.get('supplierId') ?? undefined;
  const shift = searchParams.get('shift') ?? undefined;
  const daysAhead = searchParams.get('daysAhead') ? parseInt(searchParams.get('daysAhead')!) : 30;

  if (!reportType || !REPORT_TYPES.includes(reportType)) {
    return badRequest(`reportType must be one of: ${REPORT_TYPES.join(', ')}`);
  }

  const effectiveBranchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : branchId;

  try {
    switch (reportType) {
      case 'DAILY_PRODUCTION': {
        const { data: rows } = await service
          .schema('icecream_erp')
          .from('production_batches')
          .select('batch_number, production_date, shift, production_line, actual_output, efficiency_percentage, wastage_quantity')
          .is('deleted_at', null)
          .gte('production_date', startDate ? `${startDate}T00:00:00.000Z` : '1970-01-01T00:00:00.000Z')
          .lte('production_date', endDate ? `${endDate}T23:59:59.999Z` : new Date().toISOString())
          .order('production_date', { ascending: true });

        const data = (rows ?? []).map((r: Record<string, unknown>) => ({
          batchNumber: r.batch_number,
          productionDate: (r.production_date as string).slice(0, 10),
          shift: r.shift,
          productionLine: r.production_line,
          output: Number(r.actual_output ?? 0),
          efficiency: Number(r.efficiency_percentage ?? 0),
          wastage: Number(r.wastage_quantity ?? 0),
        }));

        const chart = Array.from(
          data.reduce((map, row) => {
            map.set(row.productionDate, (map.get(row.productionDate) ?? 0) + row.output);
            return map;
          }, new Map<string, number>())
        ).map(([day, output]) => ({ day, output }));

        return NextResponse.json({
          chart,
          data,
          summary: {
            batches: data.length,
            totalOutput: data.reduce((s, r) => s + r.output, 0),
            avgEfficiency: data.length ? data.reduce((s, r) => s + r.efficiency, 0) / data.length : 0,
            totalWastage: data.reduce((s, r) => s + r.wastage, 0),
          },
        });
      }

      case 'BRANCH_SALES': {
        let query = service
          .schema('icecream_erp')
          .from('branch_sales')
          .select('sale_number, sale_date, branch_id, payment_method, total_amount, branches(name), branch_sale_items(quantity, total_price, items(name))')
          .is('deleted_at', null);

        if (effectiveBranchId) query = query.eq('branch_id', effectiveBranchId);
        if (startDate) query = query.gte('sale_date', `${startDate}T00:00:00.000Z`);
        if (endDate) query = query.lte('sale_date', `${endDate}T23:59:59.999Z`);

        const { data: rows } = await query;

        const data: Array<Record<string, unknown>> = [];
        const byBranch = new Map<string, number>();
        const byPayment = new Map<string, number>();

        for (const sale of rows ?? []) {
          const branch = (sale.branches as { name: string })?.name ?? 'Unknown';
          const total = Number(sale.total_amount ?? 0);
          byBranch.set(branch, (byBranch.get(branch) ?? 0) + total);
          byPayment.set(sale.payment_method as string, (byPayment.get(sale.payment_method as string) ?? 0) + total);

          for (const item of (sale.branch_sale_items as Array<{ quantity: number; total_price: number; items: { name: string } }>) ?? []) {
            if (productId) continue; // skip if productId filter not matching (simplified)
            data.push({
              saleNumber: sale.sale_number,
              date: (sale.sale_date as string).slice(0, 10),
              branch,
              product: item.items?.name ?? 'Unknown',
              quantity: Number(item.quantity ?? 0),
              paymentMethod: sale.payment_method,
              total: Number(item.total_price ?? 0),
            });
          }
        }

        return NextResponse.json({
          chart: Array.from(byBranch.entries()).map(([branch, total]) => ({ branch, total })),
          data,
          summary: {
            totalSales: data.reduce((s, r) => s + Number(r.total ?? 0), 0),
            paymentBreakdown: Object.fromEntries(byPayment),
          },
        });
      }

      case 'INVENTORY_VALUATION': {
        let query = service
          .schema('icecream_erp')
          .from('stock_balances')
          .select('quantity_on_hand, items(name, unit_cost), warehouses(name)')
          .order('items(name)', { ascending: true });

        if (warehouseId) query = query.eq('warehouse_id', warehouseId);

        const { data: balances } = await query;
        const data = (balances ?? []).map((row: { quantity_on_hand: number; items: { name: string; unit_cost: number }; warehouses: { name: string } }) => ({
          item: row.items?.name,
          warehouse: row.warehouses?.name,
          qty: Number(row.quantity_on_hand ?? 0),
          unitCost: Number(row.items?.unit_cost ?? 0),
          totalValue: Number(row.quantity_on_hand ?? 0) * Number(row.items?.unit_cost ?? 0),
        }));

        return NextResponse.json({
          chart: data.slice(0, 25).map((row) => ({ item: row.item, value: row.totalValue })),
          data,
          summary: { totalWarehouseValue: data.reduce((s, r) => s + r.totalValue, 0) },
        });
      }

      case 'LOW_STOCK': {
        const { data: rows } = await service
          .schema('icecream_erp')
          .from('stock_balances')
          .select('quantity_available, items!inner(name, reorder_level), warehouses(name)')
          .not('items.reorder_level', 'is', null);

        const data = (rows ?? [])
          .filter((r: { quantity_available: number; items: { reorder_level: number } }) =>
            r.quantity_available <= r.items.reorder_level
          )
          .map((r: { quantity_available: number; items: { name: string; reorder_level: number }; warehouses: { name: string } }) => ({
            item: r.items.name,
            warehouse: r.warehouses?.name,
            reorderLevel: Number(r.items.reorder_level),
            available: Number(r.quantity_available),
            deficit: Number(r.items.reorder_level) - Number(r.quantity_available),
          }))
          .sort((a: { deficit: number }, b: { deficit: number }) => b.deficit - a.deficit);

        return NextResponse.json({
          chart: data.slice(0, 20).map((r: { item: string; deficit: number }) => ({ item: r.item, deficit: r.deficit })),
          data,
          summary: { criticalCount: data.length },
        });
      }

      case 'EXPIRY_ALERT': {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const future = new Date(now);
        future.setDate(now.getDate() + daysAhead);

        const { data: rows } = await service
          .schema('icecream_erp')
          .from('inventory_batches')
          .select('batch_number, expiry_date, quantity_remaining, items(name), warehouses(name)')
          .gte('expiry_date', now.toISOString())
          .lte('expiry_date', future.toISOString())
          .gt('quantity_remaining', 0)
          .order('expiry_date', { ascending: true });

        const data = (rows ?? []).map((r: { batch_number: string; items: { name: string }; expiry_date: string; quantity_remaining: number; warehouses: { name: string } }) => ({
          batchNumber: r.batch_number,
          item: r.items?.name,
          expiryDate: r.expiry_date?.slice(0, 10),
          qty: Number(r.quantity_remaining ?? 0),
          location: r.warehouses?.name,
        }));

        return NextResponse.json({
          chart: data.map((r: { batch_number?: string; batchNumber?: string; qty: number }) => ({ batch: r.batchNumber, qty: r.qty })),
          data,
          summary: { expiringBatches: data.length },
        });
      }

      case 'WASTAGE': {
        const { data: rows } = await service
          .schema('icecream_erp')
          .from('production_batches')
          .select('production_date, shift, wastage_quantity, wastage_percentage, wastage_reason, recipes(finished_item:items(name))')
          .is('deleted_at', null)
          .gte('production_date', startDate ? `${startDate}T00:00:00.000Z` : '1970-01-01T00:00:00.000Z')
          .lte('production_date', endDate ? `${endDate}T23:59:59.999Z` : new Date().toISOString())
          .order('production_date', { ascending: true });

        const data = (rows ?? []).map((r: Record<string, unknown>) => ({
          date: (r.production_date as string).slice(0, 10),
          shift: r.shift,
          wastageQty: Number(r.wastage_quantity ?? 0),
          wastagePercent: Number(r.wastage_percentage ?? 0),
          reason: r.wastage_reason ?? 'Unspecified',
        }));

        const reasonMap = new Map<string, number>();
        for (const r of data) reasonMap.set(r.reason, (reasonMap.get(r.reason) ?? 0) + r.wastageQty);

        return NextResponse.json({
          chart: Array.from(reasonMap.entries()).map(([reason, value]) => ({ reason, value })),
          data,
          summary: {
            totalWastageQty: data.reduce((s, r) => s + r.wastageQty, 0),
            avgWastagePercent: data.length ? data.reduce((s, r) => s + r.wastagePercent, 0) / data.length : 0,
          },
        });
      }

      case 'RAW_MATERIAL_USAGE': {
        const { data: movements } = await service
          .schema('icecream_erp')
          .from('stock_movements')
          .select('created_at, movement_type, quantity, items(name), warehouses(name)')
          .gte('created_at', startDate ? `${startDate}T00:00:00.000Z` : '1970-01-01T00:00:00.000Z')
          .lte('created_at', endDate ? `${endDate}T23:59:59.999Z` : new Date().toISOString())
          .order('created_at', { ascending: true });

        const daily = new Map<string, { issued: number; received: number }>();
        for (const m of movements ?? []) {
          const day = (m.created_at as string).slice(0, 10);
          const current = daily.get(day) ?? { issued: 0, received: 0 };
          const qty = Number(m.quantity ?? 0);
          if (['PURCHASE_RECEIVE', 'TRANSFER_IN', 'ADJUSTMENT_IN'].includes(m.movement_type as string)) {
            current.received += qty;
          } else if (['PRODUCTION_ISSUE', 'SALES_ISSUE', 'TRANSFER_OUT', 'ADJUSTMENT_OUT'].includes(m.movement_type as string)) {
            current.issued += qty;
          }
          daily.set(day, current);
        }

        const chart = Array.from(daily.entries()).map(([date, v]) => ({ date, issued: v.issued, received: v.received }));
        const data = chart.map((r) => ({ date: r.date, opening: 0, received: r.received, issued: r.issued, closing: r.received - r.issued }));

        return NextResponse.json({
          chart,
          data,
          summary: {
            totalIssued: data.reduce((s, r) => s + r.issued, 0),
            totalReceived: data.reduce((s, r) => s + r.received, 0),
          },
        });
      }

      case 'SUPPLIER_PURCHASE': {
        let query = service
          .schema('icecream_erp')
          .from('purchase_orders')
          .select('supplier_id, total, suppliers(name), goods_received_notes(id)')
          .is('deleted_at', null);

        if (supplierId) query = query.eq('supplier_id', supplierId);
        if (startDate) query = query.gte('order_date', `${startDate}T00:00:00.000Z`);
        if (endDate) query = query.lte('order_date', `${endDate}T23:59:59.999Z`);

        const { data: orders } = await query;
        const grouped = new Map<string, { supplier: string; pos: number; grns: number; spend: number }>();

        for (const o of orders ?? []) {
          const key = o.supplier_id as string;
          const current = grouped.get(key) ?? { supplier: (o.suppliers as { name: string })?.name ?? 'Unknown', pos: 0, grns: 0, spend: 0 };
          current.pos++;
          current.grns += Array.isArray(o.goods_received_notes) ? o.goods_received_notes.length : 0;
          current.spend += Number(o.total ?? 0);
          grouped.set(key, current);
        }

        const data = Array.from(grouped.values());
        return NextResponse.json({
          chart: data.map((r) => ({ supplier: r.supplier, spend: r.spend })),
          data: data.map((r) => ({ supplier: r.supplier, pos: r.pos, grns: r.grns, totalSpend: r.spend })),
          summary: { totalSpend: data.reduce((s, r) => s + r.spend, 0) },
        });
      }

      case 'BRANCH_SHIFT_CLOSE_SUMMARY': {
        let query = service
          .schema('icecream_erp')
          .from('branch_shift_closes')
          .select('shift_date, shift_type, status, expected_cash, actual_cash, cash_variance, stock_variance, branches(name)')
          .is('deleted_at', null)
          .order('shift_date', { ascending: false });

        if (effectiveBranchId) query = query.eq('branch_id', effectiveBranchId);
        if (startDate) query = query.gte('shift_date', `${startDate}T00:00:00.000Z`);
        if (endDate) query = query.lte('shift_date', `${endDate}T23:59:59.999Z`);

        const { data: rows } = await query;
        const data = (rows ?? []).map((r: Record<string, unknown>) => ({
          branch: (r.branches as { name: string })?.name,
          shiftDate: (r.shift_date as string).slice(0, 10),
          shiftType: r.shift_type,
          status: r.status,
          expectedCash: Number(r.expected_cash ?? 0),
          actualCash: Number(r.actual_cash ?? 0),
          cashVariance: Number(r.cash_variance ?? 0),
          stockVariance: Number(r.stock_variance ?? 0),
        }));

        return NextResponse.json({
          chart: data.map((r) => ({ branch: r.branch, cashVariance: r.cashVariance })),
          data,
          summary: {
            totalShiftCloses: data.length,
            totalCashVariance: data.reduce((s, r) => s + r.cashVariance, 0),
          },
        });
      }

      case 'WORKER_PRODUCTIVITY': {
        return NextResponse.json({
          chart: [],
          data: [],
          summary: { activeWorkers: 0, message: 'Worker productivity report requires production worker assignments data.' },
        });
      }

      default:
        return badRequest('Unsupported report type');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
