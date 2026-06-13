import { NextResponse } from 'next/server';

import { createPasswordResetRequest, findSecurityUserProfileByWorkId, recordSecurityEvent } from '@/lib/security-server';

export async function POST(request: Request) {
  const body = (await request.json()) as { workId?: string };
  const workId = String(body.workId ?? '').trim().toUpperCase();
  if (!workId) {
    return NextResponse.json({ error: 'Work ID is required.' }, { status: 400 });
  }

  const profile = await findSecurityUserProfileByWorkId(workId);
  if (!profile) {
    return NextResponse.json({ success: true });
  }

  const reset = await createPasswordResetRequest(profile);
  await recordSecurityEvent({
    organizationId: profile.organizationId,
    userProfileId: profile.id,
    eventType: 'PASSWORD_RESET',
    status: 'REQUESTED',
    details: { expiresAt: reset.expiresAt },
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ success: true, resetToken: reset.token, expiresAt: reset.expiresAt });
}
