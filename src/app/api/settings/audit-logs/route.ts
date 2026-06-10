import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const action = searchParams.get('action') ?? undefined;
  const entityType = searchParams.get('entityType') ?? undefined;
  const userProfileId = searchParams.get('userProfileId') ?? undefined;
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;

  try {
    let query = service
      .schema('icecream_erp')
      .from('audit_logs')
      .select('id, action, entity_id, entity_type, created_at, user_profile_id, users(full_name, first_name, last_name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (action) query = query.ilike('action', `%${action}%`);
    if (entityType) query = query.ilike('entity_type', `%${entityType}%`);
    if (userProfileId) query = query.eq('user_profile_id', userProfileId);
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((log: Record<string, unknown>) => {
        const user = log.users as { full_name?: string; first_name?: string; last_name?: string } | null;
        const userName = user?.full_name ?? (user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : 'System');
        return {
          id: log.id,
          action: log.action,
          entityId: log.entity_id,
          entityType: log.entity_type,
          createdAt: log.created_at,
          user: userName,
        };
      }),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
