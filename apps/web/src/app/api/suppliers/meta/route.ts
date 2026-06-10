import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'suppliers.read')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const { data, error } = await service
      .from('supplier_categories')
      .select('id, name, description')
      .eq('organization_id', ctx.organizationId)
      .order('name');

    if (error) return serverError(error.message);

    return NextResponse.json({ categories: data ?? [] });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
