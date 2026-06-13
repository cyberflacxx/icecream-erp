import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'reports.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service.from('invoices').select('invoice_date, total, tax_amount, discount_amount, status').order('invoice_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json((data ?? []).map((row) => ({
      date: row.invoice_date,
      discountAmount: Number(row.discount_amount ?? 0),
      status: row.status,
      taxAmount: Number(row.tax_amount ?? 0),
      total: Number(row.total ?? 0),
    })));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
