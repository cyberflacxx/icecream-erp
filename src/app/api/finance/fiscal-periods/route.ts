import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, financeService, isMissingFinanceTable, writeFinanceAuditLog } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { data, error } = await financeService()
      .from('fiscal_periods')
      .select('id, period_name, start_date, end_date, status, is_locked')
      .eq('organization_id', ctx.organizationId)
      .order('start_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    if (isMissingFinanceTable(err)) return NextResponse.json([]);
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      periodName: string;
      startDate: string;
      endDate: string;
      status?: string;
      isLocked?: boolean;
    };

    if (!body.periodName || !body.startDate || !body.endDate) {
      return badRequest('periodName, startDate, and endDate are required');
    }

    const service = financeService();
    const overlap = await service
      .from('fiscal_periods')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .lte('start_date', body.endDate)
      .gte('end_date', body.startDate);
    if (overlap.error) throw overlap.error;
    if ((overlap.data ?? []).length > 0) return badRequest('Fiscal period overlaps an existing period');

    const { data, error } = await service
      .from('fiscal_periods')
      .insert({
        organization_id: ctx.organizationId,
        period_name: body.periodName,
        start_date: body.startDate,
        end_date: body.endDate,
        status: body.status ?? 'OPEN',
        is_locked: body.isLocked ?? false,
        created_by: ctx.userId,
        updated_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('FISCAL_PERIOD_CREATED', data.id, ctx.userId, { periodName: body.periodName }, 'fiscal_period');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
