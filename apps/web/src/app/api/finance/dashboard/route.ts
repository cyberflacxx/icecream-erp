import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const startDate = searchParams.get('startDate') ?? sevenDaysAgo.toISOString().slice(0, 10);
    const endDate = searchParams.get('endDate') ?? today.toISOString().slice(0, 10);

    const [{ data: payments }, { data: expenses }, { data: overdueInvoices }, { data: recentEntries }] =
      await Promise.all([
        service
          .schema('icecream_erp')
          .from('payments')
          .select('id, payment_date, amount, payment_method')
          .gte('payment_date', `${startDate}T00:00:00.000Z`)
          .lte('payment_date', `${endDate}T23:59:59.999Z`)
          .order('payment_date', { ascending: true }),

        service
          .schema('icecream_erp')
          .from('branch_expenses')
          .select('id, expense_date, amount')
          .is('deleted_at', null)
          .gte('expense_date', `${startDate}T00:00:00.000Z`)
          .lte('expense_date', `${endDate}T23:59:59.999Z`)
          .order('expense_date', { ascending: true }),

        service
          .schema('icecream_erp')
          .from('invoices')
          .select('id, invoice_number, status, due_date, balance_due, customers(name)')
          .is('deleted_at', null)
          .in('status', ['SENT', 'PARTIAL_PAID', 'OVERDUE'])
          .order('due_date', { ascending: true })
          .limit(8),

        service
          .schema('icecream_erp')
          .from('journal_entries')
          .select('id, entry_number, entry_date, description, journal_entry_lines(debit_amount, credit_amount)')
          .gte('entry_date', `${startDate}T00:00:00.000Z`)
          .lte('entry_date', `${endDate}T23:59:59.999Z`)
          .order('entry_date', { ascending: false })
          .limit(10),
      ]);

    const revenueByDay = new Map<string, number>();
    const expenseByDay = new Map<string, number>();
    const paymentMethodMap = new Map<string, number>();

    for (const p of payments ?? []) {
      const day = p.payment_date.slice(0, 10);
      const amount = Number(p.amount ?? 0);
      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + amount);
      paymentMethodMap.set(p.payment_method, (paymentMethodMap.get(p.payment_method) ?? 0) + amount);
    }

    for (const e of expenses ?? []) {
      const day = e.expense_date.slice(0, 10);
      expenseByDay.set(day, (expenseByDay.get(day) ?? 0) + Number(e.amount ?? 0));
    }

    const cashflowDays = new Set([...revenueByDay.keys(), ...expenseByDay.keys()]);
    const cashflowLast7Days = Array.from(cashflowDays)
      .sort()
      .map((day) => ({ day, revenue: revenueByDay.get(day) ?? 0, expenses: expenseByDay.get(day) ?? 0 }));

    const outstandingReceivables = (overdueInvoices ?? []).reduce(
      (sum: number, inv: { balance_due: number }) => sum + Number(inv.balance_due ?? 0), 0
    );

    return NextResponse.json({
      stats: {
        revenue: (payments ?? []).reduce((sum: number, p: { amount: number }) => sum + Number(p.amount ?? 0), 0),
        payments: payments?.length ?? 0,
        outstandingReceivables,
        outstandingPayables: 0,
      },
      charts: {
        cashflowLast7Days,
        paymentMethodBreakdown: Array.from(paymentMethodMap.entries()).map(([method, total]) => ({ method, total })),
      },
      overdueInvoices: (overdueInvoices ?? []).map((inv: Record<string, unknown>) => {
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
      recentEntries: (recentEntries ?? []).map((entry: { entry_number: string; entry_date: string; description: string; journal_entry_lines: Array<{ debit_amount: number; credit_amount: number }> }) => ({
        entryNumber: entry.entry_number,
        entryDate: entry.entry_date.slice(0, 10),
        description: entry.description,
        debit: (entry.journal_entry_lines ?? []).reduce((s: number, l: { debit_amount: number }) => s + Number(l.debit_amount ?? 0), 0),
        credit: (entry.journal_entry_lines ?? []).reduce((s: number, l: { credit_amount: number }) => s + Number(l.credit_amount ?? 0), 0),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
