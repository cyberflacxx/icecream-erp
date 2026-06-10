import { NextResponse } from 'next/server';

import { ROLES } from '@/lib/auth-roles';

/** Public endpoint — no auth required. Used by the self-registration page. */
export async function GET() {
  return NextResponse.json({
    data: ROLES.map((r) => ({ id: r.id, name: r.name })),
  });
}
