import { NextResponse } from 'next/server';

import {
  clearFailedLogin,
  consumePasswordResetToken,
  getSystemSecuritySettings,
  markPasswordResetTokenUsed,
  recordSecurityEvent,
  validatePasswordResetPassword,
} from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = (await request.json()) as { newPassword?: string; token?: string };
  const token = String(body.token ?? '');
  const newPassword = String(body.newPassword ?? '');

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Token and new password are required.' }, { status: 400 });
  }

  try {
    const settings = await getSystemSecuritySettings();
    const passwordError = validatePasswordResetPassword(newPassword, settings);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
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
      console.error('Password reset failed with safe auth error.', {
        code: typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code ?? 'UNKNOWN') : 'UNKNOWN',
        message: error.message,
        step: 'update_supabase_auth_password',
      });
      return NextResponse.json({ error: 'Account password could not be updated. Please contact the system administrator.' }, { status: 400 });
    }

    await Promise.all([
      markPasswordResetTokenUsed(resetRecord.id),
      clearFailedLogin(resetRecord.userProfileId).catch(() => undefined),
    ]);

    await recordSecurityEvent({
      organizationId: resetRecord.organizationId,
      userProfileId: resetRecord.userProfileId,
      eventType: 'PASSWORD_RESET',
      status: 'SUCCESS',
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset failed with safe server error.', {
      message: error instanceof Error ? error.message : 'Unknown password reset failure',
      step: 'reset_password',
    });
    return NextResponse.json({ error: 'Password reset failed. Please try again.' }, { status: 500 });
  }
}
