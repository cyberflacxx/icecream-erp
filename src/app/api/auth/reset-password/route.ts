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
  const { data: user } = await service
    .from('users')
    .select('auth_id, organization_id')
    .eq('id', resetRecord.userAccountId)
    .maybeSingle();

  if (!user || !(user as Record<string, unknown>).auth_id) {
    return NextResponse.json({ error: 'Linked account not found.' }, { status: 404 });
  }

  const { error } = await service.auth.admin.updateUserById(String((user as Record<string, unknown>).auth_id), {
    password: newPassword,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordSecurityEvent({
    organizationId: String((user as Record<string, unknown>).organization_id ?? ''),
    userProfileId: resetRecord.userAccountId,
    eventType: 'PASSWORD_RESET',
    status: 'SUCCESS',
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ success: true });
}
