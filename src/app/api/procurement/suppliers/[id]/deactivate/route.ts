import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.supplier.deactivate', 'procurement.supplier.write', 'supplier.update', 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const { data: existing, error: fetchError } = await service
    .from('suppliers')
    .select('id, status')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return serverError(fetchError.message);
  if (!existing) return notFound('Supplier not found.');

  const { data, error } = await service
    .from('suppliers')
    .update({ status: 'INACTIVE' })
    .eq('id', id)
    .select('id, status')
    .single();

  if (error) return serverError(error.message);

  await recordAuditLog({
    action: 'SUPPLIER_DEACTIVATED',
    entityId: id,
    entityType: 'supplier',
    ipAddress: request.headers.get('x-forwarded-for'),
    newValues: { status: 'INACTIVE' },
    oldValues: { status: existing.status },
    organizationId: ctx.organizationId,
    userAgent: request.headers.get('user-agent'),
    userProfileId: ctx.userId,
  });

  return NextResponse.json(data);
}
