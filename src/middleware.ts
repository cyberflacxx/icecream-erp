import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { resolvePublicAppUrl } from '@/lib/app-url';
import { REGISTRATION_REFRESH_VERSION } from '@/lib/registration-refresh';
import { assertServerRuntimeEnv } from '@/lib/runtime-env';

const protectedPrefixes = [
  '/dashboard',
  '/procurement',
  '/inventory',
  '/production',
  '/branches',
  '/reports',
  '/settings',
  '/finance',
  '/sales',
  '/quality',
];

const DEFAULT_TIMEOUT_MINUTES = 15;
const LAST_ACTIVITY_COOKIE = 'icecream-last-activity';
function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function buildCanonicalRedirect(request: NextRequest) {
  const configuredUrl = resolvePublicAppUrl(request.nextUrl);
  const canonicalUrl = new URL(configuredUrl);
  const currentUrl = request.nextUrl;
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? currentUrl.protocol.replace(':', '');
  const needsHttps = !isLocalHostname(currentUrl.hostname) && forwardedProto !== 'https';
  const needsHostRedirect =
    !isLocalHostname(currentUrl.hostname) &&
    currentUrl.hostname.toLowerCase() !== canonicalUrl.hostname.toLowerCase();
  const needsTrailingSlashRedirect =
    currentUrl.pathname.length > 1 && currentUrl.pathname.endsWith('/');

  if (!needsHttps && !needsHostRedirect && !needsTrailingSlashRedirect) {
    return null;
  }

  const redirectUrl = currentUrl.clone();
  redirectUrl.protocol = isLocalHostname(currentUrl.hostname) ? currentUrl.protocol : canonicalUrl.protocol;
  redirectUrl.host = canonicalUrl.host;

  if (needsTrailingSlashRedirect) {
    redirectUrl.pathname = currentUrl.pathname.replace(/\/+$/, '');
  }

  return redirectUrl;
}

export async function middleware(request: NextRequest) {
  const env = assertServerRuntimeEnv();
  const canonicalRedirect = buildCanonicalRedirect(request);
  if (canonicalRedirect) {
    return NextResponse.redirect(canonicalRedirect, 308);
  }

  let supabaseResponse = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  if (pathname === '/auth/register' && request.nextUrl.searchParams.get('rv') !== REGISTRATION_REFRESH_VERSION) {
    const refreshUrl = new URL(resolvePublicAppUrl(request.nextUrl));
    refreshUrl.pathname = pathname;
    refreshUrl.search = request.nextUrl.search;
    refreshUrl.searchParams.set('rv', REGISTRATION_REFRESH_VERSION);
    return NextResponse.redirect(refreshUrl, 307);
  }

  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      db: { schema: 'icecream_erp' },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — required for SSR auth to stay alive
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isLoginPage =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/auth/login') ||
    pathname === '/sign-in';
  const lastActivityCookie = request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  if (isProtected && user && lastActivityCookie) {
    const lastActivityMs = Number(lastActivityCookie);
    const timeoutMs = DEFAULT_TIMEOUT_MINUTES * 60 * 1000;

    if (Number.isFinite(lastActivityMs) && lastActivityMs + timeoutMs <= Date.now()) {
      const response = NextResponse.redirect(new URL('/auth/login?reason=timeout', request.url));
      response.cookies.delete(LAST_ACTIVITY_COOKIE);
      response.cookies.delete('sb-access-token');
      response.cookies.delete('sb-refresh-token');
      return response;
    }
  }

  if (isLoginPage && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isProtected && user) {
    supabaseResponse.cookies.set(LAST_ACTIVITY_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  const shouldDisableCache =
    pathname === '/login' ||
    pathname.startsWith('/auth/login') ||
    pathname === '/auth/register' ||
    pathname.startsWith('/auth/register/') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/procurement' ||
    pathname.startsWith('/procurement/') ||
    pathname === '/production' ||
    pathname.startsWith('/production/') ||
    pathname === '/inventory' ||
    pathname.startsWith('/inventory/') ||
    pathname === '/api/auth/me';

  if (shouldDisableCache) {
    supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    supabaseResponse.headers.set('Pragma', 'no-cache');
    supabaseResponse.headers.set('Expires', '0');
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
