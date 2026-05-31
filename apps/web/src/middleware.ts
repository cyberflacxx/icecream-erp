import { NextResponse, type NextRequest } from 'next/server';

const protectedPrefixes = [
  '/dashboard',
  '/procurement',
  '/inventory',
  '/production',
  '/branches',
  '/reports',
  '/settings',
  '/finance',
  '/sales'
];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get('auth_token')?.value);
  const isProtectedRoute = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isProtectedRoute && !hasSession) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
