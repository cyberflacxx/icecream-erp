import { NextRequest, NextResponse } from 'next/server';

import { forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { getSafeNotificationErrorDetails, NOTIFICATION_API_FAILURE_MESSAGE } from '@/lib/notifications-server';

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

export function notificationError(
  error: unknown,
  options?: {
    fallbackData?: unknown;
    routeName?: string;
    safeMessage?: string;
  },
) {
  const safeDetails = getSafeNotificationErrorDetails(error);
  console.error('Notification API failed.', {
    routeName: options?.routeName ?? '/api/notifications',
    step: safeDetails.step,
    table: safeDetails.table,
    code: safeDetails.code,
    detail: safeDetails.detail,
    message: safeDetails.message,
  });

  if (options && 'fallbackData' in options) {
    return notificationResponse(options.fallbackData, 200);
  }

  return serverError(options?.safeMessage ?? NOTIFICATION_API_FAILURE_MESSAGE);
}
