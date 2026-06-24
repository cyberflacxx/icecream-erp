import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildReceivablesRows, calculateReceivableBalance } from '@/lib/finance';
import { financeErrorMessage, financeService, isMissingFinanceTable, mapNestedRow } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const [invoicesResult, paymentsResult, creditNotesResult] = await Promise.all([
      financeService()
        .from('invoices')
        .select('id, invoice_number, invoice_date, due_date, total_amount, paid_amount, balance_due, status, customers(name)')
        .eq('organization_id', ctx.organizationId)
        ,
      financeService()
        .from('payments')
        .select('customer_id, amount')
        .eq('organization_id', ctx.organizationId)
        .not('customer_id', 'is', null),
      financeService()
        .from('customer_returns')
        .select('invoice_id, total_value')
        .eq('organization_id', ctx.organizationId)
        .is('deleted_at', null),
    ]);
    if (invoicesResult.error) throw invoicesResult.error;
    if (paymentsResult.error && !isMissingFinanceTable(paymentsResult.error)) throw paymentsResult.error;
    if (creditNotesResult.error && !isMissingFinanceTable(creditNotesResult.error)) throw creditNotesResult.error;

    const creditByInvoice = new Map<string, number>();
    for (const row of creditNotesResult.error ? [] : creditNotesResult.data ?? []) {
      creditByInvoice.set(String(row.invoice_id), (creditByInvoice.get(String(row.invoice_id)) ?? 0) + Number(row.total_value ?? 0));
    }

    const rows = buildReceivablesRows((invoicesResult.data ?? []).map((row) => {
      const customer = mapNestedRow(row.customers as Record<string, unknown> | Array<Record<string, unknown>> | null);
      const balanceDue = calculateReceivableBalance(
        Number(row.total_amount ?? 0),
        Number(row.paid_amount ?? 0),
        creditByInvoice.get(String(row.id)) ?? 0,
      );
      return {
        balance_due: balanceDue,
        customer_name: customer?.name ?? 'Walk-in',
        due_date: row.due_date,
        invoice_date: row.invoice_date,
        invoice_number: row.invoice_number,
        status: row.status,
        total: row.total_amount,
      };
    }));

    return NextResponse.json(rows);
  } catch (err) {
    if (isMissingFinanceTable(err)) return NextResponse.json([]);
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
