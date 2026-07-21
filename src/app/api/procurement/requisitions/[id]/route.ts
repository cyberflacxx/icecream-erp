import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { normalizeRequisitionItemId, normalizeRequisitionUnitOfMeasureId } from '@/lib/procurement-requisitions';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

const LEGACY_REQUISITION_ITEM_COLUMNS = ['pr_id', 'quantity', 'estimated_cost', 'notes'] as const;
const REQUISITION_DETAIL_SELECT_BASE =
  'id, requisition_number, department, needed_by_date, remarks, status, approval_status, approver_user_id, requested_by, approved_by, approved_at, rejected_by, rejected_at, purchase_requisition_items(id, item_id, unit_of_measure_id, quantity_requested, quantity_approved, estimated_unit_cost, remarks, items(id, code, name, description, purchase_price, cost_price, unit_cost, standard_cost, default_purchase_price, price, selling_price), units_of_measure(id, name, abbreviation))';
const REQUISITION_DETAIL_SELECT_WITH_APPROVER_DETAILS =
  'id, requisition_number, department, needed_by_date, remarks, status, approval_status, approver_user_id, approver_name, approver_email, approval_notes, requested_by, approved_by, approved_at, rejected_by, rejected_at, purchase_requisition_items(id, item_id, unit_of_measure_id, quantity_requested, quantity_approved, estimated_unit_cost, remarks, items(id, code, name, description, purchase_price, cost_price, unit_cost, standard_cost, default_purchase_price, price, selling_price), units_of_measure(id, name, abbreviation))';

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
    let response = await service
      .from('purchase_requisitions')
      .select(REQUISITION_DETAIL_SELECT_WITH_APPROVER_DETAILS)
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (
      response.error &&
      ['approver_name', 'approver_email', 'approval_notes'].some((column) =>
        isMissingColumnError(response.error, 'purchase_requisitions', column),
      )
    ) {
      response = await service
        .from('purchase_requisitions')
        .select(REQUISITION_DETAIL_SELECT_BASE)
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .eq('id', id)
        .single();
    }

    const { data: requisition, error } = response;

    if (error || !requisition) return notFound('Purchase requisition not found.');

    const items = (requisition.purchase_requisition_items ?? []).map((item) => ({
      id: item.id,
      requisition_item_id: item.id ? String(item.id) : null,
      requisitionItemId: item.id ? String(item.id) : null,
      item_id: item.item_id ? String(item.item_id) : null,
      itemId: item.item_id ? String(item.item_id) : null,
      item_code: item.items?.code ? String(item.items.code) : null,
      itemCode: item.items?.code ? String(item.items.code) : null,
      item_name: item.items?.name ? String(item.items.name) : null,
      itemName: item.items?.name ? String(item.items.name) : null,
      description: item.items?.description ? String(item.items.description) : item.items?.name ? String(item.items.name) : '',
      quantity: Number(item.quantity_requested ?? 0),
      unit_of_measure_id: item.unit_of_measure_id ? String(item.unit_of_measure_id) : null,
      unitOfMeasureId: item.unit_of_measure_id ? String(item.unit_of_measure_id) : null,
      unit_of_measure_name: item.units_of_measure?.name ? String(item.units_of_measure.name) : null,
      uomName:
        item.units_of_measure?.abbreviation
          ? String(item.units_of_measure.abbreviation)
          : item.units_of_measure?.name
            ? String(item.units_of_measure.name)
            : null,
      unit_price:
        item.items?.purchase_price ??
        item.items?.cost_price ??
        item.items?.unit_cost ??
        item.items?.standard_cost ??
        item.items?.default_purchase_price ??
        item.items?.price ??
        item.items?.selling_price ??
        item.estimated_unit_cost ??
        0,
      unitPrice:
        item.items?.purchase_price ??
        item.items?.cost_price ??
        item.items?.unit_cost ??
        item.items?.standard_cost ??
        item.items?.default_purchase_price ??
        item.items?.price ??
        item.items?.selling_price ??
        item.estimated_unit_cost ??
        0,
    }));

    return NextResponse.json({
      ...requisition,
      requisition_id: requisition.id ? String(requisition.id) : null,
      requisitionId: requisition.id ? String(requisition.id) : null,
      approverName: requisition.approver_name ? String(requisition.approver_name) : null,
      approverEmail: requisition.approver_email ? String(requisition.approver_email) : null,
      approvalNotes: requisition.approval_notes ? String(requisition.approval_notes) : null,
      items,
      purchase_requisition_items: (requisition.purchase_requisition_items ?? []).map((item) => ({
        ...item,
        itemId: item.item_id ? String(item.item_id) : null,
        itemCode: item.items?.code ? String(item.items.code) : null,
        itemName: item.items?.name ? String(item.items.name) : null,
        description: item.items?.description ? String(item.items.description) : item.items?.name ? String(item.items.name) : '',
        purchasePrice:
          item.items?.purchase_price ??
          item.items?.cost_price ??
          item.items?.unit_cost ??
          item.items?.standard_cost ??
          item.items?.default_purchase_price ??
          item.items?.price ??
          item.items?.selling_price ??
          item.estimated_unit_cost ??
          0,
        unitOfMeasureId: item.unit_of_measure_id ? String(item.unit_of_measure_id) : null,
        unitOfMeasureName: item.units_of_measure?.name ? String(item.units_of_measure.name) : null,
        uomName:
          item.units_of_measure?.abbreviation
            ? String(item.units_of_measure.abbreviation)
            : item.units_of_measure?.name
              ? String(item.units_of_measure.name)
              : null,
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
    approverName?: string | null;
    approverEmail?: string | null;
    approverUserId?: string | null;
    approvalNotes?: string | null;
    items?: Array<{
      itemId?: string;
      item_id?: string;
      unitOfMeasureId?: string;
      unit_of_measure_id?: string;
      uomId?: string;
      uom_id?: string;
      uom?: string;
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
      unitOfMeasureId: normalizeRequisitionUnitOfMeasureId(item),
    }));

    if (normalizedItems?.some((item) => !item.itemId)) {
      return badRequest('Selected item is no longer available. Please refresh and try again.');
    }
    if (normalizedItems?.some((item) => !item.unitOfMeasureId)) {
      return badRequest('Selected unit of measurement is no longer available. Please refresh and try again.');
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

      if ((itemsCheck.data?.length ?? 0) !== itemIds.length) {
        return badRequest('Selected item is no longer available. Please refresh and try again.');
      }
      if ((unitsCheck.data?.length ?? 0) !== unitIds.length) {
        return badRequest('Selected unit of measurement is no longer available. Please refresh and try again.');
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
    if (body.approverName !== undefined) updatePayload.approver_name = body.approverName?.trim() || null;
    if (body.approverEmail !== undefined) updatePayload.approver_email = body.approverEmail?.trim() || null;
    if (body.approverUserId !== undefined) updatePayload.approver_user_id = body.approverUserId;
    if (body.approvalNotes !== undefined) updatePayload.approval_notes = body.approvalNotes?.trim() || null;

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
          unitOfMeasureId: item.unit_of_measure_id ? String(item.unit_of_measure_id) : null,
        }),
      ),
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
