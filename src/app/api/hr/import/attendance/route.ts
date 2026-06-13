import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { computeAttendancePayload, hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  try {
    const body = await request.json() as { rows?: Array<Record<string, unknown>> };
    const rows = body.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) return badRequest('rows are required.');

    const payload: Array<Record<string, unknown>> = [];
    const errors: Array<{ row: number; field: string; message: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] ?? {};
      if (!row.employee_id || !row.attendance_date || !row.shift) {
        errors.push({ row: index + 2, field: 'employee_id', message: 'employee_id, attendance_date, and shift are required.' });
        continue;
      }
      const computed = await computeAttendancePayload({
        attendanceStatus: String(row.attendance_status ?? 'PRESENT'),
        checkIn: row.clock_in_time ? String(row.clock_in_time) : null,
        checkOut: row.clock_out_time ? String(row.clock_out_time) : null,
        shiftDate: String(row.attendance_date),
        shiftDefinitionId: row.shift_definition_id ? String(row.shift_definition_id) : null,
        shiftName: String(row.shift),
      });

      payload.push({
        approval_status: 'DRAFT',
        attendance_date: row.attendance_date,
        attendance_status: String(row.attendance_status ?? 'PRESENT').toUpperCase(),
        branch_id: row.branch_id ?? ctx.branchId ?? null,
        clock_in_time: row.clock_in_time ?? null,
        clock_out_time: row.clock_out_time ?? null,
        created_by: ctx.userId,
        employee_id: row.employee_id,
        hours_worked: row.hours_worked ?? computed.hoursWorked,
        late_minutes: row.late_minutes ?? computed.lateMinutes,
        organization_id: ctx.organizationId,
        overtime_hours: row.overtime_hours ?? computed.overtimeHours,
        remarks: row.remarks ?? null,
        schedule_id: row.schedule_id ?? null,
        shift_definition_id: row.shift_definition_id ?? null,
        shift_name: row.shift,
        updated_by: ctx.userId,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors, inserted: 0 }, { status: 400 });
    }

    const service = hrService();
    const { data, error } = await service
      .from('hr_attendance_records')
      .upsert(payload, { onConflict: 'employee_id,attendance_date,shift_name' })
      .select();
    if (error) throw error;
    await writeHrAuditLog('HR_ATTENDANCE_IMPORT', `import-${Date.now()}`, ctx.userId, { rows: payload.length }, 'attendance_import');
    return NextResponse.json({ data: data ?? [], inserted: payload.length });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to import attendance.');
  }
}
