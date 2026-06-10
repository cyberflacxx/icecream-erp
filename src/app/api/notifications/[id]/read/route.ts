import { NextRequest, NextResponse } from 'next/server';

import { getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: existing } = await service
      .schema('icecream_erp')
      .from('notifications')
      .select('id')
      .eq('id', id)
      .eq('user_profile_id', ctx.userId)
      .maybeSingle();

    if (!existing) return notFound('Notification not found');

    const { data: updated, error } = await service
      .schema('icecream_erp')
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
