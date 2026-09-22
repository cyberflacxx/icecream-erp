import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';
import { isMissingColumnOrRelation } from '@/app/api/hr/utils';

function normalizeString(...values: unknown[]) {
  return values.map((value) => String(value ?? '').trim()).find(Boolean) ?? '';
}

async function loadActiveWarehouse(service: ReturnType<typeof hrService>, organizationId: string, warehouseId: string) {
  const { data, error } = await service
    .from('warehouses')
    .select('id, branch_id, is_active, organization_id')
    .eq('id', warehouseId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.is_active === false) return null;
  return data;
}

async function loadActiveBranch(service: ReturnType<typeof hrService>, organizationId: string, branchId: string) {
  const { data, error } = await service
    .from('branches')
    .select('id, status, is_active, organization_id')
    .eq('id', branchId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  const status = String(data?.status ?? '').toUpperCase();
  if (!data || data.is_active === false || ['INACTIVE', 'CLOSED', 'DELETED'].includes(status)) return null;
  return data;
}

async function loadEmployeeForTransfer(service: ReturnType<typeof hrService>, organizationId: string, employeeId: string) {
  const query = service
    .from('employees')
    .select('id, organization_id, status, branch_id, warehouse_id, department')
    .eq('id', employeeId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  const result = await query;
  if (!result.error || !isMissingColumnOrRelation(result.error, 'warehouse_id')) return result;

  const fallback = await service
    .from('employees')
    .select('id, organization_id, status, branch_id, department')
    .eq('id', employeeId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return {
    data: fallback.data ? { ...fallback.data, warehouse_id: null } : fallback.data,
    error: fallback.error,
  };
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read')) return forbidden();

  const service = hrService();
  let query = service
    .from('hr_employee_transfers')
    .select(`
      id, employee_id, from_branch_id, to_branch_id, from_warehouse_id, to_warehouse_id,
      from_department, to_department, effective_date, reason, notes, status,
      requested_at, approved_at, completed_at,
      employee:employees(id, employee_number, first_name, last_name, branch_id, department)
    `)
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false });

  if (ctx.isBranchScoped && ctx.branchId) {
    query = query.or(`from_branch_id.eq.${ctx.branchId},to_branch_id.eq.${ctx.branchId}`);
  }

  const { data, error } = await query;
  if (error) {
    if (error.message.includes("Could not find the table 'icecream_erp.hr_employee_transfers'")) {
      return NextResponse.json([]);
    }
    return serverError(error.message);
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.employee.transfer', 'hr.write')) return forbidden();

  const body = await request.json().catch(() => ({})) as {
    employeeId?: string;
    employee_id?: string;
    toBranchId?: string | null;
    to_branch_id?: string | null;
    toWarehouseId?: string | null;
    to_warehouse_id?: string | null;
    toDepartment?: string | null;
    to_department?: string | null;
    effectiveDate?: string;
    effective_date?: string;
    reason?: string | null;
    notes?: string | null;
    completeNow?: boolean;
  };

  const employeeId = normalizeString(body.employee_id, body.employeeId);
  const toBranchId = normalizeString(body.to_branch_id, body.toBranchId) || null;
  const toWarehouseId = normalizeString(body.to_warehouse_id, body.toWarehouseId) || null;
  const toDepartment = normalizeString(body.to_department, body.toDepartment) || null;
  const effectiveDate = normalizeString(body.effective_date, body.effectiveDate);
  const reason = normalizeString(body.reason) || null;
  const notes = normalizeString(body.notes) || null;

  if (!employeeId || !effectiveDate) return badRequest('employeeId and effectiveDate are required.');
  if (!toBranchId && !toWarehouseId && !toDepartment) {
    return badRequest('Select at least one destination branch, warehouse, or department.');
  }

  const service = hrService();
  try {
    const { data: employee, error: employeeError } = await loadEmployeeForTransfer(service, ctx.organizationId, employeeId);
    if (employeeError) return serverError(employeeError.message);
    if (!employee) return badRequest('Employee not found.');
    if (String(employee.status ?? '').toUpperCase() !== 'ACTIVE') return badRequest('Only active employees can be transferred.');
    if (ctx.isBranchScoped && employee.branch_id !== ctx.branchId) return forbidden();

    if (toBranchId && !(await loadActiveBranch(service, ctx.organizationId, toBranchId))) {
      return badRequest('Destination branch is not active or does not exist.');
    }
    if (toWarehouseId && !(await loadActiveWarehouse(service, ctx.organizationId, toWarehouseId))) {
      return badRequest('Destination warehouse is not active or does not exist.');
    }

    const currentBranchId = employee.branch_id ? String(employee.branch_id) : null;
    const currentWarehouseId = employee.warehouse_id ? String(employee.warehouse_id) : null;
    const currentDepartment = employee.department ? String(employee.department) : null;
    const branchChanged = Boolean(toBranchId && toBranchId !== currentBranchId);
    const warehouseChanged = Boolean(toWarehouseId && toWarehouseId !== currentWarehouseId);
    const departmentChanged = Boolean(toDepartment && toDepartment !== currentDepartment);
    if (!branchChanged && !warehouseChanged && !departmentChanged) {
      return badRequest('Destination assignment must differ from the current assignment.');
    }

    const pending = await service
      .from('hr_employee_transfers')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('employee_id', employeeId)
      .in('status', ['PENDING', 'APPROVED'])
      .maybeSingle();
    if (pending.error && !pending.error.message.includes('hr_employee_transfers')) return serverError(pending.error.message);
    if (pending.data) return badRequest('Employee already has a pending transfer.');

    const status = body.completeNow === true ? 'COMPLETED' : 'PENDING';
    const now = new Date().toISOString();
    const transferPayload = {
      approved_at: status === 'COMPLETED' ? now : null,
      approved_by: status === 'COMPLETED' ? ctx.userId : null,
      completed_at: status === 'COMPLETED' ? now : null,
      completed_by: status === 'COMPLETED' ? ctx.userId : null,
      effective_date: effectiveDate,
      employee_id: employeeId,
      from_branch_id: currentBranchId,
      from_department: currentDepartment,
      from_warehouse_id: currentWarehouseId,
      notes,
      organization_id: ctx.organizationId,
      reason,
      requested_by: ctx.userId,
      status,
      to_branch_id: toBranchId || currentBranchId,
      to_department: toDepartment || currentDepartment,
      to_warehouse_id: toWarehouseId || currentWarehouseId,
    };

    const { data: transfer, error: transferError } = await service
      .from('hr_employee_transfers')
      .insert(transferPayload)
      .select()
      .single();
    if (transferError) return serverError(transferError.message);

    if (status === 'COMPLETED') {
      const updates: Record<string, unknown> = {
        branch_id: transferPayload.to_branch_id,
        department: transferPayload.to_department,
        updated_at: now,
        updated_by: ctx.userId,
      };
      if (transferPayload.to_warehouse_id !== undefined) updates.warehouse_id = transferPayload.to_warehouse_id;

      const { error: updateError } = await service
        .from('employees')
        .update(updates)
        .eq('id', employeeId);
      if (updateError) {
        if (!isMissingColumnOrRelation(updateError, 'warehouse_id')) return serverError(updateError.message);
        delete updates.warehouse_id;
        const { error: fallbackUpdateError } = await service
          .from('employees')
          .update(updates)
          .eq('id', employeeId);
        if (fallbackUpdateError) return serverError(fallbackUpdateError.message);
      }
    }

    await writeHrAuditLog('HR_EMPLOYEE_TRANSFER_CREATED', String(transfer.id), ctx.userId, transferPayload, 'employee_transfer');

    return NextResponse.json({ ...transfer, completed: status === 'COMPLETED' }, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to create employee transfer.');
  }
}
