import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { computeAttendancePayload, hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read')) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20', 10));
  const employeeId = searchParams.get('employeeId') ?? '';
  const shift = searchParams.get('shift') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';

  const service = hrService();

  let query = service
    .from('hr_attendance_records')
    .select(
      '*, employee:employees(id, first_name, last_name, full_name, employee_number, branch_id, department), shiftDefinition:hr_shift_definitions(id, shift_name, start_time, end_time)',
      { count: 'exact' },
    )
    .eq('organization_id', ctx.organizationId);

  if (ctx.isBranchScoped) {
    query = query.eq('branch_id', ctx.branchId!);
  }

  if (employeeId) query = query.eq('employee_id', employeeId);
  if (shift) query = query.eq('shift_name', shift);
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
    shift_definition_id?: string;
    attendance_status?: string;
    check_in?: string;
    check_out?: string;
    hours_worked?: number;
    notes?: string;
    remarks?: string;
    branch_id?: string;
    schedule_id?: string;
  };

  if (!body.employee_id || !body.attendance_date || !body.shift) {
    return badRequest('employee_id, attendance_date, and shift are required');
  }

  if (body.check_in && body.check_out && new Date(body.check_out).getTime() === new Date(body.check_in).getTime()) {
    return badRequest('Clock out time must be after clock in time.');
  }

  const service = hrService();
  const computed = await computeAttendancePayload({
    attendanceStatus: body.attendance_status ?? 'PRESENT',
    checkIn: body.check_in ?? null,
    checkOut: body.check_out ?? null,
    shiftDate: body.attendance_date,
    shiftDefinitionId: body.shift_definition_id ?? null,
    shiftName: body.shift,
  });

  const { data: existing } = await service
    .from('hr_attendance_records')
    .select('id')
    .eq('employee_id', body.employee_id)
    .eq('attendance_date', body.attendance_date)
    .eq('shift_name', body.shift)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'Attendance record already exists for this employee, date, and shift' },
      { status: 409 },
    );
  }

  const shiftDefinitionId = body.shift_definition_id ?? null;

  const { data, error } = await service
    .from('hr_attendance_records')
    .insert({
      approval_status: 'DRAFT',
      attendance_date: body.attendance_date,
      attendance_status: String(body.attendance_status ?? 'PRESENT').toUpperCase(),
      branch_id: body.branch_id ?? ctx.branchId ?? null,
      clock_in_time: body.check_in ?? null,
      clock_out_time: body.check_out ?? null,
      created_by: ctx.userId,
      employee_id: body.employee_id,
      hours_worked: body.hours_worked ?? computed.hoursWorked,
      late_minutes: computed.lateMinutes,
      organization_id: ctx.organizationId,
      overtime_hours: computed.overtimeHours,
      remarks: body.remarks ?? body.notes ?? null,
      schedule_id: body.schedule_id ?? null,
      shift_definition_id: shiftDefinitionId,
      shift_name: body.shift,
      updated_by: ctx.userId,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  await service.from('attendances').upsert({
    approval_status: 'DRAFT',
    approved_at: null,
    approved_by: null,
    attendance_date: body.attendance_date,
    attendance_status: String(body.attendance_status ?? 'PRESENT').toUpperCase(),
    branch_id: body.branch_id ?? ctx.branchId ?? null,
    check_in: body.check_in ?? null,
    check_out: body.check_out ?? null,
    employee_id: body.employee_id,
    hours_worked: body.hours_worked ?? computed.hoursWorked,
    late_minutes: computed.lateMinutes,
    notes: body.remarks ?? body.notes ?? null,
    organization_id: ctx.organizationId,
    overtime_hours: computed.overtimeHours,
    schedule_id: body.schedule_id ?? null,
    shift: body.shift,
    shift_definition_id: shiftDefinitionId,
  }, { onConflict: 'employee_id,attendance_date,shift' });

  await writeHrAuditLog('HR_ATTENDANCE_RECORDED', String(data.id), ctx.userId, data as Record<string, unknown>, 'attendance_record');

  return NextResponse.json(data, { status: 201 });
}
