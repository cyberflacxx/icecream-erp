import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

const STATUSES_WITH_RESERVATION = ['MATERIALS_RESERVED', 'IN_PROGRESS', 'WIP', 'QUALITY_CHECK'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const body = await request.json() as { reason?: string };

    const { data: batch, error } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .select(`
        id, batch_number, status, warehouse_id,
        warehouses(branch_id),
        production_batch_materials(id, item_id, quantity_required, quantity_issued)
      `)
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error || !batch) return notFound('Production batch not found');

    if (ctx.isBranchScoped && ctx.branchId) {
      const warehouse = batch.warehouses as { branch_id: string };
      if (warehouse?.branch_id !== ctx.branchId) return forbidden();
    }

    if (batch.status === 'COMPLETED') {
      return badRequest('Cannot cancel a completed batch');
    }
    if (batch.status === 'CANCELLED') {
      return badRequest('Batch is already cancelled');
    }

    // Release reserved stock if applicable
    if (STATUSES_WITH_RESERVATION.includes(batch.status)) {
      const materials = batch.production_batch_materials as Array<{
        id: string; item_id: string; quantity_required: number; quantity_issued: number;
      }>;
      for (const material of materials) {
        const toRelease = Math.max(0, Number(material.quantity_required) - Number(material.quantity_issued));
        if (toRelease <= 0) continue;

        const { data: balance } = await service
          .schema('icecream_erp')
          .from('stock_balances')
          .select('id, quantity_reserved, quantity_available')
          .eq('item_id', material.item_id)
          .eq('warehouse_id', batch.warehouse_id)
          .maybeSingle();

        if (!balance) continue;

        const releaseAmount = Math.min(toRelease, Number(balance.quantity_reserved));
        await service.schema('icecream_erp').from('stock_balances').update({
          quantity_reserved: Number(balance.quantity_reserved) - releaseAmount,
          quantity_available: Number(balance.quantity_available) + releaseAmount,
          last_updated: new Date().toISOString(),
        }).eq('id', balance.id);
      }
    }

    const { data: updated, error: updateError } = await service
      .schema('icecream_erp')
      .from('production_batches')
      .update({
        status: 'CANCELLED',
        end_time: new Date().toISOString(),
        closed_by: ctx.userId,
        wastage_reason: body.reason ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await service.schema('icecream_erp').from('audit_logs').insert({
      action: 'PRODUCTION_BATCH_CANCELLED',
      entity_id: id,
      entity_type: 'production_batch',
      new_values: { reason: body.reason ?? null, status: 'CANCELLED' },
      user_profile_id: ctx.userId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return serverError(message);
  }
}
