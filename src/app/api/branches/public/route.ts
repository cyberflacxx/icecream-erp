import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Expires: '0',
  Pragma: 'no-cache',
  'Surrogate-Control': 'no-store',
};

export async function GET() {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        {
          data: [],
          error: 'Branch service is not configured.',
        },
        {
          status: 500,
          headers: NO_CACHE_HEADERS,
        },
      );
    }

    const service = createServiceRoleClient().schema('icecream_erp');

    const { data, error } = await service
      .from('branches')
      .select('id, code, name, status, deleted_at')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      console.error('Unable to load public registration branches.', {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });

      return NextResponse.json(
        {
          data: [],
          error: 'Unable to load branches.',
        },
        {
          status: 500,
          headers: NO_CACHE_HEADERS,
        },
      );
    }

    const branches = (data ?? [])
      .filter((branch) => {
        const status = String(branch.status ?? '').trim().toUpperCase();
        return status === 'ACTIVE';
      })
      .map((branch) => ({
        code: branch.code,
        id: branch.id,
        name: branch.name,
      }));

    return NextResponse.json(
      {
        data: branches,
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      },
    );
  } catch (error) {
    console.error('Unexpected public branch loading error.', error);

    return NextResponse.json(
      {
        data: [],
        error: 'Unable to load branches.',
      },
      {
        status: 500,
        headers: NO_CACHE_HEADERS,
      },
    );
  }
}
