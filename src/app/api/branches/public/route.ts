import { NextResponse } from 'next/server';

import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const service = createServiceRoleClient();

  try {
    let result = await service
      .schema('icecream_erp')
      .from('branches')
      .select('id, code, name, status')
      .is('deleted_at', null)
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true });

    if (result.error && isMissingColumnError(result.error, 'branches', 'deleted_at')) {
      result = await service
        .schema('icecream_erp')
        .from('branches')
        .select('id, code, name, status')
        .eq('status', 'ACTIVE')
        .order('name', { ascending: true });
    }

    if (result.error) {
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({
      data: (result.data ?? []).map((branch) => ({
        id: String(branch.id),
        code: String(branch.code ?? ''),
        name: String(branch.name ?? ''),
        status: String(branch.status ?? 'ACTIVE'),
      })),
    });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
