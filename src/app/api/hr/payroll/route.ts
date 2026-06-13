import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'payroll.read')) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20', 10));
  const employeeId = searchParams.get('employeeId') ?? '';
  const status = searchParams.get('status') ?? '';
  const branchId = searchParams.get('branchId') ?? '';

  const service = hrService();

  let query = service
    .from('hr_payroll_summaries')
    .select(
      '*, employee:employees(id, first_name, last_name, employee_number, branch_id, department), period:hr_payroll_periods(id, period_name, start_date, end_date)',
      { count: 'exact' },
    )
    .eq('organization_id', ctx.organizationId);

  if (employeeId) query = query.eq('employee_id', employeeId);
  if (status) query = query.eq('status', status);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return serverError(error.message);

  const filtered = (data ?? []).filter((row: Record<string, unknown>) => {
    const employee = row.employee as Record<string, unknown> | null;
    if (ctx.isBranchScoped) return String(employee?.branch_id ?? '') === ctx.branchId;
    if (branchId) return String(employee?.branch_id ?? '') === branchId;
    return true;
  });

  return NextResponse.json({
    data: filtered,
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write', 'payroll.create')) return forbidden();

  const body = await request.json() as {
    employee_id: string;
    payroll_period_id?: string;
    basic_pay?: number;
    basic_salary?: number;
    overtime_pay?: number;
    allowances?: number;
    deductions?: number;
    gross_pay?: number;
    net_pay?: number;
  };

  if (!body.employee_id || !body.payroll_period_id) {
    return badRequest('employee_id and payroll_period_id are required.');
  }

  const allowances = Number(body.allowances ?? 0);
  const deductions = Number(body.deductions ?? 0);
  const basicPay = Number(body.basic_pay ?? body.basic_salary ?? 0);
  const overtimePay = Number(body.overtime_pay ?? 0);
  const grossPay = Number(body.gross_pay ?? basicPay + overtimePay + allowances);
  const netPay = Number(body.net_pay ?? grossPay - deductions);
  if (netPay < 0) return badRequest('Net pay cannot be negative.');

  const service = hrService();
  const { data, error } = await service
    .from('hr_payroll_summaries')
    .insert({
      allowances,
      basic_pay: basicPay,
      created_by: ctx.userId,
      deductions,
      employee_id: body.employee_id,
      gross_pay: grossPay,
      net_pay: netPay,
      organization_id: ctx.organizationId,
      overtime_pay: overtimePay,
      payroll_period_id: body.payroll_period_id,
      status: 'DRAFT',
      updated_by: ctx.userId,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  await writeHrAuditLog('HR_PAYROLL_SUMMARY_CREATED', String(data.id), ctx.userId, data as Record<string, unknown>, 'payroll_summary');
  return NextResponse.json(data, { status: 201 });
}
