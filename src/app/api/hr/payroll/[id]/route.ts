import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'payroll.read')) return forbidden();

  const { id } = await params;
  const service = hrService();

  const { data, error } = await service
    .from('hr_payroll_summaries')
    .select('*, employee:employees(*), period:hr_payroll_periods(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Payroll record not found');

  if (ctx.isBranchScoped) {
    const emp = data.employee as { branch_id?: string } | null;
    if (emp?.branch_id !== ctx.branchId) return forbidden();
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'payroll.create')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const service = hrService();
    const { data: existing, error: fetchError } = await service.from('hr_payroll_summaries').select('id, status').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Payroll record not found.');
    if (String(existing.status ?? '') === 'POSTED') return badRequest('Posted payroll must not be edited.');

    const updates = {
      allowances: body.allowances ?? undefined,
      basic_pay: body.basic_pay ?? undefined,
      deductions: body.deductions ?? undefined,
      gross_pay: body.gross_pay ?? undefined,
      net_pay: body.net_pay ?? undefined,
      overtime_pay: body.overtime_pay ?? undefined,
      status: body.status ?? undefined,
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    };
    const { data, error } = await service.from('hr_payroll_summaries').update(updates).eq('id', id).select().single();
    if (error) throw error;
    await writeHrAuditLog('HR_PAYROLL_SUMMARY_UPDATED', id, ctx.userId, updates, 'payroll_summary');
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to update payroll summary.');
  }
}
