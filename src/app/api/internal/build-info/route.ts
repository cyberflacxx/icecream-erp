import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { getBuildInfo } from '@/lib/build-info';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'dashboard.read')) return forbidden();

  return NextResponse.json({
    success: true,
    build: getBuildInfo(),
    serverTime: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}
