import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

function isMissingColumnError(error: unknown, columnName: string) {
  return error instanceof Error && error.message.includes(`column accounts.${columnName} does not exist`);
}

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

    const primary = await query;
    if (!primary.error) {
      return NextResponse.json({ data: primary.data ?? [] });
    }

    if (!isMissingColumnError(primary.error, 'account_type')) {
      throw primary.error;
    }

    let fallbackQuery = service
      .schema('icecream_erp')
      .from('accounts')
      .select('id, code, name, type, is_active, parent_id')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (accountType) fallbackQuery = fallbackQuery.eq('type', accountType);
    if (search) fallbackQuery = fallbackQuery.or(`code.ilike.%${search}%,name.ilike.%${search}%`);

    const fallback = await fallbackQuery;
    if (fallback.error) throw fallback.error;

    return NextResponse.json({
      data: (fallback.data ?? []).map((row) => ({
        ...row,
        account_type: row.type,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
