import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { loadLedgerLines } from '@/lib/finance-server';
import { emptyReportPayload, normalizeReportErrorMessage, shouldUseEmptyReportFallback } from '@/lib/reporting';
import { firstRelation } from '@/lib/supabase-relations';
import { createServiceRoleClient } from '@/lib/supabase/server';

const REPORT_TYPES = [
  'DAILY_PRODUCTION', 'WASTAGE', 'RAW_MATERIAL_USAGE', 'BRANCH_SALES',
  'INVENTORY_VALUATION', 'LOW_STOCK', 'EXPIRY_ALERT', 'SUPPLIER_PURCHASE',
  'WORKER_PRODUCTIVITY', 'BRANCH_SHIFT_CLOSE_SUMMARY', 'TRIAL_BALANCE',
  'INCOME_STATEMENT', 'FINANCIAL_POSITION', 'FINANCIAL_RATIOS',
] as const;

type ReportType = typeof REPORT_TYPES[number];
type InvoiceRevenueRow = { invoice_date?: string | null; total?: number | null; total_amount?: number | null };
type BranchSaleRevenueRow = { branch_id?: string | null; sale_date?: string | null; total_amount?: number | null };
type ExpenseRow = { amount?: number | null; branch_id?: string | null; expense_date?: string | null; status?: string | null };

function normalizeAccountType(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/_/g, ' ');
}

function money(value: unknown) {
  return Number(value ?? 0);
}

function isWithinDateRange(value: string | null | undefined, startDate?: string, endDate?: string) {
  if (!value) return !startDate && !endDate;
  const day = value.slice(0, 10);
  if (startDate && day < startDate) return false;
  if (endDate && day > endDate) return false;
  return true;
}

function sumLedgerBalances(
  lines: Awaited<ReturnType<typeof loadLedgerLines>>,
  startDate?: string,
  endDate?: string,
) {
  const filtered = lines.filter((line) => isWithinDateRange(line.entryDate, startDate, endDate));
  const grouped = new Map<string, { accountCode: string; accountName: string; accountType: string; credit: number; debit: number }>();

  for (const line of filtered) {
    const accountCode = String(line.accountCode ?? 'UNKNOWN');
    const accountName = String(line.accountName ?? 'Unknown account');
    const accountType = normalizeAccountType(line.accountType);
    const key = `${accountCode}::${accountName}`;
    const current = grouped.get(key) ?? { accountCode, accountName, accountType, credit: 0, debit: 0 };
    current.debit += money(line.debitAmount);
    current.credit += money(line.creditAmount);
    grouped.set(key, current);
  }

  return Array.from(grouped.values());
}

async function loadInvoiceRevenueRows(
  service: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
  startDate?: string,
  endDate?: string,
) {
  let modern = service
    .schema('icecream_erp')
    .from('invoices')
    .select('total, total_amount, invoice_date')
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (startDate) modern = modern.gte('invoice_date', `${startDate}T00:00:00.000Z`);
  if (endDate) modern = modern.lte('invoice_date', `${endDate}T23:59:59.999Z`);

  const modernResult = await modern;
  if (!modernResult.error) return ((modernResult.data ?? []) as unknown as InvoiceRevenueRow[]);
  if (!shouldUseEmptyReportFallback(modernResult.error)) throw modernResult.error;

  let legacy = service
    .schema('icecream_erp')
    .from('invoices')
    .select('total_amount, invoice_date')
    .eq('organization_id', organizationId);

  if (startDate) legacy = legacy.gte('invoice_date', `${startDate}T00:00:00.000Z`);
  if (endDate) legacy = legacy.lte('invoice_date', `${endDate}T23:59:59.999Z`);

  const legacyResult = await legacy;
  if (legacyResult.error) {
    if (shouldUseEmptyReportFallback(legacyResult.error)) return [];
    throw legacyResult.error;
  }
  return ((legacyResult.data ?? []) as unknown as InvoiceRevenueRow[]);
}

async function loadBranchSalesRevenueRows(
  service: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
  branchId?: string,
  startDate?: string,
  endDate?: string,
) {
  let modern = service
    .schema('icecream_erp')
    .from('branch_sales')
    .select('total_amount, sale_date, branch_id')
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (branchId) modern = modern.eq('branch_id', branchId);
  if (startDate) modern = modern.gte('sale_date', `${startDate}T00:00:00.000Z`);
  if (endDate) modern = modern.lte('sale_date', `${endDate}T23:59:59.999Z`);

  const modernResult = await modern;
  if (!modernResult.error) return ((modernResult.data ?? []) as unknown as BranchSaleRevenueRow[]);
  if (!shouldUseEmptyReportFallback(modernResult.error)) throw modernResult.error;

  let legacy = service
    .schema('icecream_erp')
    .from('branch_sales')
    .select('total_amount, sale_date, branch_id')
    .eq('organization_id', organizationId);

  if (branchId) legacy = legacy.eq('branch_id', branchId);
  if (startDate) legacy = legacy.gte('sale_date', `${startDate}T00:00:00.000Z`);
  if (endDate) legacy = legacy.lte('sale_date', `${endDate}T23:59:59.999Z`);

  const legacyResult = await legacy;
  if (legacyResult.error) {
    if (shouldUseEmptyReportFallback(legacyResult.error)) return [];
    throw legacyResult.error;
  }
  return ((legacyResult.data ?? []) as unknown as BranchSaleRevenueRow[]);
}

async function loadOptionalExpenseRows(
  service: ReturnType<typeof createServiceRoleClient>,
  table: 'finance_expenses' | 'branch_expenses',
  organizationId: string,
  branchId?: string,
  startDate?: string,
  endDate?: string,
) {
  let query =
    table === 'finance_expenses'
      ? service
          .schema('icecream_erp')
          .from('finance_expenses')
          .select('amount, expense_date, branch_id, status')
          .eq('organization_id', organizationId)
      : service
          .schema('icecream_erp')
          .from('branch_expenses')
          .select('amount, expense_date, branch_id')
          .eq('organization_id', organizationId);

  if (branchId) query = query.eq('branch_id', branchId);
  if (startDate) query = query.gte('expense_date', table === 'finance_expenses' ? startDate : `${startDate}T00:00:00.000Z`);
  if (endDate) query = query.lte('expense_date', table === 'finance_expenses' ? endDate : `${endDate}T23:59:59.999Z`);

  const result = await query;
  if (result.error) {
    if (shouldUseEmptyReportFallback(result.error)) return [];
    throw result.error;
  }

  return ((result.data ?? []) as unknown as ExpenseRow[]).filter(
    (row) => table !== 'finance_expenses' || String(row.status ?? '') !== 'REJECTED',
  );
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const reportType = searchParams.get('reportType')?.toUpperCase() as ReportType | undefined;
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
          const branch = firstRelation(sale.branches as { name: string } | Array<{ name: string }> | null)?.name ?? 'Unknown';
          const total = Number(sale.total_amount ?? 0);
          byBranch.set(branch, (byBranch.get(branch) ?? 0) + total);
          byPayment.set(sale.payment_method as string, (byPayment.get(sale.payment_method as string) ?? 0) + total);

          for (const item of (sale.branch_sale_items as Array<{ quantity: number; total_price: number; items: { name: string } | Array<{ name: string }> }>) ?? []) {
            const saleItem = firstRelation(item.items);
            if (productId) continue; // skip if productId filter not matching (simplified)
            data.push({
              saleNumber: sale.sale_number,
              date: (sale.sale_date as string).slice(0, 10),
              branch,
              product: saleItem?.name ?? 'Unknown',
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
        const data = (balances ?? []).map((row) => {
          const item = firstRelation(row.items as { name: string; unit_cost: number } | Array<{ name: string; unit_cost: number }> | null);
          const warehouse = firstRelation(row.warehouses as { name: string } | Array<{ name: string }> | null);
          return {
            item: item?.name ?? 'Unknown',
            warehouse: warehouse?.name ?? 'Unknown',
            qty: Number(row.quantity_on_hand ?? 0),
            unitCost: Number(item?.unit_cost ?? 0),
            totalValue: Number(row.quantity_on_hand ?? 0) * Number(item?.unit_cost ?? 0),
          };
        });

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
          .filter((row) => {
            const item = firstRelation(row.items as { reorder_level: number } | Array<{ reorder_level: number }> | null);
            return Number(row.quantity_available) <= Number(item?.reorder_level ?? 0);
          })
          .map((row) => {
            const item = firstRelation(row.items as { name: string; reorder_level: number } | Array<{ name: string; reorder_level: number }> | null);
            const warehouse = firstRelation(row.warehouses as { name: string } | Array<{ name: string }> | null);
            return {
              item: item?.name ?? 'Unknown',
              warehouse: warehouse?.name ?? 'Unknown',
              reorderLevel: Number(item?.reorder_level ?? 0),
              available: Number(row.quantity_available),
              deficit: Number(item?.reorder_level ?? 0) - Number(row.quantity_available),
            };
          })
          .sort((a, b) => b.deficit - a.deficit);

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

        const data = (rows ?? []).map((row) => {
          const item = firstRelation(row.items as { name: string } | Array<{ name: string }> | null);
          const warehouse = firstRelation(row.warehouses as { name: string } | Array<{ name: string }> | null);
          return {
            batchNumber: row.batch_number,
            item: item?.name ?? 'Unknown',
            expiryDate: row.expiry_date?.slice(0, 10),
            qty: Number(row.quantity_remaining ?? 0),
            location: warehouse?.name ?? 'Unknown',
          };
        });

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
        for (const r of data) {
          const reason = String(r.reason ?? 'Unspecified');
          reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + r.wastageQty);
        }

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
          const supplier = firstRelation(o.suppliers as { name: string } | Array<{ name: string }> | null);
          const current = grouped.get(key) ?? { supplier: supplier?.name ?? 'Unknown', pos: 0, grns: 0, spend: 0 };
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
          branch: firstRelation(r.branches as { name: string } | Array<{ name: string }> | null)?.name ?? 'Unknown',
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

      case 'TRIAL_BALANCE': {
        const ledgerLines = await loadLedgerLines(ctx.organizationId, true);
        const data = sumLedgerBalances(ledgerLines, startDate, endDate).map((row) => ({
          ...row,
          balance: row.debit - row.credit,
        }));
        const totalDebit = data.reduce((sum, row) => sum + row.debit, 0);
        const totalCredit = data.reduce((sum, row) => sum + row.credit, 0);

        return NextResponse.json({
          chart: data.map((row) => ({ account: row.accountCode, balance: row.balance })),
          data,
          summary: {
            totalCredit,
            totalDebit,
            variance: totalDebit - totalCredit,
          },
        });
      }

      case 'INCOME_STATEMENT': {
        const [invoices, branchSalesRows, financeExpensesRows, branchExpensesRows] = await Promise.all([
          loadInvoiceRevenueRows(service, ctx.organizationId, startDate, endDate),
          loadBranchSalesRevenueRows(service, ctx.organizationId, effectiveBranchId, startDate, endDate),
          loadOptionalExpenseRows(service, 'finance_expenses', ctx.organizationId, effectiveBranchId, startDate, endDate),
          loadOptionalExpenseRows(service, 'branch_expenses', ctx.organizationId, effectiveBranchId, startDate, endDate),
        ]);

        const invoiceRevenue = invoices.reduce((sum, row) => sum + money(row.total ?? row.total_amount), 0);
        const branchRevenue = branchSalesRows.reduce((sum, row) => sum + money(row.total_amount), 0);
        const operatingExpenses =
          financeExpensesRows.reduce((sum, row) => sum + money(row.amount), 0) +
          branchExpensesRows.reduce((sum, row) => sum + money(row.amount), 0);
        const revenue = invoiceRevenue + branchRevenue;
        const grossProfit = revenue;
        const netProfit = grossProfit - operatingExpenses;
        const data = [
          { amount: revenue, line: 'Revenue' },
          { amount: grossProfit, line: 'Gross Profit' },
          { amount: operatingExpenses, line: 'Operating Expenses' },
          { amount: netProfit, line: 'Net Profit' },
        ];

        return NextResponse.json({
          chart: data,
          data,
          summary: {
            grossProfit,
            netProfit,
            operatingExpenses,
            revenue,
          },
        });
      }

      case 'FINANCIAL_POSITION': {
        const lines = sumLedgerBalances(await loadLedgerLines(ctx.organizationId, true), startDate, endDate);
        const totals = { assets: 0, equity: 0, liabilities: 0 };
        for (const line of lines) {
          const accountType = normalizeAccountType(line.accountType);
          const net = money(line.debit) - money(line.credit);
          if (accountType === 'asset') totals.assets += net;
          if (accountType === 'liability') totals.liabilities += -net;
          if (accountType === 'equity') totals.equity += -net;
        }

        const data = [
          { amount: totals.assets, line: 'Assets' },
          { amount: totals.liabilities, line: 'Liabilities' },
          { amount: totals.equity, line: 'Equity' },
        ];

        return NextResponse.json({
          chart: data,
          data,
          summary: totals,
        });
      }

      case 'FINANCIAL_RATIOS': {
        const [positionLines, invoiceRows, branchSalesRows, financeExpensesRows, branchExpensesRows] = await Promise.all([
          loadLedgerLines(ctx.organizationId, true),
          loadInvoiceRevenueRows(service, ctx.organizationId),
          loadBranchSalesRevenueRows(service, ctx.organizationId, effectiveBranchId),
          loadOptionalExpenseRows(service, 'finance_expenses', ctx.organizationId, effectiveBranchId),
          loadOptionalExpenseRows(service, 'branch_expenses', ctx.organizationId, effectiveBranchId),
        ]);

        const totals = { assets: 0, equity: 0, liabilities: 0 };
        for (const line of sumLedgerBalances(positionLines, startDate, endDate)) {
          const accountType = normalizeAccountType(line.accountType);
          const net = money(line.debit) - money(line.credit);
          if (accountType === 'asset') totals.assets += net;
          if (accountType === 'liability') totals.liabilities += -net;
          if (accountType === 'equity') totals.equity += -net;
        }
        const revenue =
          invoiceRows.reduce((sum, row) => sum + money(row.total ?? row.total_amount), 0) +
          branchSalesRows.reduce((sum, row) => sum + money(row.total_amount), 0);
        const operatingExpenses =
          financeExpensesRows.reduce((sum, row) => sum + money(row.amount), 0) +
          branchExpensesRows.reduce((sum, row) => sum + money(row.amount), 0);
        const netProfit = revenue - operatingExpenses;
        const ratio = (numerator: number, denominator: number) => denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
        const data = [
          { formula: 'Assets / Liabilities', ratio: 'Current Ratio', value: ratio(totals.assets, totals.liabilities) },
          { formula: 'Liabilities / Equity', ratio: 'Debt to Equity', value: ratio(totals.liabilities, totals.equity) },
          { formula: 'Net Profit / Revenue', ratio: 'Net Profit Margin', value: ratio(netProfit, revenue) },
          { formula: 'Operating Expenses / Revenue', ratio: 'Expense Ratio', value: ratio(operatingExpenses, revenue) },
          { formula: 'Net Profit / Assets', ratio: 'Return on Assets', value: ratio(netProfit, totals.assets) },
        ];

        return NextResponse.json({
          chart: data.map((row) => ({ ratio: row.ratio, value: row.value })),
          data,
          summary: {
            ...totals,
            netProfit,
            operatingExpenses,
            revenue,
          },
        });
      }

      default:
        return badRequest('Unsupported report type');
    }
  } catch (err) {
    if (shouldUseEmptyReportFallback(err)) {
      return NextResponse.json(
        emptyReportPayload({
          meta: { reportType: reportType ?? 'unknown' },
          warning: normalizeReportErrorMessage(err),
        }),
      );
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
