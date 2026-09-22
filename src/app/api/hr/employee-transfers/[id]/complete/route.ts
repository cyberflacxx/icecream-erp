import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';
import { isMissingColumnOrRelation } from '@/app/api/hr/utils';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.employee.transfer', 'hr.write')) return forbidden();

  const { id } = await params;
  const service = hrService();

  try {
    const { data: transfer, error } = await service
      .from('hr_employee_transfers')
      .select('id, organization_id, employee_id, from_branch_id, to_branch_id, from_warehouse_id, to_warehouse_id, from_department, to_department, status, approved_at, approved_by')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (error) {
      if (isMissingColumnOrRelation(error, 'hr_employee_transfers')) return badRequest('Employee transfer workflow is not installed.');
      return serverError(error.message);
    }
    if (!transfer) return notFound('Employee transfer not found.');
    if (ctx.isBranchScoped && ctx.branchId && transfer.from_branch_id !== ctx.branchId && transfer.to_branch_id !== ctx.branchId) return forbidden();

    const status = String(transfer.status ?? '').toUpperCase();
    if (!['PENDING', 'APPROVED'].includes(status)) return badRequest('Only pending or approved employee transfers can be completed.');

    const { data: employee, error: employeeError } = await service
      .from('employees')
      .select('id, organization_id, status')
      .eq('id', transfer.employee_id)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    if (employeeError) return serverError(employeeError.message);
    if (!employee) return notFound('Employee not found.');
    if (String(employee.status ?? '').toUpperCase() !== 'ACTIVE') return badRequest('Only active employees can be transferred.');

    if (transfer.to_branch_id) {
      const { data: branch, error: branchError } = await service
        .from('branches')
        .select('id, status, is_active')
        .eq('id', transfer.to_branch_id)
        .eq('organization_id', ctx.organizationId)
        .maybeSingle();
      if (branchError) return serverError(branchError.message);
      const branchStatus = String(branch?.status ?? '').toUpperCase();
      if (!branch || branch.is_active === false || ['INACTIVE', 'CLOSED', 'DELETED'].includes(branchStatus)) return badRequest('Destination branch is not active or does not exist.');
    }

    if (transfer.to_warehouse_id) {
      const { data: warehouse, error: warehouseError } = await service
        .from('warehouses')
        .select('id, is_active')
        .eq('id', transfer.to_warehouse_id)
        .eq('organization_id', ctx.organizationId)
        .maybeSingle();
      if (warehouseError) return serverError(warehouseError.message);
      if (!warehouse || warehouse.is_active === false) return badRequest('Destination warehouse is not active or does not exist.');
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      branch_id: transfer.to_branch_id,
      department: transfer.to_department,
      updated_at: now,
      updated_by: ctx.userId,
    };
    if (transfer.to_warehouse_id !== undefined) updates.warehouse_id = transfer.to_warehouse_id;

    const employeeUpdate = await service
      .from('employees')
      .update(updates)
      .eq('id', transfer.employee_id)
      .eq('organization_id', ctx.organizationId);
    if (employeeUpdate.error) {
      if (!isMissingColumnOrRelation(employeeUpdate.error, 'warehouse_id')) return serverError(employeeUpdate.error.message);
      delete updates.warehouse_id;
      const fallbackUpdate = await service
        .from('employees')
        .update(updates)
        .eq('id', transfer.employee_id)
        .eq('organization_id', ctx.organizationId);
      if (fallbackUpdate.error) return serverError(fallbackUpdate.error.message);
    }

    const transferUpdate = {
      approved_at: transfer.approved_at ?? now,
      approved_by: transfer.approved_by ?? ctx.userId,
      completed_at: now,
      completed_by: ctx.userId,
      status: 'COMPLETED',
      updated_at: now,
    };
    const { data: completed, error: completeError } = await service
      .from('hr_employee_transfers')
      .update(transferUpdate)
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .in('status', ['PENDING', 'APPROVED'])
      .select()
      .single();
    if (completeError) return serverError(completeError.message);

    await writeHrAuditLog('HR_EMPLOYEE_TRANSFER_COMPLETED', id, ctx.userId, { transferId: id, employeeId: transfer.employee_id }, 'employee_transfer');

    return NextResponse.json(completed);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to complete employee transfer.');
  }
}
