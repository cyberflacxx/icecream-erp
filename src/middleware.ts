import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

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

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  const isLoginPage = pathname.startsWith('/auth/login') || pathname === '/sign-in';
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

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
