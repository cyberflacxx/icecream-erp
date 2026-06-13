import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read')) return forbidden();
  try {
    const { data, error } = await qualityService().from('waste_disposal_records').select('*').eq('organization_id', ctx.organizationId).order('disposal_date', { ascending: false });
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
    const body = await request.json() as { damagedGoodsRecordId?: string; disposalDate?: string; disposalMethod: string; expiredGoodsRecordId?: string; itemId: string; quantityDisposed: number; remarks?: string; witness?: string };
    if (!body.itemId || !body.disposalMethod || Number(body.quantityDisposed) <= 0) return badRequest('itemId, quantityDisposed, and disposalMethod are required');
    const { data, error } = await qualityService().from('waste_disposal_records').insert({
      organization_id: ctx.organizationId,
      damaged_goods_record_id: body.damagedGoodsRecordId ?? null,
      expired_goods_record_id: body.expiredGoodsRecordId ?? null,
      item_id: body.itemId,
      quantity_disposed: body.quantityDisposed,
      disposal_method: body.disposalMethod,
      disposal_date: body.disposalDate ?? new Date().toISOString().slice(0, 10),
      witness: body.witness ?? null,
      remarks: body.remarks ?? null,
      created_by: ctx.userId,
    }).select().single();
    if (error) throw error;
    await writeQualityAuditLog('WASTE_DISPOSAL_CREATED', data.id, ctx.userId, { quantityDisposed: body.quantityDisposed }, 'waste_disposal');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
