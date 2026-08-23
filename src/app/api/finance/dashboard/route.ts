import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  buildEmptyFinanceDashboardData,
  calculateBranchCostSummary,
  calculateInventoryValuation,
  calculateProductionCostSummary,
  resolveFinanceSectionResult,
  summarizeProfitAndLossFromLedger,
} from '@/lib/finance';
import {
  isMissingFinanceColumn,
  isMissingFinanceTable,
  loadCashAccountsCompatibility,
  loadPettyCashRequestsCompatibility,
  loadLedgerLines,
  logFinanceRouteError,
} from '@/lib/finance-server';

async function queryWithoutDeletedAt<T>(primary: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, fallback: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const result = await primary;
  if (result.error && result.error.message.toLowerCase().includes('deleted_at')) {
    return fallback();
  }
  return result;
}

async function optionalQuery<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const result = await query;
  if (result.error) {
    const message = result.error.message ?? '';
    if (isMissingFinanceTable(result.error) || message.includes('Could not find the table')) {
      return [] as T[];
    }
    throw result.error;
  }
  return result.data ?? [];
}

function sectionWarning(label: string) {
  return `Some ${label} data could not be loaded.`;
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.dashboard.view', 'finance.read', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const startDate = searchParams.get('startDate') ?? sevenDaysAgo.toISOString().slice(0, 10);
    const endDate = searchParams.get('endDate') ?? today.toISOString().slice(0, 10);

    const sectionConfigs = [
      {
        key: 'payments',
        warning: sectionWarning('payments'),
        load: () =>
          optionalQuery(
            service
              .schema('icecream_erp')
              .from('payments')
              .select('id, payment_date, amount, payment_method')
              .gte('payment_date', `${startDate}T00:00:00.000Z`)
              .lte('payment_date', `${endDate}T23:59:59.999Z`)
              .order('payment_date', { ascending: true }),
          ),
      },
      {
        key: 'branchExpenses',
        warning: sectionWarning('branch expenses'),
        load: () =>
          optionalQuery(
            queryWithoutDeletedAt(
              service
                .schema('icecream_erp')
                .from('branch_expenses')
                .select('id, expense_date, amount')
                .is('deleted_at', null)
                .gte('expense_date', `${startDate}T00:00:00.000Z`)
                .lte('expense_date', `${endDate}T23:59:59.999Z`)
                .order('expense_date', { ascending: true }),
              () =>
                service
                  .schema('icecream_erp')
                  .from('branch_expenses')
                  .select('id, expense_date, amount')
                  .gte('expense_date', `${startDate}T00:00:00.000Z`)
                  .lte('expense_date', `${endDate}T23:59:59.999Z`)
                  .order('expense_date', { ascending: true }),
            ),
          ),
      },
      {
        key: 'overdueInvoices',
        warning: sectionWarning('receivables'),
        load: () =>
          optionalQuery(
            queryWithoutDeletedAt(
              service
                .schema('icecream_erp')
                .from('invoices')
                .select('id, invoice_number, status, due_date, balance_due, customers(name)')
                .is('deleted_at', null)
                .in('status', ['SENT', 'PARTIAL_PAID', 'OVERDUE'])
                .order('due_date', { ascending: true })
                .limit(8),
              () =>
                service
                  .schema('icecream_erp')
                  .from('invoices')
                  .select('id, invoice_number, status, due_date, balance_due, customers(name)')
                  .in('status', ['SENT', 'PARTIAL_PAID', 'OVERDUE'])
                  .order('due_date', { ascending: true })
                  .limit(8),
            ),
          ),
      },
      {
        key: 'supplierInvoices',
        warning: sectionWarning('payables'),
        load: () =>
          optionalQuery(
            queryWithoutDeletedAt(
              service.schema('icecream_erp').from('supplier_invoices').select('id, invoice_total'),
              () => service.schema('icecream_erp').from('supplier_invoices').select('id, invoice_total'),
            ),
          ),
      },
      {
        key: 'supplierPayments',
        warning: sectionWarning('supplier payments'),
        load: () =>
          optionalQuery(
            queryWithoutDeletedAt(
              service.schema('icecream_erp').from('supplier_payments').select('supplier_invoice_id, amount_paid'),
              () => service.schema('icecream_erp').from('supplier_payments').select('supplier_invoice_id, amount_paid'),
            ),
          ),
      },
      {
        key: 'bankAccounts',
        warning: sectionWarning('bank accounts'),
        load: () =>
          optionalQuery(
            queryWithoutDeletedAt(
              service.schema('icecream_erp').from('bank_accounts').select('current_balance'),
              () => service.schema('icecream_erp').from('bank_accounts').select('current_balance'),
            ),
          ),
      },
      {
        key: 'cashAccounts',
        warning: sectionWarning('cash accounts'),
        load: () => loadCashAccountsCompatibility(ctx.organizationId, { routeName: 'finance.dashboard' }),
      },
      {
        key: 'pettyCashRequests',
        warning: sectionWarning('petty cash'),
        load: () =>
          loadPettyCashRequestsCompatibility(ctx.organizationId, {
            endDate: `${endDate}T23:59:59.999Z`,
            routeName: 'finance.dashboard',
            startDate: `${startDate}T00:00:00.000Z`,
          }),
      },
      {
        key: 'financeExpenses',
        warning: sectionWarning('finance expenses'),
        load: () =>
          optionalQuery(
            queryWithoutDeletedAt(
              service.schema('icecream_erp').from('finance_expenses').select('amount, status'),
              () => service.schema('icecream_erp').from('finance_expenses').select('amount, status'),
            ),
          ),
      },
      {
        key: 'stockBalances',
        warning: sectionWarning('inventory valuation'),
        load: () =>
          optionalQuery(
            service
              .schema('icecream_erp')
              .from('stock_balances')
              .select('quantity, quantity_on_hand, items(standard_cost, unit_cost)')
              .eq('organization_id', ctx.organizationId),
          ),
      },
      {
        key: 'branchSales',
        warning: sectionWarning('branch sales'),
        load: () =>
          optionalQuery(
            queryWithoutDeletedAt(
              service.schema('icecream_erp').from('branch_sales').select('sale_date, total_amount').is('deleted_at', null),
              () => service.schema('icecream_erp').from('branch_sales').select('sale_date, total_amount'),
            ),
          ),
      },
      {
        key: 'productionBatches',
        warning: sectionWarning('production costing'),
        load: async () => {
          const primary = await service
            .schema('icecream_erp')
            .from('production_batches')
            .select('material_cost, labour_cost, overhead_cost, actual_output_quantity, total_material_cost, total_labour_cost, total_overhead_cost, actual_qty')
            .is('deleted_at', null);

          if (!primary.error) {
            return primary.data ?? [];
          }

          const compatibleLegacy =
            isMissingFinanceTable(primary.error) ||
            isMissingFinanceColumn(primary.error, 'production_batches', 'deleted_at') ||
            isMissingFinanceColumn(primary.error, 'production_batches', 'material_cost') ||
            isMissingFinanceColumn(primary.error, 'production_batches', 'labour_cost') ||
            isMissingFinanceColumn(primary.error, 'production_batches', 'overhead_cost') ||
            isMissingFinanceColumn(primary.error, 'production_batches', 'actual_output_quantity') ||
            isMissingFinanceColumn(primary.error, 'production_batches', 'total_material_cost') ||
            isMissingFinanceColumn(primary.error, 'production_batches', 'total_labour_cost') ||
            isMissingFinanceColumn(primary.error, 'production_batches', 'total_overhead_cost') ||
            isMissingFinanceColumn(primary.error, 'production_batches', 'actual_qty');

          if (!compatibleLegacy) {
            throw primary.error;
          }

          const fallback = await service
            .schema('icecream_erp')
            .from('production_batches')
            .select('material_cost, labour_cost, overhead_cost, total_material_cost, total_labour_cost, total_overhead_cost, actual_qty');

          if (fallback.error) {
            if (isMissingFinanceTable(fallback.error)) {
              return [] as Array<Record<string, unknown>>;
            }
            throw fallback.error;
          }

          return fallback.data ?? [];
        },
      },
      {
        key: 'ledgerLines',
        warning: sectionWarning('trial balance'),
        load: () => loadLedgerLines(ctx.organizationId),
      },
    ] as const;

    const settledSections = await Promise.allSettled(sectionConfigs.map((section) => section.load()));
    const warnings: string[] = [];
    const sections = {
      bankAccounts: [] as Array<{ current_balance?: number | null }>,
      branchExpenses: [] as Array<{ amount?: number | null; expense_date?: string | null }>,
      branchSales: [] as Array<{ sale_date?: string | null; total_amount?: number | null }>,
      cashAccounts: [] as Array<{ balance?: number | null }>,
      financeExpenses: [] as Array<{ amount?: number | null; status?: string | null }>,
      ledgerLines: [] as Awaited<ReturnType<typeof loadLedgerLines>>,
      overdueInvoices: [] as Array<Record<string, unknown>>,
      payments: [] as Array<{ amount?: number | null; payment_date?: string | null; payment_method?: string | null }>,
      pettyCashRequests: [] as Awaited<ReturnType<typeof loadPettyCashRequestsCompatibility>>,
      productionBatches: [] as Array<Record<string, unknown>>,
      stockBalances: [] as Array<Record<string, unknown>>,
      supplierInvoices: [] as Array<{ invoice_total?: number | null }>,
      supplierPayments: [] as Array<{ amount_paid?: number | null }>,
    };

    settledSections.forEach((result, index) => {
      const config = sectionConfigs[index];
      const fallbackValue = sections[config.key] as never;
      const resolved = resolveFinanceSectionResult(result as PromiseSettledResult<never>, fallbackValue, config.warning);

      if (resolved.warning) {
        warnings.push(resolved.warning);
        logFinanceRouteError('finance.dashboard', config.key, result.status === 'rejected' ? result.reason : null);
      }

      (sections[config.key] as never) = resolved.value;
    });

    const revenueByDay = new Map<string, number>();
    const expenseByDay = new Map<string, number>();
    const paymentMethodMap = new Map<string, number>();

    const effectivePayments = sections.payments.length > 0
      ? sections.payments
      : sections.branchSales.map((sale) => ({
          payment_date: String(sale.sale_date ?? new Date().toISOString().slice(0, 10)),
          amount: Number(sale.total_amount ?? 0),
          payment_method: 'SALES',
        }));

    for (const p of effectivePayments) {
      const day = String(p.payment_date ?? '').slice(0, 10);
      if (!day) continue;
      const amount = Number(p.amount ?? 0);
      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + amount);
      const paymentMethod = String(p.payment_method ?? 'UNKNOWN');
      paymentMethodMap.set(paymentMethod, (paymentMethodMap.get(paymentMethod) ?? 0) + amount);
    }

    for (const e of sections.branchExpenses ?? []) {
      const day = String(e.expense_date ?? '').slice(0, 10);
      if (!day) continue;
      expenseByDay.set(day, (expenseByDay.get(day) ?? 0) + Number(e.amount ?? 0));
    }

    const cashflowDays = new Set([...revenueByDay.keys(), ...expenseByDay.keys()]);
    const cashflowLast7Days = Array.from(cashflowDays)
      .sort()
      .map((day) => ({ day, revenue: revenueByDay.get(day) ?? 0, expenses: expenseByDay.get(day) ?? 0 }));

    const outstandingReceivables = sections.overdueInvoices.reduce(
      (sum, inv) => sum + Number((inv as { balance_due?: number | null }).balance_due ?? 0), 0
    );
    const totalRevenue = effectivePayments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    const totalBranchExpenses = sections.branchExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
    const totalFinanceExpenses = sections.financeExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
    const totalExpenses = totalBranchExpenses + totalFinanceExpenses;
    const grossProfitSummary = summarizeProfitAndLossFromLedger(sections.ledgerLines);
    const outstandingPayables = Math.max(
      0,
      sections.supplierInvoices.reduce((sum, inv) => sum + Number(inv.invoice_total ?? 0), 0) -
        sections.supplierPayments.reduce((sum, p) => sum + Number(p.amount_paid ?? 0), 0),
    );
    const bankBalance = sections.bankAccounts.reduce((sum, row) => sum + Number(row.current_balance ?? 0), 0);
    const cashBalance = sections.cashAccounts.reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
    const pettyCashBalance = sections.pettyCashRequests
      .filter((row: { amountRequested?: number | null; status: string }) => row.status === 'APPROVED')
      .reduce((sum: number, row: { amountRequested?: number | null; status: string }) => sum + Number(row.amountRequested ?? 0), 0);
    const stockValuation = sections.stockBalances.reduce((sum: number, row: Record<string, unknown>) => {
      const item = Array.isArray(row.items) ? row.items[0] : row.items;
      return sum + calculateInventoryValuation(
        Number(row.quantity ?? row.quantity_on_hand ?? 0),
        Number((item as { standard_cost?: number } | null)?.standard_cost ?? (item as { unit_cost?: number } | null)?.unit_cost ?? 0),
      );
    }, 0);
    const productionCost = sections.productionBatches.reduce((sum: number, row: Record<string, unknown>) => {
      const summary = calculateProductionCostSummary(
        Number(row.material_cost ?? row.total_material_cost ?? 0),
        Number(row.labour_cost ?? row.total_labour_cost ?? 0),
        Number(row.overhead_cost ?? row.total_overhead_cost ?? 0),
        Number(row.actual_output_quantity ?? row.actual_qty ?? 0),
      );
      return sum + summary.totalCost;
    }, 0);
    const branchProfitability = calculateBranchCostSummary(
      sections.branchSales.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0),
      0,
      totalBranchExpenses,
      0,
    ).netProfit;
    const pendingApprovals =
      sections.pettyCashRequests.filter((row: { status: string }) => row.status === 'PENDING').length +
      sections.financeExpenses.filter((row: { status?: string | null }) => row.status === 'DRAFT' || row.status === 'PENDING_APPROVAL').length;

    const data = buildEmptyFinanceDashboardData();
    data.stats = {
      bankBalance,
      branchProfitability,
      cashBalance,
      grossProfit: grossProfitSummary.grossProfit,
      netProfit: grossProfitSummary.netProfit,
      paymentsCount: effectivePayments.length,
      pendingApprovals,
      pettyCashBalance,
      productionCost,
      revenue: totalRevenue,
      stockValuation,
      totalExpenses,
      outstandingReceivables,
      outstandingPayables,
    };
    data.charts = {
      cashflowLast7Days,
      paymentMethodBreakdown: Array.from(paymentMethodMap.entries()).map(([method, total]) => ({ method, total })),
    };
    data.overdueInvoices = sections.overdueInvoices.map((inv: Record<string, unknown>) => {
      const customers = inv.customers as { name?: string } | Array<{ name?: string }> | null;
      const customer = Array.isArray(customers) ? customers[0] : customers;
      return {
        invoiceNumber: String(inv.invoice_number ?? ''),
        status: String(inv.status ?? ''),
        dueDate: inv.due_date ? String(inv.due_date).slice(0, 10) : 'N/A',
        balance: Number(inv.balance_due ?? 0),
        customer: customer?.name ?? 'Walk-in',
      };
    });
    data.recentEntries = sections.ledgerLines.slice(0, 10).map((entry) => ({
      entryNumber: entry.entryNumber ?? '',
      entryDate: entry.entryDate ? String(entry.entryDate).slice(0, 10) : '',
      description: entry.description ?? '',
      debit: entry.debitAmount,
      credit: entry.creditAmount,
    }));

    return NextResponse.json({
      data,
      success: true,
      warnings,
    });
  } catch (err) {
    logFinanceRouteError('finance.dashboard', 'summary', err);
    return NextResponse.json(
      {
        data: buildEmptyFinanceDashboardData(),
        success: true,
        warnings: ['Some finance summary data could not be loaded. Please refresh or contact support.'],
      },
      { status: 200 },
    );
  }
}
