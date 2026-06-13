import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';

export async function requireTestingAccess(permission: 'read' | 'write' | 'approve', request?: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return { error: unauthorized() } as const;
  if (
    permission === 'read'
      ? !can(ctx, 'reports.read', 'audit_log.read', 'settings.manage', 'finance.read')
      : permission === 'write'
        ? !can(ctx, 'settings.manage', 'finance.manage')
        : !can(ctx, 'settings.manage', 'finance.manage', 'audit_log.read')
  ) {
    return { error: forbidden() } as const;
  }
  return { ctx } as const;
}

export function testingResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function testingError(error: unknown) {
  return serverError(error instanceof Error ? error.message : 'Internal server error');
}
