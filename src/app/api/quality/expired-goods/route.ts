import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { calculateExpiredGoodsValue } from '@/lib/quality';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read')) return forbidden();
  try {
    const { data, error } = await qualityService().from('expired_goods_records').select('*').eq('organization_id', ctx.organizationId).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const body = await request.json() as { batchNumber?: string; expiryDate?: string; itemId: string; quantityExpired: number; remarks?: string; unitCost: number; warehouseId?: string };
    if (!body.itemId || Number(body.quantityExpired) <= 0) return badRequest('itemId and quantityExpired are required');
    const totalValue = calculateExpiredGoodsValue(body.quantityExpired, body.unitCost);
    const { data, error } = await qualityService().from('expired_goods_records').insert({
      organization_id: ctx.organizationId,
      item_id: body.itemId,
      warehouse_id: body.warehouseId ?? null,
      batch_number: body.batchNumber ?? null,
      expiry_date: body.expiryDate ?? null,
      quantity_expired: body.quantityExpired,
      unit_cost: body.unitCost,
      total_value: totalValue,
      remarks: body.remarks ?? null,
      recorded_by: ctx.userId,
    }).select().single();
    if (error) throw error;
    await writeQualityAuditLog('EXPIRED_GOODS_CREATED', data.id, ctx.userId, { totalValue }, 'expired_goods');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
