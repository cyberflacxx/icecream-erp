import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';

export async function requireAdminAccess(permission: 'read' | 'write', request?: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return { error: unauthorized() } as const;
  if (
    permission === 'read'
      ? !can(ctx, 'settings.manage', 'reports.read', 'audit_log.read')
      : !can(ctx, 'settings.manage')
  ) {
    return { error: forbidden() } as const;
  }
  return { ctx } as const;
}

export function adminResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function adminError(error: unknown) {
  return serverError(error instanceof Error ? error.message : 'Internal server error');
}
