import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'reports.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service.from('sales_orders').select('order_number, total, branches(name)').order('order_date', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).map((value) => {
      const row = value as Record<string, unknown> & { branches?: { name?: string } | Array<{ name?: string }> | null };
      return {
        branchName: Array.isArray(row.branches) ? row.branches[0]?.name ?? 'Unknown branch' : row.branches?.name ?? 'Unknown branch',
        orderNumber: row.order_number,
        total: Number(row.total ?? 0),
      };
    });
    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
