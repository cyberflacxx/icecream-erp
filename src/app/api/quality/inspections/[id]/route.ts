import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const { id } = await params;
    const body = await request.json() as { qcStatus?: string; quantityPassed?: number; quantityFailed?: number; remarks?: string };
    const existing = await qualityService().from('quality_inspections').select('id, posted_at').eq('organization_id', ctx.organizationId).eq('id', id).single();
    if (existing.error || !existing.data) return notFound('Quality inspection not found');
    if (existing.data.posted_at) return badRequest('Posted QC records must not be edited');
    const { data, error } = await qualityService()
      .from('quality_inspections')
      .update({
        qc_status: body.qcStatus,
        quantity_passed: body.quantityPassed,
        quantity_failed: body.quantityFailed,
        remarks: body.remarks,
        updated_by: ctx.userId,
      })
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await writeQualityAuditLog('QUALITY_INSPECTION_UPDATED', id, ctx.userId, body as Record<string, unknown>, 'quality_inspection');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
