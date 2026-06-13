import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildPayrollSummaryRows, hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'payroll.create')) return forbidden();

  try {
    const body = await request.json() as { payroll_period_id?: string };
    if (!body.payroll_period_id) return badRequest('payroll_period_id is required.');

    const rows = await buildPayrollSummaryRows(body.payroll_period_id);
    const service = hrService();
    const payload = rows.map((row) => ({
      allowances: row.allowances,
      basic_pay: row.basicPay,
      created_by: ctx.userId,
      deductions: row.deductions,
      employee_id: row.employeeId,
      gross_pay: row.grossPay,
      net_pay: row.netPay,
      organization_id: ctx.organizationId,
      overtime_pay: row.overtimePay,
      payroll_period_id: body.payroll_period_id,
      status: 'PENDING_APPROVAL',
      updated_by: ctx.userId,
    }));

    const { data, error } = await service
      .from('hr_payroll_summaries')
      .upsert(payload, { onConflict: 'payroll_period_id,employee_id' })
      .select();
    if (error) throw error;

    await writeHrAuditLog('HR_PAYROLL_GENERATED', body.payroll_period_id, ctx.userId, { rows: payload.length }, 'payroll_period');
    return NextResponse.json({ data: data ?? [], generated: payload.length });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to generate payroll summaries.');
  }
}
