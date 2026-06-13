import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ expenseId: string; id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write', 'branches.write')) return forbidden();
  const { id, expenseId } = await params;
  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const body = await request.json() as { reason?: string };
    if (!body.reason) return badRequest('Rejection reason is required');
    const { data, error } = await service
      .from('branch_expenses')
      .update({
        status: 'REJECTED',
        rejected_by: ctx.userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: body.reason,
      })
      .eq('id', expenseId)
      .eq('branch_id', id)
      .select()
      .single();
    if (error) throw error;
    await writeBranchAuditLog('BRANCH_EXPENSE_REJECTED', expenseId, ctx.userId, { branchId: id, reason: body.reason }, 'branch_expense');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
