import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  notFound,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.view', 'procurement.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  const { data, error } = await service
    .from('goods_received_notes')
    .select(
      `id, grn_number, received_date, status, quality_status, warehouse_id, purchase_order_id, notes, quality_notes,
       purchase_orders(id, po_number, suppliers(id, name)),
       goods_received_note_items(id, item_id, po_item_id, quantity_expected, quantity_received, quantity_rejected, unit_cost, batch_number, expiry_date, quality_notes)`,
    )
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Goods received note not found.');

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.edit', 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const body = (await request.json().catch(() => ({}))) as {
    notes?: string | null;
    qualityNotes?: string | null;
    receivedDate?: string | null;
  };

  const { data: existing, error: existingError } = await service
    .from('goods_received_notes')
    .select('id, status')
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .maybeSingle();

  if (existingError) return serverError(existingError.message);
  if (!existing) return notFound('Goods received note not found.');
  if (String(existing.status ?? '').toUpperCase() !== 'DRAFT') {
    return badRequest('Only draft GRNs can be edited.');
  }

  const updates: Record<string, unknown> = {};
  if (body.notes !== undefined) updates.notes = body.notes ?? null;
  if (body.qualityNotes !== undefined) updates.quality_notes = body.qualityNotes ?? null;
  if (body.receivedDate !== undefined) updates.received_date = body.receivedDate ?? null;

  const { data, error } = await service
    .from('goods_received_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
