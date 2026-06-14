import { NextResponse } from 'next/server';

import {
  buildSecurityContextProfile,
  clearFailedLogin,
  findSecurityUserProfileByWorkId,
  getSystemSecuritySettings,
  incrementFailedLogin,
  recordLoginAttempt,
  recordSecurityEvent,
  registerSession,
} from '@/lib/security-server';
import { createClient } from '@/lib/supabase/server';
import { workIdToEmail } from '@/lib/auth-roles';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string; workId?: string };
    const workId = String(body.workId ?? '').trim().toUpperCase();
    const password = String(body.password ?? '');
    const ipAddress = request.headers.get('x-forwarded-for');
    const userAgent = request.headers.get('user-agent');

    if (!workId || !password) {
      return NextResponse.json({ error: 'Work ID and password are required.' }, { status: 400 });
    }

    const [profile, settings] = await Promise.all([
      findSecurityUserProfileByWorkId(workId),
      getSystemSecuritySettings(),
    ]);

    if (!profile) {
      await recordLoginAttempt({ workId, status: 'FAILED', ipAddress, userAgent, reason: 'User not found' });
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    if (profile.status === 'INACTIVE' || profile.status === 'SUSPENDED') {
      await recordLoginAttempt({ workId, userProfileId: profile.id, status: 'FAILED', ipAddress, userAgent, reason: profile.status });
      await recordSecurityEvent({
        organizationId: profile.organizationId,
        userProfileId: profile.id,
        eventType: 'LOGIN_FAILED',
        status: profile.status,
        details: { reason: `Account ${profile.status.toLowerCase()}` },
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ error: 'This account is not allowed to sign in.' }, { status: 403 });
    }

    if (profile.status === 'LOCKED' || (profile.lockedUntil && new Date(profile.lockedUntil).getTime() > Date.now())) {
      await recordLoginAttempt({ workId, userProfileId: profile.id, status: 'LOCKED_OUT', ipAddress, userAgent, reason: 'Account locked' });
      return NextResponse.json({ error: 'This account is locked. Contact a system administrator.' }, { status: 423 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: workIdToEmail(workId),
      password,
    });

    if (error || !data.session || !data.user) {
      const failed = await incrementFailedLogin(profile, settings);
      await recordLoginAttempt({
        workId,
        userProfileId: profile.id,
        status: failed.locked ? 'LOCKED_OUT' : 'FAILED',
        ipAddress,
        userAgent,
        reason: error?.message ?? 'Invalid credentials',
      });
      await recordSecurityEvent({
        organizationId: profile.organizationId,
        userProfileId: profile.id,
        eventType: failed.locked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
        status: failed.locked ? 'LOCKED' : 'FAILED',
        details: { failedLoginAttempts: failed.failedLoginAttempts },
        ipAddress,
        userAgent,
      });

      return NextResponse.json(
        { error: failed.locked ? 'Account locked after repeated failed attempts.' : 'Invalid credentials.' },
        { status: failed.locked ? 423 : 401 },
      );
    }

    await clearFailedLogin(profile.id);
    const resolved = await buildSecurityContextProfile(profile);
    await registerSession({
      userAccountId: profile.userAccountId,
      userProfileId: profile.id,
      accessToken: data.session.access_token,
      ipAddress,
      userAgent,
      timeoutMinutes: resolved.sessionTimeoutMinutes,
    });
    await recordLoginAttempt({ workId, userProfileId: profile.id, status: 'SUCCESS', ipAddress, userAgent });
    await recordSecurityEvent({
      organizationId: profile.organizationId,
      userProfileId: profile.id,
      eventType: 'LOGIN_SUCCESS',
      status: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      redirectTo: '/dashboard',
      sessionTimeoutMinutes: resolved.sessionTimeoutMinutes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed unexpectedly.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
