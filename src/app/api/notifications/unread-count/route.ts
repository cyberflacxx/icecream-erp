import { NextRequest, NextResponse } from 'next/server';

import { getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const service = createServiceRoleClient();

  try {
    const { count, error } = await service
      .schema('icecream_erp')
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_profile_id', ctx.userId)
      .eq('is_read', false);

    if (error) throw error;
    return NextResponse.json({ count: count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
