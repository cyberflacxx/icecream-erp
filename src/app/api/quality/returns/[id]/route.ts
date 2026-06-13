import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const { id } = await params;
    const body = await request.json() as { qcStatus?: string; status?: string };
    const existing = await qualityService().from('goods_return_vouchers').select('id, posted_at').eq('organization_id', ctx.organizationId).eq('id', id).single();
    if (existing.error || !existing.data) return notFound('Goods return voucher not found');
    if (existing.data.posted_at) return badRequest('Posted QC records must not be edited');
    const { data, error } = await qualityService().from('goods_return_vouchers').update({
      qc_status: body.qcStatus,
      status: body.status,
      updated_by: ctx.userId,
    }).eq('organization_id', ctx.organizationId).eq('id', id).select().single();
    if (error) throw error;
    await writeQualityAuditLog('GOODS_RETURN_VOUCHER_UPDATED', id, ctx.userId, body as Record<string, unknown>, 'goods_return_voucher');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
