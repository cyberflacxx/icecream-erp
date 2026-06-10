import { NextRequest, NextResponse } from 'next/server';

import { getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function PATCH(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const service = createServiceRoleClient();

  try {
    const { error } = await service
      .schema('icecream_erp')
      .from('notifications')
      .update({ is_read: true })
      .eq('user_profile_id', ctx.userId)
      .eq('is_read', false);

    if (error) throw error;
    return NextResponse.json({ updated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
