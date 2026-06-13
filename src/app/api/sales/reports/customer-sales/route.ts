import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'reports.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service.from('invoices').select('invoice_number, total, customers(name)').order('invoice_date', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).map((value) => {
      const row = value as Record<string, unknown> & { customers?: { name?: string } | Array<{ name?: string }> | null };
      return {
        customerName: Array.isArray(row.customers) ? row.customers[0]?.name ?? 'Unknown customer' : row.customers?.name ?? 'Unknown customer',
        invoiceNumber: row.invoice_number,
        total: Number(row.total ?? 0),
      };
    });
    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
