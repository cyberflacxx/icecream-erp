import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string; id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'branches.write')) return forbidden();

  const { id, customerId } = await params;
  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const body = await request.json() as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (body.customerName !== undefined) updates.customer_name = body.customerName;
    if (body.phoneNumber !== undefined) updates.phone_number = body.phoneNumber;
    if (body.customerType !== undefined) updates.customer_type = body.customerType;
    if (body.creditAllowed !== undefined) updates.credit_allowed = body.creditAllowed;
    if (body.creditLimit !== undefined) updates.credit_limit = body.creditLimit;
    if (body.currentBalance !== undefined) updates.current_balance = body.currentBalance;
    if (body.isActive !== undefined) updates.is_active = body.isActive;

    const { data, error } = await service
      .from('branch_customers')
      .update(updates)
      .eq('id', customerId)
      .eq('branch_id', id)
      .select()
      .single();
    if (error) throw error;

    await writeBranchAuditLog('BRANCH_CUSTOMER_UPDATED', customerId, ctx.userId, { branchId: id }, 'branch_customer');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
