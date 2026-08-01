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
import { fetchGoodsReceivedNoteDetail, isGrnStockPostingError } from '@/lib/procurement-goods-received';
import { loadInventoryReversalSnapshots } from '@/lib/inventory-reversal-server';
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
  try {
    const data = await fetchGoodsReceivedNoteDetail(service, {
      grnId: id,
      organizationId: ctx.organizationId,
    });
    const reversalSnapshot = (await loadInventoryReversalSnapshots(service, 'goods_received_note', [id])).get(id)?.[0] ?? null;
    const reversal = reversalSnapshot
      ? {
          approvedBy: reversalSnapshot.approvedBy,
          approvedByName: reversalSnapshot.approvedByName,
          id: reversalSnapshot.id,
          originalJournalId: reversalSnapshot.originalJournalId,
          originalMovementIds: reversalSnapshot.originalMovementIds,
          postedAt: reversalSnapshot.postedAt,
          postedBy: reversalSnapshot.postedBy,
          postedByName: reversalSnapshot.postedByName,
          reason: reversalSnapshot.reason,
          requestedBy: reversalSnapshot.requestedBy,
          requestedByName: reversalSnapshot.requestedByName,
          reversalJournalId: reversalSnapshot.reversalJournalId,
          reversalJournalNumber: reversalSnapshot.reversalJournalNumber,
          reversalMovementIds: reversalSnapshot.movementIds,
          reversalNumber: reversalSnapshot.reversalNumber,
          reversalReference: reversalSnapshot.reversalReference,
          status: reversalSnapshot.status,
        }
      : null;

    return NextResponse.json({
      success: true,
      data,
      reversal,
      ...data,
    });
  } catch (error) {
    if (isGrnStockPostingError(error) && error.message === 'Goods received note not found.') {
      return notFound('Goods received note not found.');
    }

    return serverError(error instanceof Error ? error.message : 'Failed to load goods received note.');
  }
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
