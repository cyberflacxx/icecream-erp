import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { normalizeTransferStatus } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.transfer.cancel', 'inventory.write', 'stock_transfer.approve')) return forbidden();

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
  if (normalizeTransferStatus(String(data.status ?? '')) === 'COMPLETED') {
    return badRequest('Completed transfers cannot be cancelled.');
  }

  const { data: updated, error: updateError } = await service
    .from('stock_transfers')
    .update({ status: 'CANCELLED' })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return serverError(updateError.message);
  return NextResponse.json(updated);
}
