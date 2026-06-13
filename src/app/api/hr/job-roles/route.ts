import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read')) return forbidden();

  try {
    const service = hrService();
    const { data, error } = await service
      .from('hr_job_roles')
      .select('*, department:departments(id, code, name)')
      .eq('organization_id', ctx.organizationId)
      .order('role_name');
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load job roles.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  try {
    const body = await request.json() as {
      active_status?: boolean;
      department_id?: string;
      description?: string;
      job_role_name?: string;
    };
    if (!body.job_role_name) return badRequest('job_role_name is required.');

    const service = hrService();
    const { data, error } = await service
      .from('hr_job_roles')
      .insert({
        created_by: ctx.userId,
        department_id: body.department_id ?? null,
        description: body.description ?? null,
        is_active: body.active_status ?? true,
        organization_id: ctx.organizationId,
        role_name: body.job_role_name,
        updated_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;
    await writeHrAuditLog('HR_JOB_ROLE_CREATED', String(data.id), ctx.userId, data as Record<string, unknown>, 'job_role');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to create job role.');
  }
}
