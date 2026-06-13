import { NextRequest, NextResponse } from 'next/server';
import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const { id } = await params;
    const body = await request.json() as { qualityIssueFound?: string; recommendedAction?: string; status?: string };
    const { data, error } = await qualityService().from('market_quality_reports').update({
      quality_issue_found: body.qualityIssueFound,
      recommended_action: body.recommendedAction,
      status: body.status,
      updated_by: ctx.userId,
    }).eq('organization_id', ctx.organizationId).eq('id', id).select().single();
    if (error || !data) return notFound('Market report not found');
    await writeQualityAuditLog('MARKET_REPORT_UPDATED', id, ctx.userId, body as Record<string, unknown>, 'market_report');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
