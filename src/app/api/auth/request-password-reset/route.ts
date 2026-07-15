import { NextResponse } from 'next/server';

import { sendTransactionalEmail } from '@/lib/email';
import {
  createPasswordResetRequest,
  findSecurityUserProfileByWorkId,
  markPasswordResetTokenUsed,
  recordSecurityEvent,
} from '@/lib/security-server';

const PASSWORD_RESET_EMAIL_FAILURE_MESSAGE = 'Password reset email could not be sent. Please contact the system administrator.';

function getResetBaseUrl(request: Request) {
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? '').trim();
  if (appUrl) {
    return appUrl.replace(/\/+$/, '');
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  let resetId = '';

  try {
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
    resetId = reset.id;
    const resetUrl = new URL('/auth/reset-password', getResetBaseUrl(request));
    resetUrl.searchParams.set('token', reset.token);

    await sendTransactionalEmail({
      to: profile.email,
      subject: 'Reset your Absolute Ice Cream ERP password',
      text: [
        `Hello ${profile.firstName || profile.fullName || 'team'},`,
        '',
        'A password reset was requested for your Absolute Ice Cream ERP account.',
        `Work ID: ${profile.workId}`,
        `Reset link: ${resetUrl.toString()}`,
        `This link expires at ${new Date(reset.expiresAt).toLocaleString()}.`,
        '',
        'If you did not request this reset, contact your system administrator.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; color: #17212b; line-height: 1.6;">
          <p>Hello ${profile.firstName || profile.fullName || 'team'},</p>
          <p>A password reset was requested for your Absolute Ice Cream ERP account.</p>
          <p><strong>Work ID:</strong> ${profile.workId}</p>
          <p>
            <a href="${resetUrl.toString()}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:600;">
              Reset password
            </a>
          </p>
          <p>This link expires at <strong>${new Date(reset.expiresAt).toLocaleString()}</strong>.</p>
          <p>If you did not request this reset, contact your system administrator.</p>
        </div>
      `,
    });

    await recordSecurityEvent({
      organizationId: profile.organizationId,
      userProfileId: profile.id,
      eventType: 'PASSWORD_RESET',
      status: 'REQUESTED',
      details: { expiresAt: reset.expiresAt },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true, expiresAt: reset.expiresAt });
  } catch (error) {
    if (resetId) {
      await markPasswordResetTokenUsed(resetId).catch(() => undefined);
    }
    if (error instanceof Error && error.message === 'OTP could not be sent. Please contact the system administrator.') {
      return NextResponse.json({ error: PASSWORD_RESET_EMAIL_FAILURE_MESSAGE }, { status: 503 });
    }
    console.error('Password reset request failed with safe server error.', {
      message: error instanceof Error ? error.message : 'Unknown password reset request failure',
      step: 'request_password_reset',
    });
    return NextResponse.json({ error: 'Password reset request failed. Please try again.' }, { status: 500 });
  }
}
