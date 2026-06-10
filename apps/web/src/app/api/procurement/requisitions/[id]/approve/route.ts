import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.approve')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  let remarks: string | null = null;
  try {
    const body = await request.json();
    remarks = body.remarks ?? null;
  } catch {
    // remarks is optional
  }

  try {
    const { data: existing, error: fetchErr } = await service
      .from('purchase_requisitions')
      .select('id, status, remarks')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Purchase requisition not found.');

    const req = existing as Record<string, unknown>;
    if (req.status !== 'submitted') {
      return badRequest('Only submitted requisitions can be approved.');
    }

    // Auto-approve quantities: set quantity_approved = quantity_requested where null
    const { data: items } = await service
      .from('purchase_requisition_items')
      .select('id, quantity_requested, quantity_approved')
      .eq('requisition_id', id);

    for (const item of items ?? []) {
      const i = item as Record<string, unknown>;
      if (i.quantity_approved === null || i.quantity_approved === undefined) {
        await service
          .from('purchase_requisition_items')
          .update({ quantity_approved: i.quantity_requested })
          .eq('id', i.id);
      }
    }

    const { data: updated, error: updateErr } = await service
      .from('purchase_requisitions')
      .update({
        status: 'level1_approved',
        approval_status: 'level1_approved',
        approved_by: ctx.userId,
        approved_at: new Date().toISOString(),
        remarks: remarks ?? (req.remarks as string | null),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return serverError(updateErr.message);

    return NextResponse.json(updated);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
