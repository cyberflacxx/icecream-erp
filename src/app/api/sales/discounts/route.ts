import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { ensureNonNegative } from '@/lib/inventory';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service
      .from('sales_discount_rules')
      .select('id, name, discount_type, discount_value, maximum_allowed_discount, approval_required, approval_status, is_active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  try {
    const body = await request.json() as {
      approvalRequired?: boolean;
      customerGroupId?: string;
      discountType?: string;
      discountValue: number;
      itemId?: string;
      maximumAllowedDiscount?: number;
      minimumQuantity?: number;
      name?: string;
    };
    if (!body.name?.trim()) return badRequest('name is required.');
    ensureNonNegative(body.discountValue, 'discountValue');

    const service = salesService();
    const { data, error } = await service
      .from('sales_discount_rules')
      .insert({
        approval_required: Boolean(body.approvalRequired),
        approval_status: body.approvalRequired ? 'PENDING' : 'APPROVED',
        customer_group_id: body.customerGroupId ?? null,
        discount_type: body.discountType ?? 'PERCENTAGE',
        discount_value: body.discountValue,
        is_active: true,
        item_id: body.itemId ?? null,
        maximum_allowed_discount: body.maximumAllowedDiscount ?? null,
        minimum_quantity: body.minimumQuantity ?? 0,
        name: body.name.trim(),
      })
      .select()
      .single();
    if (error) throw error;

    await writeSalesAuditLog('SALES_DISCOUNT_CREATED', String(data.id), ctx.userId, data, 'sales_discount_rule');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
