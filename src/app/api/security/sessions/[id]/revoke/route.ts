import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { recordAuditLog, revokeSession } from '@/lib/security-server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'manage_users', 'settings.write', 'settings.manage')) return forbidden();

  const { id } = await params;
  try {
    await revokeSession(id);
    await recordAuditLog({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      action: 'SESSION_REVOKED',
      entityType: 'auth_session',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}
