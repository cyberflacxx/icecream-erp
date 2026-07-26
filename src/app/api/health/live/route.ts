import { NextResponse } from 'next/server';

import { buildLivePayload } from '@/lib/health';

export async function GET() {
  return NextResponse.json(buildLivePayload(), {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}
