import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { detectShiftOverlap, normalizeShiftName } from '@/lib/hr';
import { ensureEmployeeAssignable, hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'production.read')) return forbidden();

  try {
    const service = hrService();
    const { searchParams } = new URL(request.url);
    let query = service
      .from('hr_shift_schedules')
      .select(`
        *, 
        shiftDefinition:hr_shift_definitions(id, shift_name, start_time, end_time),
        department:departments(id, code, name),
        branch:branches(id, code, name),
        employees:hr_shift_schedule_employees(id, employee_id, role_on_shift, employee:employees(id, employee_number, first_name, last_name, branch_id))
      `)
      .eq('organization_id', ctx.organizationId)
      .order('shift_date', { ascending: false });

    const branchId = ctx.isBranchScoped ? ctx.branchId : (searchParams.get('branchId') ?? null);
    if (branchId) query = query.eq('branch_id', branchId);
    if (searchParams.get('departmentId')) query = query.eq('department_id', searchParams.get('departmentId'));
    if (searchParams.get('status')) query = query.eq('status', searchParams.get('status'));
    if (searchParams.get('shiftDate')) query = query.eq('shift_date', searchParams.get('shiftDate'));

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load shift schedules.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      assigned_employees?: Array<{ employee_id: string; role_on_shift?: string; override_overlap?: boolean }>;
      branch_id?: string;
      department_id?: string;
      shift_date?: string;
      shift_definition_id?: string;
      shift_name?: string;
      status?: string;
    };
    if (!body.shift_date) return badRequest('shift_date is required.');
    if (!body.shift_definition_id && !body.shift_name) return badRequest('shift_definition_id or shift_name is required.');

    const service = hrService();
    let shiftDefinitionId = body.shift_definition_id ?? null;
    let shiftDefinition: Record<string, unknown> | null = null;

    if (shiftDefinitionId) {
      const result = await service.from('hr_shift_definitions').select('*').eq('id', shiftDefinitionId).maybeSingle();
      if (result.error) throw result.error;
      shiftDefinition = result.data as Record<string, unknown> | null;
    } else {
      const result = await service
        .from('hr_shift_definitions')
        .select('*')
        .eq('organization_id', ctx.organizationId)
        .eq('shift_name', normalizeShiftName(body.shift_name))
        .eq('is_active', true)
        .maybeSingle();
      if (result.error) throw result.error;
      shiftDefinition = result.data as Record<string, unknown> | null;
      shiftDefinitionId = shiftDefinition?.id ? String(shiftDefinition.id) : null;
    }

    if (!shiftDefinitionId || !shiftDefinition) return badRequest('Shift definition not found.');

    const employeeAssignments = body.assigned_employees ?? [];
    const existingSchedulesRes = await service
      .from('hr_shift_schedules')
      .select('id, shift_date, shiftDefinition:hr_shift_definitions(start_time, end_time), employees:hr_shift_schedule_employees(employee_id)')
      .eq('organization_id', ctx.organizationId);
    if (existingSchedulesRes.error) throw existingSchedulesRes.error;

    const allExisting = (existingSchedulesRes.data ?? []).flatMap((schedule: Record<string, unknown>) => {
      const shiftDef = schedule.shiftDefinition as Record<string, unknown> | null;
      const employees = Array.isArray(schedule.employees) ? schedule.employees as Array<Record<string, unknown>> : [];
      return employees.map((employee) => ({
        employeeId: String(employee.employee_id ?? ''),
        endTime: String(shiftDef?.end_time ?? ''),
        scheduleId: String(schedule.id ?? ''),
        shiftDate: String(schedule.shift_date ?? '').slice(0, 10),
        startTime: String(shiftDef?.start_time ?? ''),
      }));
    });

    for (const assignment of employeeAssignments) {
      await ensureEmployeeAssignable(assignment.employee_id);
      const overlap = detectShiftOverlap(allExisting, {
        employeeId: assignment.employee_id,
        endTime: String(shiftDefinition.end_time ?? ''),
        shiftDate: body.shift_date,
        startTime: String(shiftDefinition.start_time ?? ''),
      });
      if (overlap && !assignment.override_overlap) {
        return badRequest(`Employee ${assignment.employee_id} is already assigned to an overlapping shift.`);
      }
    }

    const { data: schedule, error: scheduleError } = await service
      .from('hr_shift_schedules')
      .insert({
        branch_id: body.branch_id ?? ctx.branchId ?? null,
        department_id: body.department_id ?? shiftDefinition.default_department_id ?? null,
        organization_id: ctx.organizationId,
        scheduled_by: ctx.userId,
        shift_date: body.shift_date,
        shift_definition_id: shiftDefinitionId,
        status: body.status ?? 'SCHEDULED',
      })
      .select()
      .single();
    if (scheduleError) throw scheduleError;

    if (employeeAssignments.length > 0) {
      const payload = employeeAssignments.map((employee) => ({
        created_by: ctx.userId,
        employee_id: employee.employee_id,
        organization_id: ctx.organizationId,
        override_overlap: employee.override_overlap ?? false,
        role_on_shift: employee.role_on_shift ?? null,
        schedule_id: schedule.id,
        updated_by: ctx.userId,
      }));
      const { error } = await service.from('hr_shift_schedule_employees').insert(payload);
      if (error) throw error;
    }

    await writeHrAuditLog(
      'HR_SHIFT_SCHEDULE_CREATED',
      String(schedule.id),
      ctx.userId,
      { assignedEmployees: employeeAssignments.length, shiftDate: body.shift_date, status: schedule.status },
      'shift_schedule',
    );

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to create shift schedule.');
  }
}
