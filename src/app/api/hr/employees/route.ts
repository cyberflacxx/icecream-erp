import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { EMPLOYEE_STATUSES } from '@/lib/hr';
import { hrService, writeHrAuditLog } from '@/lib/hr-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read')) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20', 10));
  const search = searchParams.get('search') ?? '';
  const department = searchParams.get('department') ?? '';
  const status = searchParams.get('status') ?? '';
  const branchId = searchParams.get('branchId') ?? '';

  const service = hrService();

  let query = service
    .from('employees')
    .select(
      '*, branch:branches(id, name, code), departmentRef:departments(id, code, name), jobRole:hr_job_roles(id, role_name)',
      { count: 'exact' },
    )
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null);

  if (ctx.isBranchScoped) {
    query = query.eq('branch_id', ctx.branchId!);
  } else if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  if (department) query = query.or(`department.eq.${department},department_id.eq.${department}`);
  if (status) query = query.eq('status', status);
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,full_name.ilike.%${search}%,employee_number.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }

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
    employee_number?: string;
    employee_code?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    department?: string;
    department_id?: string;
    job_title?: string;
    job_role?: string;
    job_role_id?: string;
    hire_date?: string;
    status?: string;
    branch_id?: string;
    warehouse_id?: string;
    basic_salary?: number;
    basic_rate?: number;
    hourly_rate?: number;
    shift_rate?: number;
    employment_type?: string;
  };

  const employeeNumber = String(body.employee_number ?? body.employee_code ?? '').trim();
  const fullName = String(body.full_name ?? `${body.first_name ?? ''} ${body.last_name ?? ''}`).trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = String(body.first_name ?? (nameParts.slice(0, -1).join(' ') || (nameParts[0] ?? ''))).trim();
  const lastName = String(body.last_name ?? nameParts.slice(-1)[0] ?? '').trim();

  if (!employeeNumber || !fullName || !body.hire_date) {
    return badRequest('employee_number, full_name, and hire_date are required.');
  }

  if (body.status && !EMPLOYEE_STATUSES.includes(String(body.status).toUpperCase() as (typeof EMPLOYEE_STATUSES)[number])) {
    return badRequest(`status must be one of: ${EMPLOYEE_STATUSES.join(', ')}.`);
  }

  const service = hrService();
  const { data: existing } = await service
    .from('employees')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .eq('employee_number', employeeNumber)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `Employee number ${employeeNumber} already exists` },
      { status: 409 },
    );
  }

  const departmentName = String(body.department ?? '').trim() || null;
  const jobRoleName = String(body.job_role ?? body.job_title ?? '').trim() || null;

  const { data, error } = await service
    .from('employees')
    .insert({
      basic_rate: Number(body.basic_rate ?? body.basic_salary ?? 0),
      branch_id: body.branch_id ?? null,
      department: departmentName,
      department_id: body.department_id ?? null,
      email: body.email || null,
      employee_number: employeeNumber,
      employment_type: body.employment_type ?? null,
      first_name: firstName,
      full_name: fullName,
      hire_date: body.hire_date,
      hourly_rate: Number(body.hourly_rate ?? 0),
      job_role_id: body.job_role_id ?? null,
      job_title: jobRoleName,
      last_name: lastName,
      organization_id: ctx.organizationId,
      phone: body.phone || null,
      shift_rate: Number(body.shift_rate ?? 0),
      status: String(body.status ?? 'ACTIVE').toUpperCase(),
      warehouse_id: body.warehouse_id ?? null,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  await writeHrAuditLog(
    'HR_EMPLOYEE_CREATED',
    String(data.id),
    ctx.userId,
    { employeeNumber, fullName, status: data.status },
    'employee',
  );

  return NextResponse.json(data, { status: 201 });
}
