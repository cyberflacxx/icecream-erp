import { NextRequest } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({})) as { reason?: string };
    const service = hrService();
    const { data: existing, error: fetchError } = await service.from('hr_overtime_records').select('id').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Overtime record not found.');

    const update = {
      rejection_reason: body.reason ?? null,
      rejected_at: new Date().toISOString(),
      rejected_by: ctx.userId,
      status: 'REJECTED',
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await service.from('hr_overtime_records').update(update).eq('id', id).select().single();
    if (error) throw error;
    await writeHrAuditLog('HR_OVERTIME_REJECTED', id, ctx.userId, update, 'overtime_record');
    return Response.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to reject overtime.');
  }
}
