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
    .from('leave_applications')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Leave request not found');

  return NextResponse.json(data);
}
