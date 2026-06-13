import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { listUserSessions } from '@/lib/security-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'manage_users', 'view_audit_logs', 'settings.read', 'settings.manage')) return forbidden();

  try {
    const sessions = await listUserSessions();
    return NextResponse.json(
      sessions.map((session) => ({
        id: String((session as Record<string, unknown>).token),
        userId: String((session as Record<string, unknown>).user_account_id),
        ipAddress: (session as Record<string, unknown>).ip_address ?? null,
        userAgent: (session as Record<string, unknown>).user_agent ?? null,
        createdAt: (session as Record<string, unknown>).created_at,
        lastActivityAt: (session as Record<string, unknown>).updated_at,
        expiresAt: (session as Record<string, unknown>).expires_at,
        status: 'ACTIVE',
      })),
    );
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}
