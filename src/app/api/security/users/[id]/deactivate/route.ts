import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'manage_users', 'users.write', 'user.manage')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient().schema('icecream_erp');
  const { error } = await service.from('users').update({ status: 'inactive' }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAuditLog({
    organizationId: ctx.organizationId,
    userProfileId: ctx.userId,
    action: 'USER_DEACTIVATED',
    entityType: 'user',
    entityId: id,
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ success: true, status: 'INACTIVE' });
}
