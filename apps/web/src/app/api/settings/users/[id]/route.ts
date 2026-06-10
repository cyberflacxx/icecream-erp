import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'users.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: user, error } = await service
      .from('users')
      .select('id, work_id, email, full_name, first_name, last_name, role, status, branch_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !user) return notFound('User not found.');

    return NextResponse.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name ?? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      workId: user.work_id,
      status: String(user.status ?? 'active').toLowerCase(),
      roles: [{ id: String(user.role ?? 'staff'), name: String(user.role ?? 'staff') }],
      branch: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
