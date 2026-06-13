import { NextRequest, NextResponse } from 'next/server';
import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const { id } = await params;
    const { data, error } = await qualityService().from('goods_return_vouchers').update({
      qc_status: 'APPROVED',
      status: 'STOCK_MOVED',
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
      posted_by: ctx.userId,
      posted_at: new Date().toISOString(),
    }).eq('organization_id', ctx.organizationId).eq('id', id).select().single();
    if (error || !data) return notFound('Goods return voucher not found');
    await writeQualityAuditLog('GOODS_RETURN_VOUCHER_APPROVED', id, ctx.userId, {}, 'goods_return_voucher');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
