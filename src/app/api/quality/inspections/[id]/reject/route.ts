import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { emitOperationalNotifications } from '@/lib/notifications-server';
import { qualityService, writeQualityAuditLog } from '@/lib/quality-server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write')) return forbidden();
  try {
    const { id } = await params;
    const body = await request.json() as { note?: string };
    if (!body.note) return badRequest('note is required');
    const { data, error } = await qualityService()
      .from('quality_inspections')
      .update({ qc_status: 'REJECTED', remarks: body.note, approved_by: ctx.userId, approved_at: new Date().toISOString() })
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return notFound('Quality inspection not found');
    await writeQualityAuditLog('QUALITY_INSPECTION_REJECTED', id, ctx.userId, { note: body.note }, 'quality_inspection');
    await emitOperationalNotifications({
      actorUserId: ctx.userId,
      documentId: id,
      documentType: 'quality_inspection',
      eventType: 'QC_FAILED',
      message: body.note,
      metadata: {
        inspectionId: id,
        note: body.note,
      },
      moduleName: 'quality',
      organizationId: ctx.organizationId,
      recipientRoleNames: ['Quality Controller', 'Production Manager', 'Stores Manager', 'Management'],
      severity: 'HIGH',
      title: 'Quality inspection failed',
    });
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
