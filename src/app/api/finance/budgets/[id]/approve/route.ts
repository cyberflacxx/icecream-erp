import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'budget.approve', 'finance.approve', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const { data, error } = await financeService()
      .from('budgets')
      .update({
        status: 'APPROVED',
        approved_by: ctx.userId,
        approved_at: new Date().toISOString(),
      })
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();
    if (error || !data) return notFound('Budget not found');
    await writeFinanceAuditLog('BUDGET_APPROVED', id, ctx.userId, {}, 'budget');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
