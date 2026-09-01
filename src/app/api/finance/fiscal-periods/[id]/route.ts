import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
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

    const service = financeService();
    const existing = await service
      .from('fiscal_periods')
      .select('id, start_date, end_date')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();
    if (existing.error || !existing.data) return notFound('Fiscal period not found');

    const nextStartDate = String(body.startDate ?? existing.data.start_date ?? '');
    const nextEndDate = String(body.endDate ?? existing.data.end_date ?? '');
    if (nextStartDate && nextEndDate && nextEndDate < nextStartDate) {
      return badRequest('End date must be on or after start date.');
    }

    if (body.startDate !== undefined || body.endDate !== undefined) {
      const overlap = await service
        .from('fiscal_periods')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .neq('id', id)
        .lte('start_date', nextEndDate)
        .gte('end_date', nextStartDate)
        .limit(1);
      if (overlap.error) throw overlap.error;
      if ((overlap.data ?? []).length > 0) return badRequest('Fiscal period overlaps an existing period');
    }

    const updates: Record<string, unknown> = { updated_by: ctx.userId };
    if (body.periodName !== undefined) updates.period_name = String(body.periodName).trim();
    if (body.startDate !== undefined) updates.start_date = body.startDate;
    if (body.endDate !== undefined) updates.end_date = body.endDate;
    if (body.status !== undefined) {
      const status = String(body.status).trim().toUpperCase();
      if (!['OPEN', 'CLOSED'].includes(status)) return badRequest('status must be OPEN or CLOSED.');
      updates.status = status;
      updates.is_locked = status === 'CLOSED';
    }
    if (body.isLocked !== undefined) updates.is_locked = Boolean(body.isLocked);
    if (updates.period_name === '') return badRequest('periodName cannot be empty.');

    const { data, error } = await service
      .from('fiscal_periods')
      .update(updates)
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
