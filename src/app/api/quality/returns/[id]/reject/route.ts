import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const { id } = await params;
    const body = await request.json() as { note?: string };
    if (!body.note) return badRequest('note is required');
    const { data, error } = await qualityService().from('goods_return_vouchers').update({
      qc_status: 'REJECTED',
      status: 'REJECTED',
      void_reason: body.note,
      voided_by: ctx.userId,
      voided_at: new Date().toISOString(),
    }).eq('organization_id', ctx.organizationId).eq('id', id).select().single();
    if (error || !data) return notFound('Goods return voucher not found');
    await writeQualityAuditLog('GOODS_RETURN_VOUCHER_REJECTED', id, ctx.userId, { note: body.note }, 'goods_return_voucher');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
