import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.read')) return forbidden();

  const service = createServiceRoleClient();

  try {
    const { data: permissions, error } = await service
      .schema('icecream_erp')
      .from('permissions')
      .select('id, code, name, module')
      .order('module', { ascending: true })
      .order('code', { ascending: true });

    if (error) throw error;

    // Group by module
    const grouped = (permissions ?? []).reduce<Record<string, Array<{ id: string; code: string; name: string }>>>(
      (acc, p: { id: string; code: string; name: string; module: string }) => {
        const bucket = acc[p.module] ?? [];
        bucket.push({ id: p.id, code: p.code, name: p.name });
        acc[p.module] = bucket;
        return acc;
      },
      {}
    );

    return NextResponse.json(grouped);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
