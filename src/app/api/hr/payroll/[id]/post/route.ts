import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write', 'payroll.approve', 'hr.write')) return forbidden();

  try {
    const { id } = await params;
    const service = hrService();
    const { data: existing, error: fetchError } = await service.from('hr_payroll_summaries').select('id, status').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound('Payroll record not found.');
    if (String(existing.status ?? '') !== 'APPROVED') return badRequest('Payroll must be approved before posting.');

    const update = {
      posted_at: new Date().toISOString(),
      posted_by: ctx.userId,
      status: 'POSTED',
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    };
    const { data, error } = await service.from('hr_payroll_summaries').update(update).eq('id', id).select().single();
    if (error) throw error;
    await writeHrAuditLog('HR_PAYROLL_SUMMARY_POSTED', id, ctx.userId, update, 'payroll_summary');
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to post payroll summary.');
  }
}
