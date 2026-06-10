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
  const shift = searchParams.get('shift') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';

  const service = createServiceRoleClient();

  let query = service
    .from('attendances')
    .select(
      `*, employee:employees(id, first_name, last_name, employee_number)`,
      { count: 'exact' }
    );

  if (ctx.isBranchScoped) {
    // Scope via employee branch
    query = query.eq('employees.branch_id', ctx.branchId!);
  }

  if (employeeId) query = query.eq('employee_id', employeeId);
  if (shift) query = query.eq('shift', shift);
  if (dateFrom) query = query.gte('attendance_date', dateFrom);
  if (dateTo) query = query.lte('attendance_date', dateTo);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('attendance_date', { ascending: false })
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
    attendance_date: string;
    shift: string;
    check_in?: string;
    check_out?: string;
    hours_worked?: number;
    notes?: string;
  };

  if (!body.employee_id || !body.attendance_date || !body.shift) {
    return NextResponse.json(
      { error: 'employee_id, attendance_date, and shift are required' },
      { status: 400 }
    );
  }

  const service = createServiceRoleClient();

  // Duplicate check (employee + date + shift must be unique)
  const { data: existing } = await service
    .from('attendances')
    .select('id')
    .eq('employee_id', body.employee_id)
    .eq('attendance_date', body.attendance_date)
    .eq('shift', body.shift)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'Attendance record already exists for this employee, date, and shift' },
      { status: 409 }
    );
  }

  const { data, error } = await service
    .from('attendances')
    .insert({
      organization_id: ctx.organizationId,
      employee_id: body.employee_id,
      attendance_date: body.attendance_date,
      shift: body.shift,
      check_in: body.check_in ?? null,
      check_out: body.check_out ?? null,
      hours_worked: body.hours_worked ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
