import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { detectShiftOverlap } from '@/lib/hr';
import { ensureEmployeeAssignable, hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'production.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as {
      assigned_employees?: Array<{ employee_id: string; role_on_shift?: string; override_overlap?: boolean }>;
      branch_id?: string;
      department_id?: string;
      shift_date?: string;
      status?: string;
    };
    const service = hrService();
    const { data: existing, error: fetchError } = await service
      .from('hr_shift_schedules')
      .select('*, shiftDefinition:hr_shift_definitions(start_time, end_time)')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Shift schedule not found.');

    const shiftDef = existing.shiftDefinition as Record<string, unknown> | null;
    const employees = body.assigned_employees ?? [];
    const allSchedulesRes = await service
      .from('hr_shift_schedules')
      .select('id, shift_date, shiftDefinition:hr_shift_definitions(start_time, end_time), employees:hr_shift_schedule_employees(employee_id)')
      .eq('organization_id', ctx.organizationId);
    if (allSchedulesRes.error) throw allSchedulesRes.error;

    const allExisting = (allSchedulesRes.data ?? []).flatMap((schedule: Record<string, unknown>) => {
      const scheduleShift = schedule.shiftDefinition as Record<string, unknown> | null;
      const scheduleEmployees = Array.isArray(schedule.employees) ? schedule.employees as Array<Record<string, unknown>> : [];
      return scheduleEmployees.map((employee) => ({
        employeeId: String(employee.employee_id ?? ''),
        endTime: String(scheduleShift?.end_time ?? ''),
        scheduleId: String(schedule.id ?? ''),
        shiftDate: String(schedule.shift_date ?? '').slice(0, 10),
        startTime: String(scheduleShift?.start_time ?? ''),
      }));
    });

    for (const assignment of employees) {
      await ensureEmployeeAssignable(assignment.employee_id);
      const overlap = detectShiftOverlap(allExisting, {
        employeeId: assignment.employee_id,
        endTime: String(shiftDef?.end_time ?? ''),
        scheduleId: id,
        shiftDate: String(body.shift_date ?? existing.shift_date).slice(0, 10),
        startTime: String(shiftDef?.start_time ?? ''),
      });
      if (overlap && !assignment.override_overlap) {
        return badRequest(`Employee ${assignment.employee_id} is already assigned to an overlapping shift.`);
      }
    }

    const updates = {
      branch_id: body.branch_id ?? existing.branch_id ?? null,
      department_id: body.department_id ?? existing.department_id ?? null,
      shift_date: body.shift_date ?? existing.shift_date,
      status: body.status ?? existing.status,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await service.from('hr_shift_schedules').update(updates).eq('id', id).select().single();
    if (error) throw error;

    if (body.assigned_employees) {
      const { error: deleteError } = await service.from('hr_shift_schedule_employees').delete().eq('schedule_id', id);
      if (deleteError) throw deleteError;
      if (body.assigned_employees.length > 0) {
        const payload = body.assigned_employees.map((employee) => ({
          created_by: ctx.userId,
          employee_id: employee.employee_id,
          organization_id: ctx.organizationId,
          override_overlap: employee.override_overlap ?? false,
          role_on_shift: employee.role_on_shift ?? null,
          schedule_id: id,
          updated_by: ctx.userId,
        }));
        const { error: insertError } = await service.from('hr_shift_schedule_employees').insert(payload);
        if (insertError) throw insertError;
      }
    }

    await writeHrAuditLog('HR_SHIFT_SCHEDULE_UPDATED', id, ctx.userId, updates, 'shift_schedule');
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to update shift schedule.');
  }
}
