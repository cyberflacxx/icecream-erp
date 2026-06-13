import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildReceivablesRows } from '@/lib/finance';
import { financeService } from '@/lib/finance-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'reports.read')) return forbidden();

  try {
    const service = financeService();
    const { data, error } = await service
      .from('invoices')
      .select('invoice_number, total, balance_due, due_date, status, customer_name:customers(name)')
      .is('deleted_at', null)
      .order('due_date', { ascending: true });
    if (error) throw error;

    const rows = (data ?? []).map((value) => {
      const row = value as Record<string, unknown> & { customer_name?: { name?: string } | Array<{ name?: string }> | null };
      return {
        ...row,
        customer_name: Array.isArray(row.customer_name) ? row.customer_name[0]?.name ?? 'Walk-in' : row.customer_name?.name ?? 'Walk-in',
      };
    });
    return NextResponse.json(buildReceivablesRows(rows));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
