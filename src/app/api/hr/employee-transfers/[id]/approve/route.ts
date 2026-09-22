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
      .select('id, organization_id, employee_id, from_branch_id, to_branch_id, status')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (error) {
      if (isMissingColumnOrRelation(error, 'hr_employee_transfers')) return badRequest('Employee transfer workflow is not installed.');
      return serverError(error.message);
    }
    if (!transfer) return notFound('Employee transfer not found.');
    if (ctx.isBranchScoped && ctx.branchId && transfer.from_branch_id !== ctx.branchId && transfer.to_branch_id !== ctx.branchId) return forbidden();
    if (String(transfer.status ?? '').toUpperCase() !== 'PENDING') return badRequest('Only pending employee transfers can be approved.');

    const now = new Date().toISOString();
    const { data: approved, error: updateError } = await service
      .from('hr_employee_transfers')
      .update({ approved_at: now, approved_by: ctx.userId, status: 'APPROVED', updated_at: now })
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('status', 'PENDING')
      .select()
      .single();
    if (updateError) return serverError(updateError.message);

    await writeHrAuditLog('HR_EMPLOYEE_TRANSFER_APPROVED', id, ctx.userId, { transferId: id }, 'employee_transfer');

    return NextResponse.json(approved);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to approve employee transfer.');
  }
}
