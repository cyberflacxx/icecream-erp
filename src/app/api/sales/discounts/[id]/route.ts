import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (body.discountValue !== undefined) updates.discount_value = Number(body.discountValue);
    if (body.maximumAllowedDiscount !== undefined) updates.maximum_allowed_discount = Number(body.maximumAllowedDiscount);
    if (body.isActive !== undefined) updates.is_active = Boolean(body.isActive);
    if (body.approvalRequired !== undefined) updates.approval_required = Boolean(body.approvalRequired);

    const service = salesService();
    const { data, error } = await service.from('sales_discount_rules').update(updates).eq('id', id).select().single();
    if (error) throw error;

    await writeSalesAuditLog('SALES_DISCOUNT_UPDATED', id, ctx.userId, updates, 'sales_discount_rule');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
