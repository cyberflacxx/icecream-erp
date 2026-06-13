import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ expenseId: string; id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write', 'branches.write')) return forbidden();
  const { id, expenseId } = await params;
  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const { data, error } = await service
      .from('branch_expenses')
      .update({
        status: 'APPROVED',
        approved_by: ctx.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', expenseId)
      .eq('branch_id', id)
      .select()
      .single();
    if (error) throw error;
    await writeBranchAuditLog('BRANCH_EXPENSE_APPROVED', expenseId, ctx.userId, { branchId: id }, 'branch_expense');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
