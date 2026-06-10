import { NextRequest, NextResponse } from 'next/server';

import {
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read')) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const employeeId = searchParams.get('employeeId') ?? '';
  const status = searchParams.get('status') ?? '';
  const branchId = searchParams.get('branchId') ?? '';

  const service = createServiceRoleClient();

  let query = service
    .from('payroll_records')
    .select(
      `*, employee:employees(id, first_name, last_name, employee_number, branch_id)`,
      { count: 'exact' }
    )
    .is('deleted_at', null);

  if (ctx.isBranchScoped) {
    query = query.eq('employees.branch_id', ctx.branchId!);
  } else if (branchId) {
    query = query.eq('employees.branch_id', branchId);
  }

  if (employeeId) query = query.eq('employee_id', employeeId);
  if (status) query = query.eq('status', status);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return serverError(error.message);

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  const body = await request.json() as {
    employee_id: string;
    pay_period_start: string;
    pay_period_end: string;
    basic_salary: number;
    allowances?: number;
    deductions?: number;
    notes?: string;
  };

  if (!body.employee_id || !body.pay_period_start || !body.pay_period_end || body.basic_salary === undefined) {
    return NextResponse.json(
      { error: 'employee_id, pay_period_start, pay_period_end, and basic_salary are required' },
      { status: 400 }
    );
  }

  const allowances = body.allowances ?? 0;
  const deductions = body.deductions ?? 0;
  const netPay = body.basic_salary + allowances - deductions;

  if (netPay < 0) {
    return NextResponse.json(
      { error: 'Net pay cannot be negative. Deductions exceed salary and allowances.' },
      { status: 400 }
    );
  }

  const service = createServiceRoleClient();

  const { data, error } = await service
    .from('payroll_records')
    .insert({
      organization_id: ctx.organizationId,
      employee_id: body.employee_id,
      pay_period_start: body.pay_period_start,
      pay_period_end: body.pay_period_end,
      basic_salary: body.basic_salary,
      allowances,
      deductions,
      net_pay: netPay,
      status: 'DRAFT',
      notes: body.notes ?? null,
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
