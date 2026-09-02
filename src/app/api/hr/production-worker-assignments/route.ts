import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createLabourCostAllocation, ensureEmployeeAssignable, hrService, writeHrAuditLog } from '@/lib/hr-server';
import { isMissingTableError } from '@/lib/postgrest-compat';

type Row = Record<string, unknown>;

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

async function loadAssignmentFallback(
  service: ReturnType<typeof hrService>,
  filters: { batchId?: string | null; employeeId?: string | null },
) {
  let query = service
    .from('production_worker_assignments')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.batchId) query = query.eq('batch_id', filters.batchId);
  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);

  const result = await query;
  if (result.error) {
    if (isMissingTableError(result.error, 'production_worker_assignments')) return [];
    throw result.error;
  }

  const assignments = (result.data ?? []) as Row[];
  const employeeIds = [...new Set(assignments.map((row) => String(row.employee_id ?? '')).filter(Boolean))];
  const batchIds = [...new Set(assignments.map((row) => String(row.batch_id ?? row.production_batch ?? '')).filter(Boolean))];

  const [employeesResult, batchesResult] = await Promise.all([
    employeeIds.length
      ? service.from('employees').select('id, employee_number, first_name, last_name, department, branch_id').in('id', employeeIds)
      : Promise.resolve({ data: [], error: null }),
    batchIds.length
      ? service.from('production_batches').select('id, batch_number, shift, production_date, warehouse_id').in('id', batchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const employees = employeesResult.error ? [] : (employeesResult.data ?? []) as Row[];
  const batches = batchesResult.error ? [] : (batchesResult.data ?? []) as Row[];
  const employeesById = new Map(employees.map((row) => [String(row.id ?? ''), row]));
  const batchesById = new Map(batches.map((row) => [String(row.id ?? ''), row]));

  return assignments.map((row) => ({
    ...row,
    batch: batchesById.get(String(row.batch_id ?? row.production_batch ?? '')) ?? null,
    employee: employeesById.get(String(row.employee_id ?? '')) ?? null,
  }));
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'production.read')) return forbidden();

  try {
    const service = hrService();
    const { searchParams } = new URL(request.url);
    let query = service
      .from('production_worker_assignments')
      .select(`
        *, 
        employee:employees(id, employee_number, first_name, last_name, department, branch_id),
        batch:production_batches(id, batch_number, shift, production_date, warehouse_id, warehouses(branch_id, name))
      `)
      .order('created_at', { ascending: false });

    if (searchParams.get('batchId')) query = query.eq('batch_id', searchParams.get('batchId'));
    if (searchParams.get('employeeId')) query = query.eq('employee_id', searchParams.get('employeeId'));

    let { data, error } = await query;
    if (error && /relationship|schema cache|column/i.test(errorMessage(error))) {
      data = await loadAssignmentFallback(service, {
        batchId: searchParams.get('batchId'),
        employeeId: searchParams.get('employeeId'),
      });
      error = null;
    }
    if (error) {
      if (isMissingTableError(error, 'production_worker_assignments')) return NextResponse.json([]);
      throw error;
    }

    const rows = (data ?? []).filter((row: Record<string, unknown>) => {
      if (!ctx.isBranchScoped) return true;
      const employee = row.employee as Record<string, unknown> | null;
      const batch = row.batch as Record<string, unknown> | null;
      const warehouse = batch?.warehouses as Record<string, unknown> | undefined;
      return String(employee?.branch_id ?? warehouse?.branch_id ?? '') === ctx.branchId;
    });

    return NextResponse.json(rows);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load production worker assignments.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'production.write')) return forbidden();

  try {
    const body = await request.json() as {
      employee_id?: string;
      hoursWorked?: number;
      labourRate?: number;
      labourHours?: number;
      overheadAllocation?: number;
      outputQuantity?: number;
      production_batch?: string;
      rateType?: string;
      role_on_batch?: string;
      shift?: string;
    };
    if (!body.production_batch || !body.employee_id || !body.shift) {
      return badRequest('production_batch, employee_id, and shift are required.');
    }

    await ensureEmployeeAssignable(body.employee_id);

    const service = hrService();
    const { data: batch, error: batchError } = await service
      .from('production_batches')
      .select('id, status, worker_count, labour_cost, overhead_cost')
      .eq('id', body.production_batch)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return badRequest('Production batch not found.');
    if (['COMPLETED', 'CANCELLED'].includes(String(batch.status ?? '').toUpperCase())) {
      return badRequest('Workers cannot be assigned to completed or cancelled production batches.');
    }

    const { data: employee, error: employeeError } = await service
      .from('employees')
      .select('id, employee_number, first_name, last_name')
      .eq('id', body.employee_id)
      .maybeSingle();
    if (employeeError) throw employeeError;
    const workerName = employee
      ? [employee.first_name, employee.last_name].filter(Boolean).join(' ') || String(employee.employee_number ?? '')
      : null;

    const { data: existingAssignment, error: existingAssignmentError } = await service
      .from('production_worker_assignments')
      .select('id')
      .eq('batch_id', body.production_batch)
      .eq('employee_id', body.employee_id)
      .maybeSingle();
    if (existingAssignmentError) throw existingAssignmentError;
    if (existingAssignment) {
      return badRequest('This worker is already assigned to the selected production batch.');
    }

    const { data, error } = await service
      .from('production_worker_assignments')
      .insert({
        attendance_status: 'PRESENT',
        batch_id: body.production_batch,
        created_by: ctx.userId,
        employee_id: body.employee_id,
        hours_worked: Number(body.hoursWorked ?? body.labourHours ?? 0),
        is_off_shift: false,
        organization_id: ctx.organizationId,
        output_quantity: Number(body.outputQuantity ?? 0),
        remarks: body.role_on_batch ? `Role: ${body.role_on_batch}` : null,
        shift_name: body.shift,
        worker_name: workerName,
      })
      .select()
      .single();
    if (error) throw error;

    let labourAllocation: Record<string, unknown> | null = null;
    const labourRate = body.labourRate !== undefined ? Number(body.labourRate) : null;
    const labourHours = Number(body.hoursWorked ?? body.labourHours ?? 0);
    const overheadAllocation = Number(body.overheadAllocation ?? 0);
    if (labourRate !== null) {
      if (labourRate < 0 || labourHours < 0 || overheadAllocation < 0) {
        return badRequest('Labour rate, hours, and overhead allocation must not be negative.');
      }
      labourAllocation = await createLabourCostAllocation({
        approvalStatus: 'APPROVED',
        batchId: body.production_batch,
        branchId: ctx.branchId ?? null,
        departmentId: null,
        employeeId: body.employee_id,
        hoursWorked: labourHours,
        organizationId: ctx.organizationId,
        overheadAllocation,
        rate: labourRate,
        rateType: body.rateType ?? 'HOURLY',
        scheduleId: null,
        shiftName: body.shift,
      }) as Record<string, unknown>;
    }

    await service.from('production_batches').update({
      labour_cost: Number(batch.labour_cost ?? 0) + Number(labourAllocation?.labour_cost ?? 0),
      overhead_cost: Number(batch.overhead_cost ?? 0) + Number(labourAllocation?.overhead_allocation ?? 0),
      updated_at: new Date().toISOString(),
      worker_count: Number(batch.worker_count ?? 0) + 1,
    }).eq('id', body.production_batch);

    await writeHrAuditLog('HR_WORKER_ASSIGNED_TO_BATCH', String(data.id), ctx.userId, { assignment: data, labourAllocation }, 'production_worker_assignment');
    return NextResponse.json({ ...data, labourAllocation }, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to assign worker to batch.');
  }
}
