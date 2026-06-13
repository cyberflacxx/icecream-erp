import { NextRequest, NextResponse } from 'next/server';
import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write', 'inventory.write')) return forbidden();
  try {
    const { id } = await params;
    const { data, error } = await qualityService().from('reusable_stock_approvals').update({
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
    }).eq('organization_id', ctx.organizationId).eq('id', id).select().single();
    if (error || !data) return notFound('Reusable stock approval not found');
    await writeQualityAuditLog('REUSABLE_STOCK_APPROVED', id, ctx.userId, {}, 'reusable_stock');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
