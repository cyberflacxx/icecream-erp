import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  calculateBranchCostSummary,
  calculateInventoryValuation,
  calculateProductionCostSummary,
  summarizeProfitAndLossFromLedger,
} from '@/lib/finance';
import {
  financeErrorMessage,
  isMissingFinanceColumn,
  isMissingFinanceTable,
  loadLedgerLines,
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

    const [
      payments,
      branchExpenses,
      overdueInvoices,
      supplierInvoices,
      supplierPayments,
      bankAccounts,
      cashAccounts,
      pettyCashRequests,
      financeExpenses,
      stockBalances,
      branchSales,
      productionBatches,
      ledgerLines,
    ] = await Promise.all([
        optionalQuery(
          service
            .schema('icecream_erp')
            .from('payments')
            .select('id, payment_date, amount, payment_method')
            .gte('payment_date', `${startDate}T00:00:00.000Z`)
            .lte('payment_date', `${endDate}T23:59:59.999Z`)
            .order('payment_date', { ascending: true }),
        ),

        optionalQuery(queryWithoutDeletedAt(
          service
          .schema('icecream_erp')
          .from('branch_expenses')
          .select('id, expense_date, amount')
          .is('deleted_at', null)
          .gte('expense_date', `${startDate}T00:00:00.000Z`)
          .lte('expense_date', `${endDate}T23:59:59.999Z`)
          .order('expense_date', { ascending: true }),
          () => service
            .schema('icecream_erp')
            .from('branch_expenses')
            .select('id, expense_date, amount')
            .gte('expense_date', `${startDate}T00:00:00.000Z`)
            .lte('expense_date', `${endDate}T23:59:59.999Z`)
            .order('expense_date', { ascending: true }),
        )),

        optionalQuery(queryWithoutDeletedAt(
          service
          .schema('icecream_erp')
          .from('invoices')
          .select('id, invoice_number, status, due_date, balance_due, customers(name)')
          .is('deleted_at', null)
          .in('status', ['SENT', 'PARTIAL_PAID', 'OVERDUE'])
          .order('due_date', { ascending: true })
          .limit(8),
          () => service
            .schema('icecream_erp')
            .from('invoices')
            .select('id, invoice_number, status, due_date, balance_due, customers(name)')
            .in('status', ['SENT', 'PARTIAL_PAID', 'OVERDUE'])
            .order('due_date', { ascending: true })
            .limit(8),
        )),
        optionalQuery(queryWithoutDeletedAt(
          service
          .schema('icecream_erp')
          .from('supplier_invoices')
          .select('id, invoice_total')
          .is('deleted_at', null),
          () => service.schema('icecream_erp').from('supplier_invoices').select('id, invoice_total'),
        )),
        optionalQuery(queryWithoutDeletedAt(
          service
          .schema('icecream_erp')
          .from('supplier_payments')
          .select('supplier_invoice_id, amount_paid')
          .is('deleted_at', null),
          () => service.schema('icecream_erp').from('supplier_payments').select('supplier_invoice_id, amount_paid'),
        )),
        optionalQuery(queryWithoutDeletedAt(
          service
          .schema('icecream_erp')
          .from('bank_accounts')
          .select('current_balance')
          .is('deleted_at', null),
          () => service.schema('icecream_erp').from('bank_accounts').select('current_balance'),
        )),
        optionalQuery(queryWithoutDeletedAt(
          service
          .schema('icecream_erp')
          .from('cash_accounts')
          .select('balance')
          .is('deleted_at', null),
          () => service.schema('icecream_erp').from('cash_accounts').select('balance'),
        )),
        optionalQuery(queryWithoutDeletedAt(
          service
          .schema('icecream_erp')
          .from('petty_cash_requests')
          .select('amount_requested, status')
          .is('deleted_at', null),
          () => service.schema('icecream_erp').from('petty_cash_requests').select('amount_requested, status'),
        )),
        optionalQuery(queryWithoutDeletedAt(
          service
          .schema('icecream_erp')
          .from('finance_expenses')
          .select('amount, status')
          .is('deleted_at', null),
          () => service.schema('icecream_erp').from('finance_expenses').select('amount, status'),
        )),
        optionalQuery(
          service
            .schema('icecream_erp')
            .from('stock_balances')
            .select('quantity, quantity_on_hand, items(standard_cost, unit_cost)')
            .eq('organization_id', ctx.organizationId),
        ),
        optionalQuery(queryWithoutDeletedAt(
          service
          .schema('icecream_erp')
          .from('branch_sales')
          .select('sale_date, total_amount')
          .is('deleted_at', null),
          () => service.schema('icecream_erp').from('branch_sales').select('sale_date, total_amount'),
        )),
        (async () => {
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
        })(),
        loadLedgerLines(ctx.organizationId),
      ]);

    const revenueByDay = new Map<string, number>();
    const expenseByDay = new Map<string, number>();
    const paymentMethodMap = new Map<string, number>();

    const effectivePayments = payments.length > 0
      ? payments
      : (branchSales as Array<Record<string, unknown>>).map((sale) => ({
          payment_date: String(sale.sale_date ?? new Date().toISOString().slice(0, 10)),
          amount: Number(sale.total_amount ?? 0),
          payment_method: 'SALES',
        }));

    for (const p of effectivePayments) {
      const day = p.payment_date.slice(0, 10);
      const amount = Number(p.amount ?? 0);
      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + amount);
      paymentMethodMap.set(p.payment_method, (paymentMethodMap.get(p.payment_method) ?? 0) + amount);
    }

    for (const e of branchExpenses ?? []) {
      const day = e.expense_date.slice(0, 10);
      expenseByDay.set(day, (expenseByDay.get(day) ?? 0) + Number(e.amount ?? 0));
    }

    const cashflowDays = new Set([...revenueByDay.keys(), ...expenseByDay.keys()]);
    const cashflowLast7Days = Array.from(cashflowDays)
      .sort()
      .map((day) => ({ day, revenue: revenueByDay.get(day) ?? 0, expenses: expenseByDay.get(day) ?? 0 }));

    const outstandingReceivables = overdueInvoices.reduce(
      (sum: number, inv: { balance_due: number }) => sum + Number(inv.balance_due ?? 0), 0
    );
    const totalRevenue = effectivePayments.reduce((sum: number, p: { amount: number }) => sum + Number(p.amount ?? 0), 0);
    const totalBranchExpenses = branchExpenses.reduce((sum: number, e: { amount: number }) => sum + Number(e.amount ?? 0), 0);
    const totalFinanceExpenses = financeExpenses.reduce((sum: number, e: { amount: number }) => sum + Number(e.amount ?? 0), 0);
    const totalExpenses = totalBranchExpenses + totalFinanceExpenses;
    const grossProfitSummary = summarizeProfitAndLossFromLedger(ledgerLines);
    const outstandingPayables = Math.max(
      0,
      supplierInvoices.reduce((sum: number, inv: { invoice_total: number }) => sum + Number(inv.invoice_total ?? 0), 0) -
        supplierPayments.reduce((sum: number, p: { amount_paid: number }) => sum + Number(p.amount_paid ?? 0), 0),
    );
    const bankBalance = bankAccounts.reduce((sum: number, row: { current_balance: number }) => sum + Number(row.current_balance ?? 0), 0);
    const cashBalance = cashAccounts.reduce((sum: number, row: { balance: number }) => sum + Number(row.balance ?? 0), 0);
    const pettyCashBalance = pettyCashRequests
      .filter((row: { status: string }) => row.status === 'APPROVED')
      .reduce((sum: number, row: { amount_requested: number }) => sum + Number(row.amount_requested ?? 0), 0);
    const stockValuation = stockBalances.reduce((sum: number, row: Record<string, unknown>) => {
      const item = Array.isArray(row.items) ? row.items[0] : row.items;
      return sum + calculateInventoryValuation(
        Number(row.quantity ?? row.quantity_on_hand ?? 0),
        Number((item as { standard_cost?: number } | null)?.standard_cost ?? (item as { unit_cost?: number } | null)?.unit_cost ?? 0),
      );
    }, 0);
    const productionCost = productionBatches.reduce((sum: number, row: Record<string, unknown>) => {
      const summary = calculateProductionCostSummary(
        Number(row.material_cost ?? row.total_material_cost ?? 0),
        Number(row.labour_cost ?? row.total_labour_cost ?? 0),
        Number(row.overhead_cost ?? row.total_overhead_cost ?? 0),
        Number(row.actual_output_quantity ?? row.actual_qty ?? 0),
      );
      return sum + summary.totalCost;
    }, 0);
    const branchProfitability = calculateBranchCostSummary(
      branchSales.reduce((sum: number, row: { total_amount: number }) => sum + Number(row.total_amount ?? 0), 0),
      0,
      totalBranchExpenses,
      0,
    ).netProfit;
    const pendingApprovals =
      pettyCashRequests.filter((row: { status: string }) => row.status === 'PENDING').length +
      financeExpenses.filter((row: { status: string }) => row.status === 'DRAFT' || row.status === 'PENDING_APPROVAL').length;

    return NextResponse.json({
      stats: {
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
      },
      charts: {
        cashflowLast7Days,
        paymentMethodBreakdown: Array.from(paymentMethodMap.entries()).map(([method, total]) => ({ method, total })),
      },
      overdueInvoices: overdueInvoices.map((inv: Record<string, unknown>) => {
        const customers = inv.customers as { name?: string } | Array<{ name?: string }> | null;
        const customer = Array.isArray(customers) ? customers[0] : customers;
        return {
          invoiceNumber: String(inv.invoice_number ?? ''),
          status: String(inv.status ?? ''),
          dueDate: inv.due_date ? String(inv.due_date).slice(0, 10) : 'N/A',
          balance: Number(inv.balance_due ?? 0),
          customer: customer?.name ?? 'Walk-in',
        };
      }),
      recentEntries: ledgerLines.slice(0, 10).map((entry) => ({
        entryNumber: entry.entryNumber ?? '',
        entryDate: entry.entryDate ? String(entry.entryDate).slice(0, 10) : '',
        description: entry.description ?? '',
        debit: entry.debitAmount,
        credit: entry.creditAmount,
      })),
    });
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
