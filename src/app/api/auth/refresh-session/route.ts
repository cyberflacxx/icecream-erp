import { NextResponse } from 'next/server';

import { getAuthContext, unauthorized } from '@/lib/api-auth';

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();

  return NextResponse.json({
    success: true,
    sessionTimeoutMinutes: ctx.sessionTimeoutMinutes,
  });
}
