import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { listSecurityEvents } from '@/lib/security-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'view_audit_logs', 'settings.read', 'settings.manage')) return forbidden();

  const { searchParams } = new URL(request.url);
  try {
    const query = await listSecurityEvents({
      eventType: searchParams.get('eventType') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      userProfileId: searchParams.get('userProfileId') ?? undefined,
    });
    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      data: data ?? [],
      pagination: {
        page: Number(searchParams.get('page') ?? '1'),
        pageSize: Number(searchParams.get('pageSize') ?? '20'),
        total: count ?? 0,
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}
