import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { EMPLOYEE_STATUSES } from '@/lib/hr';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read')) return forbidden();

  const { id } = await params;
  const service = hrService();

  const { data, error } = await service
    .from('employees')
    .select(`
      *,
      branch:branches(*),
      attendances(*),
      attendanceRecords:hr_attendance_records(*),
      payroll_records(*),
      payrollSummaries:hr_payroll_summaries(*),
      departmentRef:departments(*),
      jobRole:hr_job_roles(*)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Employee not found');

  if (ctx.isBranchScoped && data.branch_id !== ctx.branchId) return forbidden();

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  const { id } = await params;
  const service = hrService();

  const { data: existing, error: fetchErr } = await service
    .from('employees')
    .select('id, branch_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchErr) return serverError(fetchErr.message);
  if (!existing) return notFound('Employee not found');
  if (ctx.isBranchScoped && existing.branch_id !== ctx.branchId) return forbidden();

  const body = await request.json() as Record<string, unknown>;
  if (body.email === '') body.email = null;

  if (body.status && !EMPLOYEE_STATUSES.includes(String(body.status).toUpperCase() as (typeof EMPLOYEE_STATUSES)[number])) {
    return badRequest(`status must be one of: ${EMPLOYEE_STATUSES.join(', ')}.`);
  }

  const updates: Record<string, unknown> = { ...body, updated_at: new Date().toISOString(), updated_by: ctx.userId };
  if (body.employee_code !== undefined && body.employee_number === undefined) {
    updates.employee_number = body.employee_code;
  }
  if (body.full_name && !body.first_name && !body.last_name) {
    const fullName = String(body.full_name).trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    updates.first_name = parts.slice(0, -1).join(' ') || parts[0] ?? '';
    updates.last_name = parts.slice(-1)[0] ?? '';
    updates.full_name = fullName;
  }
  if (body.job_role !== undefined && body.job_title === undefined) {
    updates.job_title = body.job_role;
  }
  if (body.hire_date && typeof body.hire_date === 'string') {
    updates.hire_date = new Date(body.hire_date).toISOString().split('T')[0];
  }

  const { data, error } = await service
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  await writeHrAuditLog('HR_EMPLOYEE_UPDATED', id, ctx.userId, updates, 'employee');

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  const { id } = await params;
  const service = hrService();

  const { data: existing, error: fetchErr } = await service
    .from('employees')
    .select('id, branch_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchErr) return serverError(fetchErr.message);
  if (!existing) return notFound('Employee not found');
  if (ctx.isBranchScoped && existing.branch_id !== ctx.branchId) return forbidden();

  const { data, error } = await service
    .from('employees')
    .update({
      approved_at: new Date().toISOString(),
      approved_by: ctx.userId,
      deleted_at: new Date().toISOString(),
      status: 'TERMINATED',
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  await writeHrAuditLog('HR_EMPLOYEE_DEACTIVATED', id, ctx.userId, { status: 'TERMINATED' }, 'employee');

  return NextResponse.json(data);
}
