import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { getSystemSecuritySettings, recordAuditLog, updateSystemSecuritySettings } from '@/lib/security-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.read', 'settings.manage')) return forbidden();

  try {
    return NextResponse.json(await getSystemSecuritySettings());
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}

export async function PATCH(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'settings.write', 'settings.manage')) return forbidden();

  const body = (await request.json()) as Record<string, unknown>;
  try {
    await updateSystemSecuritySettings(body, ctx.userId);
    await recordAuditLog({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      action: 'SECURITY_SETTINGS_UPDATED',
      entityType: 'system_setting',
      entityId: 'security',
      newValues: body,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.json(await getSystemSecuritySettings());
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Internal server error');
  }
}
