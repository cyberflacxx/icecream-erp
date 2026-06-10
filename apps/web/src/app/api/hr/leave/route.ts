import { NextRequest, NextResponse } from 'next/server';

import {
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read')) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const employeeId = searchParams.get('employeeId') ?? '';
  const status = searchParams.get('status') ?? '';

  const service = createServiceRoleClient();

  let query = service
    .from('leave_applications')
    .select('*', { count: 'exact' })
    .is('deleted_at', null);

  if (ctx.isBranchScoped) {
    // Scope via employee — inner join approach
    query = query.eq('employees.branch_id', ctx.branchId!);
  }

  if (employeeId) query = query.eq('employee_id', employeeId);
  if (status) query = query.eq('status', status);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return serverError(error.message);

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  const body = await request.json() as {
    employee_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    days_requested: number;
    reason?: string;
  };

  if (!body.employee_id || !body.leave_type || !body.start_date || !body.end_date || body.days_requested === undefined) {
    return NextResponse.json(
      { error: 'employee_id, leave_type, start_date, end_date, and days_requested are required' },
      { status: 400 }
    );
  }

  const service = createServiceRoleClient();

  const { data, error } = await service
    .from('leave_applications')
    .insert({
      organization_id: ctx.organizationId,
      employee_id: body.employee_id,
      leave_type: body.leave_type,
      start_date: body.start_date,
      end_date: body.end_date,
      days_requested: body.days_requested,
      reason: body.reason ?? null,
      status: 'PENDING',
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
