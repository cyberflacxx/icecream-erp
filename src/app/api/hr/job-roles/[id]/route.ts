import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const service = hrService();
    const { data: existing, error: fetchError } = await service.from('hr_job_roles').select('id').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Job role not found.');

    const updates = {
      department_id: body.department_id ?? undefined,
      description: body.description ?? undefined,
      is_active: body.active_status ?? body.is_active ?? undefined,
      role_name: body.job_role_name ?? body.role_name ?? undefined,
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    };
    const { data, error } = await service.from('hr_job_roles').update(updates).eq('id', id).select().single();
    if (error) throw error;
    await writeHrAuditLog('HR_JOB_ROLE_UPDATED', id, ctx.userId, updates, 'job_role');
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to update job role.');
  }
}
