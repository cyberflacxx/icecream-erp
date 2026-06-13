import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'payroll.create')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const service = hrService();
    const { data: existing, error: fetchError } = await service.from('hr_payroll_periods').select('*').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Payroll period not found.');
    if (Boolean(existing.is_locked)) return badRequest('Locked payroll periods cannot be edited.');

    const updates = {
      end_date: body.end_date ?? existing.end_date,
      is_locked: body.locked_status ?? body.is_locked ?? existing.is_locked,
      period_name: body.period_name ?? existing.period_name,
      start_date: body.start_date ?? existing.start_date,
      status: body.status ?? existing.status,
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    };
    const { data, error } = await service.from('hr_payroll_periods').update(updates).eq('id', id).select().single();
    if (error) throw error;
    await writeHrAuditLog('HR_PAYROLL_PERIOD_UPDATED', id, ctx.userId, updates, 'payroll_period');
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to update payroll period.');
  }
}
