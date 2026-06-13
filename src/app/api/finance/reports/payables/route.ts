import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildPayablesRows } from '@/lib/finance';
import { financeService } from '@/lib/finance-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read', 'reports.read')) return forbidden();

  try {
    const service = financeService();
    const { data, error } = await service
      .from('supplier_invoices')
      .select('invoice_number, total_amount, amount_due, due_date, status, supplier_name:suppliers(name)')
      .order('due_date', { ascending: true });
    if (error) throw error;

    const rows = (data ?? []).map((value) => {
      const row = value as Record<string, unknown> & { supplier_name?: { name?: string } | Array<{ name?: string }> | null };
      return {
        amount_due: row.amount_due,
        due_date: row.due_date,
        invoice_number: row.invoice_number,
        status: row.status,
        supplier_name: Array.isArray(row.supplier_name) ? row.supplier_name[0]?.name ?? 'Unknown supplier' : row.supplier_name?.name ?? 'Unknown supplier',
        total_amount: row.total_amount,
      };
    });
    return NextResponse.json(buildPayablesRows(rows));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
