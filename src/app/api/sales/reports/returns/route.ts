import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'reports.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service.from('customer_returns').select('return_number, return_date, reason, total_value, status, qc_status').is('deleted_at', null);
    if (error) throw error;
    return NextResponse.json((data ?? []).map((row) => ({
      qcStatus: row.qc_status,
      reason: row.reason,
      returnDate: row.return_date,
      returnNumber: row.return_number,
      status: row.status,
      totalValue: Number(row.total_value ?? 0),
    })));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
