import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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
import { isSupabaseNetworkTimeout } from '@/lib/supabase/fetch';
import { workIdToEmail } from '@/lib/auth-roles';
import { assertServerRuntimeEnv } from '@/lib/runtime-env';

const DEFAULT_LOGIN_TIMEOUT_MS = 12_000;
const LAST_ACTIVITY_COOKIE = 'icecream-last-activity';

function getLoginTimeoutMs() {
  const parsed = Number(process.env.AUTH_LOGIN_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(3_000, parsed) : DEFAULT_LOGIN_TIMEOUT_MS;
}

function loginTimeoutResponse(timeoutMs: number) {
  return new Promise<NextResponse>((resolve) => {
    setTimeout(() => {
      resolve(
        NextResponse.json(
          { error: 'Supabase is not reachable right now. Check the configured database URL/network and try again.' },
          { status: 503 },
        ),
      );
    }, timeoutMs);
  });
}

export async function POST(request: Request) {
  const timeoutMs = getLoginTimeoutMs();
  return Promise.race([handleLogin(request), loginTimeoutResponse(timeoutMs)]);
}

async function handleLogin(request: Request) {
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

    const env = assertServerRuntimeEnv();
    const supabase = createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey, {
      db: { schema: 'icecream_erp' },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
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

    const authCookies: Array<{
      name: string;
      value: string;
      options?: Record<string, unknown>;
    }> = [];
    const cookieSupabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      db: { schema: 'icecream_erp' },
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookiesToSet) {
          authCookies.push(...cookiesToSet);
        },
      },
    });
    const { error: setSessionError } = await cookieSupabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (setSessionError) {
      throw setSessionError;
    }

    const response = NextResponse.json({
      success: true,
      redirectTo: '/dashboard',
      sessionTimeoutMinutes: resolved.sessionTimeoutMinutes,
    });
    const secure = request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:';
    authCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, {
        ...(options ?? {}),
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure,
      });
    });
    response.cookies.set(LAST_ACTIVITY_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure,
    });
    return response;
  } catch (error) {
    if (isSupabaseNetworkTimeout(error)) {
      return NextResponse.json(
        { error: 'Supabase is not reachable right now. Check the configured database URL/network and try again.' },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : 'Login failed unexpectedly.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
