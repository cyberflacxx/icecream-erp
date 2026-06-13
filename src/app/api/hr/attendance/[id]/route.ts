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
import { computeAttendancePayload, hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read')) return forbidden();

  const { id } = await params;
  const service = hrService();

  const { data, error } = await service
    .from('hr_attendance_records')
    .select('*, employee:employees(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Attendance record not found');

  if (ctx.isBranchScoped) {
    const emp = data.employee as { branch_id?: string } | null;
    if (emp?.branch_id !== ctx.branchId) return forbidden();
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const service = hrService();
    const { data: existing, error: existingError } = await service
      .from('hr_attendance_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return notFound('Attendance record not found');

    if (body.clock_in_time && body.clock_out_time && new Date(String(body.clock_out_time)).getTime() <= new Date(String(body.clock_in_time)).getTime()) {
      return badRequest('Clock out time must be after clock in time.');
    }

    const computed = await computeAttendancePayload({
      attendanceStatus: String(body.attendance_status ?? existing.attendance_status ?? 'PRESENT'),
      checkIn: String(body.clock_in_time ?? existing.clock_in_time ?? ''),
      checkOut: String(body.clock_out_time ?? existing.clock_out_time ?? ''),
      shiftDate: String(body.attendance_date ?? existing.attendance_date).slice(0, 10),
      shiftDefinitionId: String(body.shift_definition_id ?? existing.shift_definition_id ?? ''),
      shiftName: String(body.shift_name ?? existing.shift_name ?? ''),
    });

    const updates: Record<string, unknown> = {
      ...body,
      hours_worked: body.hours_worked ?? computed.hoursWorked,
      late_minutes: body.late_minutes ?? computed.lateMinutes,
      overtime_hours: body.overtime_hours ?? computed.overtimeHours,
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    };

    const { data, error } = await service
      .from('hr_attendance_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await writeHrAuditLog('HR_ATTENDANCE_UPDATED', id, ctx.userId, updates, 'attendance_record');
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to update attendance record.');
  }
}
