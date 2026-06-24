import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const service = createServiceRoleClient();

  try {
    const { data, error } = await service
      .schema('icecream_erp')
      .from('branches')
      .select('id, code, name, status')
      .is('deleted_at', null)
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({
      data: (data ?? []).map((branch) => ({
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
