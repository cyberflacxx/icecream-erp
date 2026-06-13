import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'reports.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service.from('invoice_items').select('quantity, total_price, items(name)').order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).map((value) => {
      const row = value as Record<string, unknown> & { items?: { name?: string } | Array<{ name?: string }> | null };
      return {
        productName: Array.isArray(row.items) ? row.items[0]?.name ?? 'Unknown item' : row.items?.name ?? 'Unknown item',
        quantity: Number(row.quantity ?? 0),
        totalPrice: Number(row.total_price ?? 0),
      };
    });
    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
