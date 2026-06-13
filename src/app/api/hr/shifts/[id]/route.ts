import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { normalizeShiftName } from '@/lib/hr';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const service = hrService();
    const { data: existing, error: fetchError } = await service.from('hr_shift_definitions').select('id').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Shift definition not found.');

    const updates = {
      default_department_id: body.default_department_id ?? undefined,
      end_time: body.end_time ?? undefined,
      is_active: body.active_status ?? body.is_active ?? undefined,
      shift_name: body.shift_name ? normalizeShiftName(String(body.shift_name)) : undefined,
      start_time: body.start_time ?? undefined,
      standard_shift_hours: body.standard_shift_hours ?? undefined,
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    };
    const { data, error } = await service.from('hr_shift_definitions').update(updates).eq('id', id).select().single();
    if (error) throw error;
    await writeHrAuditLog('HR_SHIFT_UPDATED', id, ctx.userId, updates, 'shift_definition');
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to update shift definition.');
  }
}
