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
  const search = searchParams.get('search') ?? '';
  const department = searchParams.get('department') ?? '';
  const status = searchParams.get('status') ?? '';
  const branchId = searchParams.get('branchId') ?? '';

  const service = createServiceRoleClient();

  let query = service
    .from('employees')
    .select(
      '*, branch:branches(id, name, code)',
      { count: 'exact' }
    )
    .is('deleted_at', null);

  if (ctx.isBranchScoped) {
    query = query.eq('branch_id', ctx.branchId!);
  } else if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  if (department) query = query.eq('department', department);
  if (status) query = query.eq('status', status);
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_number.ilike.%${search}%,email.ilike.%${search}%`
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
    employee_number: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    department?: string;
    job_title?: string;
    hire_date: string;
    status?: string;
    branch_id?: string;
    basic_salary?: number;
    [key: string]: unknown;
  };

  if (!body.employee_number || !body.first_name || !body.last_name || !body.hire_date) {
    return NextResponse.json(
      { error: 'employee_number, first_name, last_name, and hire_date are required' },
      { status: 400 }
    );
  }

  const service = createServiceRoleClient();

  // Duplicate check
  const { data: existing } = await service
    .from('employees')
    .select('id')
    .eq('employee_number', body.employee_number)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `Employee number ${body.employee_number} already exists` },
      { status: 409 }
    );
  }

  const { data, error } = await service
    .from('employees')
    .insert({
      ...body,
      email: body.email || null,
      organization_id: ctx.organizationId,
    })
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data, { status: 201 });
}
