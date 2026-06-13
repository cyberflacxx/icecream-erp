import { NextRequest, NextResponse } from 'next/server';
import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const { id } = await params;
    const { data, error } = await qualityService()
      .from('quality_inspections')
      .update({ qc_status: 'IN_PROGRESS', inspected_by: ctx.userId, inspected_at: new Date().toISOString() })
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return notFound('Quality inspection not found');
    await writeQualityAuditLog('QUALITY_INSPECTION_SUBMITTED', id, ctx.userId, {}, 'quality_inspection');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
