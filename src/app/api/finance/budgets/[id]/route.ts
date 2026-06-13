import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'budget.write', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as { name?: string; status?: string; totalBudgeted?: number };
    if (body.totalBudgeted !== undefined && Number(body.totalBudgeted) < 0) {
      return badRequest('totalBudgeted must not be negative');
    }

    const { data, error } = await financeService()
      .from('budgets')
      .update({
        name: body.name,
        status: body.status,
        total_budgeted: body.totalBudgeted,
      })
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();
    if (error || !data) return notFound('Budget not found');

    await writeFinanceAuditLog('BUDGET_UPDATED', id, ctx.userId, body as Record<string, unknown>, 'budget');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
