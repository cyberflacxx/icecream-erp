import { NextRequest, NextResponse } from 'next/server';
import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const { id } = await params;
    const { data, error } = await qualityService().from('market_quality_reports').update({
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
      updated_by: ctx.userId,
    }).eq('organization_id', ctx.organizationId).eq('id', id).select().single();
    if (error || !data) return notFound('Market report not found');
    await writeQualityAuditLog('MARKET_REPORT_SUBMITTED', id, ctx.userId, {}, 'market_report');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
