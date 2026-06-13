import { NextResponse } from 'next/server';

import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { getSystemSecuritySettings, recordSecurityEvent } from '@/lib/security-server';
import { createClient } from '@/lib/supabase/server';

function validatePassword(password: string, settings: Awaited<ReturnType<typeof getSystemSecuritySettings>>) {
  if (password.length < settings.passwordMinLength) {
    return `Password must be at least ${settings.passwordMinLength} characters.`;
  }
  if (settings.requireUppercase && !/[A-Z]/.test(password)) return 'Password must include an uppercase letter.';
  if (settings.requireLowercase && !/[a-z]/.test(password)) return 'Password must include a lowercase letter.';
  if (settings.requireNumber && !/[0-9]/.test(password)) return 'Password must include a number.';
  if (settings.requireSpecialCharacter && !/[^A-Za-z0-9]/.test(password)) return 'Password must include a special character.';
  return null;
}

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();

  const body = (await request.json()) as { newPassword?: string };
  const newPassword = String(body.newPassword ?? '');
  const settings = await getSystemSecuritySettings();
  const passwordError = validatePassword(newPassword, settings);

  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordSecurityEvent({
    organizationId: ctx.organizationId,
    userProfileId: ctx.userId,
    eventType: 'PASSWORD_CHANGED',
    status: 'SUCCESS',
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ success: true });
}
