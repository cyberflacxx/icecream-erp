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
    .from('attendances')
    .select('*, employee:employees(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Attendance record not found');

  // Branch scoping: check via related employee
  if (ctx.isBranchScoped) {
    const emp = data.employee as { branch_id?: string } | null;
    if (emp?.branch_id !== ctx.branchId) return forbidden();
  }

  return NextResponse.json(data);
}
