import { NextRequest, NextResponse } from 'next/server';

import {
  can,
  forbidden,
  getAuthContext,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  const { data, error } = await service
    .from('employees')
    .select(`
      *,
      branch:branches(*),
      attendances(*),
      payroll_records(*)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Employee not found');

  if (ctx.isBranchScoped && data.branch_id !== ctx.branchId) return forbidden();

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  const { data: existing, error: fetchErr } = await service
    .from('employees')
    .select('id, branch_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchErr) return serverError(fetchErr.message);
  if (!existing) return notFound('Employee not found');
  if (ctx.isBranchScoped && existing.branch_id !== ctx.branchId) return forbidden();

  const body = await request.json() as Record<string, unknown>;

  // Normalise email: empty string → null
  if (body.email === '') body.email = null;
  if (body.hire_date && typeof body.hire_date === 'string') {
    body.hire_date = new Date(body.hire_date).toISOString().split('T')[0];
  }

  const { data, error } = await service
    .from('employees')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  const { data: existing, error: fetchErr } = await service
    .from('employees')
    .select('id, branch_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchErr) return serverError(fetchErr.message);
  if (!existing) return notFound('Employee not found');
  if (ctx.isBranchScoped && existing.branch_id !== ctx.branchId) return forbidden();

  const { data, error } = await service
    .from('employees')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'TERMINATED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
