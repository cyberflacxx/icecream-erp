import { NextResponse } from 'next/server';

import { buildHealthPayload } from '@/lib/health';

export async function GET() {
  const payload = await buildHealthPayload();

  return NextResponse.json(payload, {
    status: payload.checks.database === 'ok' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}
