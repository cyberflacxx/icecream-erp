import { NextResponse } from 'next/server';

import { getAuthContext } from '@/lib/api-auth';
import { recordSecurityEvent } from '@/lib/security-server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  const supabase = await createClient();
  await supabase.auth.signOut();

  if (ctx) {
    await recordSecurityEvent({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      eventType: 'LOGOUT',
      status: 'SUCCESS',
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('icecream-last-activity');
  return response;
}
