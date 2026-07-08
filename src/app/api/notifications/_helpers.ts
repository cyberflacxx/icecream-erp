import { NextRequest, NextResponse } from 'next/server';

import { forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';

export function hasNotificationAdminAccess(ctx: { permissions: string[] }) {
  return ctx.permissions.includes('settings.manage') || ctx.permissions.includes('audit_log.read') || ctx.permissions.includes('view_audit_logs');
}

export async function requireNotificationAuth(request?: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return { error: unauthorized() } as const;
  return { ctx } as const;
}

export async function requireNotificationAdmin(request?: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return { error: unauthorized() } as const;
  if (!hasNotificationAdminAccess(ctx)) return { error: forbidden() } as const;
  return { ctx } as const;
}

export function notificationResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function notificationError(error: unknown) {
  return serverError(error instanceof Error ? error.message : 'Internal server error');
}
