import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { getLockoutExpiry } from '@/lib/security';
import { getSystemSecuritySettings, recordAuditLog, recordSecurityEvent } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'manage_users', 'users.write', 'user.manage')) return forbidden();

  const { id } = await params;
  const settings = await getSystemSecuritySettings();
  const lockedUntil = getLockoutExpiry(new Date(), settings.lockoutDurationMinutes).toISOString();
  const service = createServiceRoleClient().schema('icecream_erp');
  const { error } = await service.from('users').update({ status: 'locked', locked_until: lockedUntil }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await Promise.all([
    recordAuditLog({
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      action: 'USER_LOCKED',
      entityType: 'user',
      entityId: id,
      newValues: { lockedUntil },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    }),
    recordSecurityEvent({
      organizationId: ctx.organizationId,
      userProfileId: id,
      eventType: 'ACCOUNT_LOCKED',
      status: 'LOCKED',
      details: { lockedUntil },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    }),
  ]);

  return NextResponse.json({ success: true, status: 'LOCKED', lockedUntil });
}
