import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (body.sellingPrice !== undefined) updates.selling_price = Number(body.sellingPrice);
    if (body.effectiveDate !== undefined) updates.effective_date = body.effectiveDate || null;
    if (body.expiryDate !== undefined) updates.expiry_date = body.expiryDate || null;
    if (body.isActive !== undefined) updates.is_active = Boolean(body.isActive);

    const service = salesService();
    const { data, error } = await service.from('sales_product_prices').update(updates).eq('id', id).select().single();
    if (error) throw error;

    await writeSalesAuditLog('SALES_PRICE_UPDATED', id, ctx.userId, updates, 'sales_product_price');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
