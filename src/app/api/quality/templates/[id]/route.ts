import { NextRequest, NextResponse } from 'next/server';
import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const { id } = await params;
    const body = await request.json() as { activeStatus?: boolean; templateName?: string };
    const { data, error } = await qualityService().from('quality_check_templates').update({
      active_status: body.activeStatus,
      template_name: body.templateName,
      updated_by: ctx.userId,
    }).eq('organization_id', ctx.organizationId).eq('id', id).select().single();
    if (error || !data) return notFound('Quality template not found');
    await writeQualityAuditLog('QUALITY_TEMPLATE_UPDATED', id, ctx.userId, body as Record<string, unknown>, 'quality_template');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
