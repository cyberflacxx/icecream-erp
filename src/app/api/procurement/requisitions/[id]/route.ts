import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { normalizeRequisitionItemId } from '@/lib/procurement-requisitions';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

const LEGACY_REQUISITION_ITEM_COLUMNS = ['pr_id', 'quantity', 'estimated_cost', 'notes'] as const;

function stripMissingLegacyRequisitionItemColumn<T extends Record<string, unknown>>(payload: T, error: unknown) {
  const column = LEGACY_REQUISITION_ITEM_COLUMNS.find((entry) =>
    isMissingColumnError(error, 'purchase_requisition_items', entry),
  );
  if (!column) return null;

  const nextPayload = { ...payload };
  delete nextPayload[column];
  return nextPayload;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: requisition, error } = await service
      .from('purchase_requisitions')
      .select(
        'id, requisition_number, department, needed_by_date, remarks, status, approval_status, approver_user_id, requested_by, approved_by, approved_at, rejected_by, rejected_at, purchase_requisition_items(id, item_id, unit_of_measure_id, quantity_requested, quantity_approved, estimated_unit_cost, remarks)',
      )
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (error || !requisition) return notFound('Purchase requisition not found.');

    return NextResponse.json({
      ...requisition,
      purchase_requisition_items: (requisition.purchase_requisition_items ?? []).map((item) => ({
        ...item,
        itemId: item.item_id ? String(item.item_id) : null,
      })),
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

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
    approverUserId?: string | null;
    items?: Array<{
      itemId?: string;
      item_id?: string;
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

    const normalizedItems = body.items?.map((item) => ({
      ...item,
      itemId: normalizeRequisitionItemId(item),
    }));

    if (normalizedItems?.some((item) => !item.itemId)) {
      return badRequest('Selected item is no longer available. Please refresh and try again.');
    }

    // Validate items if provided
    if (normalizedItems?.length) {
      const itemIds = [...new Set(normalizedItems.map((i) => i.itemId))];
      const unitIds = [...new Set(normalizedItems.map((i) => i.unitOfMeasureId))];

      const [itemsPrimary, unitsCheck] = await Promise.all([
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

      const itemsCheck =
        itemsPrimary.error && isMissingColumnError(itemsPrimary.error, 'items', 'deleted_at')
          ? await service.from('items').select('id').eq('organization_id', ctx.organizationId).in('id', itemIds)
          : itemsPrimary;

      if (
        (itemsCheck.data?.length ?? 0) !== itemIds.length ||
        (unitsCheck.data?.length ?? 0) !== unitIds.length
      ) {
        return badRequest('Selected item is no longer available. Please refresh and try again.');
      }
    }

    if (body.approverUserId) {
      const { data: approver } = await service
        .from('users')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .eq('status', 'active')
        .eq('id', body.approverUserId)
        .single();

      if (!approver) {
        return badRequest('Selected approver is not available.');
      }
    }

    // Update header fields
    const updatePayload: Record<string, unknown> = {};
    if (body.department !== undefined) updatePayload.department = body.department;
    if (body.neededByDate !== undefined) updatePayload.needed_by_date = body.neededByDate;
    if (body.remarks !== undefined) updatePayload.remarks = body.remarks;
    if (body.approverUserId !== undefined) updatePayload.approver_user_id = body.approverUserId;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateErr } = await service
        .from('purchase_requisitions')
        .update(updatePayload)
        .eq('id', id);
      if (updateErr) return serverError(updateErr.message);
    }

    // Replace items if provided
    if (normalizedItems) {
      await service.from('purchase_requisition_items').delete().eq('requisition_id', id);

      let itemPayload = normalizedItems.map((item) => ({
        pr_id: id,
        requisition_id: id,
        item_id: item.itemId,
        unit_of_measure_id: item.unitOfMeasureId,
        quantity: item.quantityRequested,
        quantity_requested: item.quantityRequested,
        quantity_approved: null,
        estimated_cost: item.estimatedUnitCost ?? null,
        estimated_unit_cost: item.estimatedUnitCost ?? null,
        notes: item.remarks ?? null,
        remarks: item.remarks ?? null,
      }));
      let { error: itemsErr } = await service.from('purchase_requisition_items').insert(itemPayload);
      while (itemsErr) {
        const nextPayload = itemPayload
          .map((row) => stripMissingLegacyRequisitionItemColumn(row, itemsErr))
          .filter((row): row is Record<string, unknown> => Boolean(row));
        if (nextPayload.length !== itemPayload.length) break;
        if (JSON.stringify(nextPayload) === JSON.stringify(itemPayload)) break;
        itemPayload = nextPayload;
        const retry = await service.from('purchase_requisition_items').insert(itemPayload);
        itemsErr = retry.error;
      }
      if (itemsErr) return serverError(itemsErr.message);
    }

    const { data: full } = await service
      .from('purchase_requisitions')
      .select('*, purchase_requisition_items(*)')
      .eq('id', id)
      .single();

    return NextResponse.json({
      ...full,
      purchase_requisition_items: ((full?.purchase_requisition_items as Record<string, unknown>[] | undefined) ?? []).map(
        (item) => ({
          ...item,
          itemId: item.item_id ? String(item.item_id) : null,
        }),
      ),
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
