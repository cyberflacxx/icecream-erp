import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? undefined;
  const accountType = searchParams.get('accountType') ?? undefined;

  try {
    let query = service
      .schema('icecream_erp')
      .from('accounts')
      .select('id, code, name, account_type, is_active, parent_id')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (accountType) query = query.eq('account_type', accountType);
    if (search) query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
