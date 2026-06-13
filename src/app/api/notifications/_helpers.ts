import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';

export async function requireNotificationAuth(request?: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return { error: unauthorized() } as const;
  return { ctx } as const;
}

export async function requireNotificationAdmin(request?: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return { error: unauthorized() } as const;
  if (!can(ctx, 'settings.manage', 'audit_log.read', 'view_audit_logs')) return { error: forbidden() } as const;
  return { ctx } as const;
}

export function notificationResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function notificationError(error: unknown) {
  return serverError(error instanceof Error ? error.message : 'Internal server error');
}
