import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read', 'production.read')) return forbidden();
  try {
    const { data, error } = await qualityService().from('rework_records').select('*').eq('organization_id', ctx.organizationId).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write', 'production.write')) return forbidden();
  try {
    const body = await request.json() as { itemId?: string; productionBatchId?: string; quantity: number; reason: string };
    if (!body.reason || Number(body.quantity) <= 0) return badRequest('quantity and reason are required');
    const { data, error } = await qualityService().from('rework_records').insert({
      organization_id: ctx.organizationId,
      production_batch_id: body.productionBatchId ?? null,
      item_id: body.itemId ?? null,
      quantity: body.quantity,
      reason: body.reason,
      created_by: ctx.userId,
    }).select().single();
    if (error) throw error;
    await writeQualityAuditLog('REWORK_RECORD_CREATED', data.id, ctx.userId, { quantity: body.quantity }, 'rework_record');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
