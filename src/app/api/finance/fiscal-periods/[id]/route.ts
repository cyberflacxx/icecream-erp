import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { financeService, writeFinanceAuditLog } from '@/lib/finance-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as {
      endDate?: string;
      isLocked?: boolean;
      periodName?: string;
      startDate?: string;
      status?: string;
    };

    const existing = await financeService().from('fiscal_periods').select('id').eq('organization_id', ctx.organizationId).eq('id', id).single();
    if (existing.error || !existing.data) return notFound('Fiscal period not found');

    const { data, error } = await financeService()
      .from('fiscal_periods')
      .update({
        period_name: body.periodName,
        start_date: body.startDate,
        end_date: body.endDate,
        status: body.status,
        is_locked: body.isLocked,
        updated_by: ctx.userId,
      })
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('FISCAL_PERIOD_UPDATED', id, ctx.userId, body as Record<string, unknown>, 'fiscal_period');
    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
