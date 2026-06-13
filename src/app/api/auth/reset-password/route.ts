import { NextResponse } from 'next/server';

import { consumePasswordResetToken, recordSecurityEvent } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = (await request.json()) as { newPassword?: string; token?: string };
  const token = String(body.token ?? '');
  const newPassword = String(body.newPassword ?? '');

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Token and new password are required.' }, { status: 400 });
  }

  const resetRecord = await consumePasswordResetToken(token);
  if (!resetRecord) {
    return NextResponse.json({ error: 'Invalid or expired reset token.' }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { error } = await service.auth.admin.updateUserById(resetRecord.authId, {
    password: newPassword,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordSecurityEvent({
    organizationId: resetRecord.organizationId,
    userProfileId: resetRecord.userProfileId,
    eventType: 'PASSWORD_RESET',
    status: 'SUCCESS',
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ success: true });
}
