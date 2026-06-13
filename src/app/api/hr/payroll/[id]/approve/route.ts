import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'payroll.approve', 'finance.write')) return forbidden();

  const { id } = await params;
  const service = hrService();

  const { data: existing, error: fetchErr } = await service
    .from('hr_payroll_summaries')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) return serverError(fetchErr.message);
  if (!existing) return notFound('Payroll record not found');

  const { data, error } = await service
    .from('hr_payroll_summaries')
    .update({
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
      status: 'APPROVED',
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  await writeHrAuditLog('HR_PAYROLL_SUMMARY_APPROVED', id, ctx.userId, { status: 'APPROVED' }, 'payroll_summary');
  return NextResponse.json(data);
}
