import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { resolveTransferWriteStatus } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.transfer.approve', 'inventory.write', 'stock_transfer.approve')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('stock_transfers')
    .select('id, status')
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Stock transfer not found.');
  if (!['PENDING_APPROVAL', 'DRAFT'].includes(String(data.status ?? '').toUpperCase())) {
    return badRequest('Only submitted transfers can be approved.');
  }

  const { data: updated, error: updateError } = await service
    .from('stock_transfers')
    .update({ status: resolveTransferWriteStatus('APPROVED'), approved_by: ctx.userId })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return serverError(updateError.message);
  return NextResponse.json(updated);
}
