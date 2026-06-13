import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status') ?? 'PENDING';

  const { data, error } = await service
    .from('approval_requests')
    .select(
      `id, entity_type, entity_id, current_step, status, requested_at, completed_at,
       actions:approval_actions(id, action, comments, acted_at)`,
    )
    .eq('status', status)
    .in('entity_type', ['stock_transfer', 'stock_adjustment', 'branch_transfer', 'goods_return', 'stock_take'])
    .order('requested_at', { ascending: false });

  if (error) return serverError(error.message);

  return NextResponse.json(data ?? []);
}
