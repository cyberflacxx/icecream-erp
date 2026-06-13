import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildInvoiceAgeingRows } from '@/lib/sales';
import { salesService } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'reports.read', 'finance.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service.from('invoices').select('invoice_number, invoice_date, due_date, total, balance_due, status, customer_name:customers(name)');
    if (error) throw error;
    const rows = (data ?? []).map((value) => {
      const row = value as Record<string, unknown> & { customer_name?: { name?: string } | Array<{ name?: string }> | null };
      return {
        ...row,
        customer_name: Array.isArray(row.customer_name) ? row.customer_name[0]?.name ?? 'Unknown customer' : row.customer_name?.name ?? 'Unknown customer',
      };
    });
    return NextResponse.json(buildInvoiceAgeingRows(rows));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
