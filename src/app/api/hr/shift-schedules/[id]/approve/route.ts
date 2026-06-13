import { NextRequest } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const service = hrService();
    const { data: existing, error: fetchError } = await service.from('hr_shift_schedules').select('id').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Shift schedule not found.');

    const update = {
      approved_at: new Date().toISOString(),
      approved_by: ctx.userId,
      status: 'APPROVED',
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await service.from('hr_shift_schedules').update(update).eq('id', id).select().single();
    if (error) throw error;
    await writeHrAuditLog('HR_SHIFT_SCHEDULE_APPROVED', id, ctx.userId, update, 'shift_schedule');
    return Response.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to approve shift schedule.');
  }
}
