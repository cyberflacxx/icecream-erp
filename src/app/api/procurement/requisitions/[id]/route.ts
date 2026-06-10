import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  let body: {
    department?: string;
    neededByDate?: string | null;
    remarks?: string | null;
    items?: Array<{
      itemId: string;
      unitOfMeasureId: string;
      quantityRequested: number;
      estimatedUnitCost?: number | null;
      remarks?: string | null;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  try {
    // Fetch existing requisition
    const { data: existing, error: fetchErr } = await service
      .from('purchase_requisitions')
      .select('id, status')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Purchase requisition not found.');
    if ((existing as Record<string, unknown>).status !== 'draft') {
      return badRequest('Only draft requisitions can be edited.');
    }

    // Validate items if provided
    if (body.items?.length) {
      const itemIds = [...new Set(body.items.map((i) => i.itemId))];
      const unitIds = [...new Set(body.items.map((i) => i.unitOfMeasureId))];

      const [itemsCheck, unitsCheck] = await Promise.all([
        service
          .from('items')
          .select('id')
          .is('deleted_at', null)
          .eq('organization_id', ctx.organizationId)
          .in('id', itemIds),
        service
          .from('units_of_measure')
          .select('id')
          .eq('organization_id', ctx.organizationId)
          .in('id', unitIds),
      ]);

      if (
        (itemsCheck.data?.length ?? 0) !== itemIds.length ||
        (unitsCheck.data?.length ?? 0) !== unitIds.length
      ) {
        return badRequest('One or more requisition items are invalid.');
      }
    }

    // Update header fields
    const updatePayload: Record<string, unknown> = {};
    if (body.department !== undefined) updatePayload.department = body.department;
    if (body.neededByDate !== undefined) updatePayload.needed_by_date = body.neededByDate;
    if (body.remarks !== undefined) updatePayload.remarks = body.remarks;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateErr } = await service
        .from('purchase_requisitions')
        .update(updatePayload)
        .eq('id', id);
      if (updateErr) return serverError(updateErr.message);
    }

    // Replace items if provided
    if (body.items) {
      await service.from('purchase_requisition_items').delete().eq('requisition_id', id);

      const { error: itemsErr } = await service.from('purchase_requisition_items').insert(
        body.items.map((item) => ({
          requisition_id: id,
          item_id: item.itemId,
          unit_of_measure_id: item.unitOfMeasureId,
          quantity_requested: item.quantityRequested,
          quantity_approved: null,
          estimated_unit_cost: item.estimatedUnitCost ?? null,
          remarks: item.remarks ?? null,
        })),
      );
      if (itemsErr) return serverError(itemsErr.message);
    }

    const { data: full } = await service
      .from('purchase_requisitions')
      .select('*, purchase_requisition_items(*)')
      .eq('id', id)
      .single();

    return NextResponse.json(full);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
