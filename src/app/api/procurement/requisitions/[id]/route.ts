import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { deriveRequisitionWorkflowStatus } from '@/lib/procurement-workflow';
import {
  buildRequisitionDetailItem,
  buildRequisitionDetailLookupCandidates,
  isUuidLikeRequisitionIdentifier,
  normalizeRequisitionItemId,
  normalizeRequisitionUnitOfMeasureId,
} from '@/lib/procurement-requisitions';
import { getErrorMessage, isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

const LEGACY_REQUISITION_ITEM_COLUMNS = ['pr_id', 'quantity', 'estimated_cost', 'notes'] as const;
const REQUISITION_HEADER_SELECT_BASE =
  'id, requisition_number, department, needed_by_date, remarks, status, approval_status, approver_user_id, requested_by, approved_by, approved_at, rejected_by, rejected_at';
const REQUISITION_HEADER_SELECT_WITH_APPROVER_DETAILS =
  `${REQUISITION_HEADER_SELECT_BASE}, approver_name, approver_email, approval_notes`;
const REQUISITION_ITEM_SELECT_COLUMNS = [
  'id',
  'requisition_id',
  'pr_id',
  'item_id',
  'unit_of_measure_id',
  'quantity_requested',
  'quantity_approved',
  'quantity',
  'estimated_unit_cost',
  'estimated_cost',
  'remarks',
  'notes',
  'description',
  'specification',
  'unit_price',
  'tax_rate',
] as const;
const REQUISITION_ITEM_SELECT = REQUISITION_ITEM_SELECT_COLUMNS.join(', ');

function stripMissingLegacyRequisitionItemColumn<T extends Record<string, unknown>>(payload: T, error: unknown) {
  const column = LEGACY_REQUISITION_ITEM_COLUMNS.find((entry) =>
    isMissingColumnError(error, 'purchase_requisition_items', entry),
  );
  if (!column) return null;

  const nextPayload = { ...payload };
  delete nextPayload[column];
  return nextPayload;
}

function stripMissingRequisitionItemSelectColumn(select: string, error: unknown) {
  const column = REQUISITION_ITEM_SELECT_COLUMNS.find((entry) =>
    isMissingColumnError(error, 'purchase_requisition_items', entry),
  );
  if (!column) return null;

  return select
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== column)
    .join(', ');
}

function requisitionNotFoundResponse() {
  return NextResponse.json(
    {
      success: false,
      message: 'Purchase requisition not found.',
      code: 'REQUISITION_NOT_FOUND',
    },
    { status: 404 },
  );
}

async function fetchRequisitionHeader(
  service: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
  requestedId: string,
) {
  const candidates = buildRequisitionDetailLookupCandidates(requestedId);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    for (const includeApproverDetails of [true, false]) {
      for (const includeDeletedFilter of [true, false]) {
        const select = includeApproverDetails
          ? REQUISITION_HEADER_SELECT_WITH_APPROVER_DETAILS
          : REQUISITION_HEADER_SELECT_BASE;
        let query = service
          .from('purchase_requisitions')
          .select(select)
          .eq('organization_id', organizationId)
          .eq(candidate.column, candidate.value);

        if (includeDeletedFilter) {
          query = query.is('deleted_at', null);
        }

        const response = await query.maybeSingle();
        if (response.data) {
          return {
            candidate,
            data: response.data as Record<string, unknown>,
            usedDeletedFilter: includeDeletedFilter,
          };
        }

        if (!response.error) {
          break;
        }

        if (
          includeApproverDetails &&
          ['approver_name', 'approver_email', 'approval_notes'].some((column) =>
            isMissingColumnError(response.error, 'purchase_requisitions', column),
          )
        ) {
          continue;
        }

        if (includeDeletedFilter && isMissingColumnError(response.error, 'purchase_requisitions', 'deleted_at')) {
          continue;
        }

        if (isMissingColumnError(response.error, 'purchase_requisitions', candidate.column)) {
          break;
        }

        if (
          candidate.column !== 'id' &&
          getErrorMessage(response.error).toLowerCase().includes('invalid input syntax for type uuid')
        ) {
          break;
        }

        lastError = response.error;
        break;
      }
    }
  }

  return {
    candidate: null,
    data: null,
    error: lastError,
    usedDeletedFilter: true,
  };
}

async function fetchRequisitionItems(
  service: ReturnType<typeof createServiceRoleClient>,
  requisitionId: string,
) {
  let lastError: unknown = null;

  for (const filterColumn of ['requisition_id', 'pr_id'] as const) {
    let select = REQUISITION_ITEM_SELECT;

    for (;;) {
      const response = await service
        .from('purchase_requisition_items')
        .select(select)
        .eq(filterColumn, requisitionId);

      if (!response.error) {
        return {
          data: (response.data ?? []) as Record<string, unknown>[],
          filterColumn,
        };
      }

      if (isMissingColumnError(response.error, 'purchase_requisition_items', filterColumn)) {
        break;
      }

      const nextSelect = stripMissingRequisitionItemSelectColumn(select, response.error);
      if (!nextSelect || nextSelect === select) {
        lastError = response.error;
        break;
      }

      select = nextSelect;
    }
  }

  return {
    data: [] as Record<string, unknown>[],
    error: lastError,
    filterColumn: null,
  };
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
    const headerResult = await fetchRequisitionHeader(service, ctx.organizationId, id);
    if (headerResult.error) {
      return serverError(getErrorMessage(headerResult.error) || 'Failed to load purchase requisition.');
    }

    const requisition = headerResult.data;
    if (!requisition) {
      console.warn('Purchase requisition detail not found.', {
        requestedId: id,
        isUuid: isUuidLikeRequisitionIdentifier(id),
        tableQueried: 'purchase_requisitions',
        headerFound: false,
        itemCount: 0,
        client: 'service_role',
      });
      return requisitionNotFoundResponse();
    }

    const itemsResult = await fetchRequisitionItems(service, String(requisition.id ?? ''));
    if (itemsResult.error) {
      return serverError(getErrorMessage(itemsResult.error) || 'Failed to load purchase requisition items.');
    }

    const itemIds = [...new Set(itemsResult.data.map((item) => String(item.item_id ?? '')).filter(Boolean))];
    const unitIds = [
      ...new Set(itemsResult.data.map((item) => String(item.unit_of_measure_id ?? '')).filter(Boolean)),
    ];

    const [itemLookupPrimary, unitLookup] = await Promise.all([
      itemIds.length
        ? service
            .from('items')
            .select('id, code, name, description, purchase_price, cost_price, unit_cost, standard_cost, default_purchase_price, price, selling_price')
            .is('deleted_at', null)
            .eq('organization_id', ctx.organizationId)
            .in('id', itemIds)
        : Promise.resolve({ data: [], error: null }),
      unitIds.length
        ? service
            .from('units_of_measure')
            .select('id, name, abbreviation')
            .eq('organization_id', ctx.organizationId)
            .in('id', unitIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const itemLookup =
      itemLookupPrimary.error && isMissingColumnError(itemLookupPrimary.error, 'items', 'deleted_at')
        ? await service
            .from('items')
            .select('id, code, name, description, purchase_price, cost_price, unit_cost, standard_cost, default_purchase_price, price, selling_price')
            .eq('organization_id', ctx.organizationId)
            .in('id', itemIds)
        : itemLookupPrimary;

    if (itemLookup.error) {
      return serverError(itemLookup.error.message);
    }
    if (unitLookup.error) {
      return serverError(unitLookup.error.message);
    }

    const itemsById = new Map(
      (itemLookup.data ?? []).map((row) => [String(row.id), row as Record<string, unknown>]),
    );
    const unitsById = new Map(
      (unitLookup.data ?? []).map((row) => [String(row.id), row as Record<string, unknown>]),
    );

    const items = itemsResult.data.map((item) =>
      buildRequisitionDetailItem(item, {
        item: itemsById.get(String(item.item_id ?? '')) ?? null,
        unit: unitsById.get(String(item.unit_of_measure_id ?? '')) ?? null,
      }),
    );

    const normalizedStatus = deriveRequisitionWorkflowStatus({
      approvalStatus: requisition.approval_status,
      approvedAt: requisition.approved_at,
      approvedBy: requisition.approved_by,
      rejectedAt: requisition.rejected_at,
      status: requisition.status,
    });

    const detail = {
      ...requisition,
      id: requisition.id ? String(requisition.id) : null,
      requisition_id: requisition.id ? String(requisition.id) : null,
      requisitionId: requisition.id ? String(requisition.id) : null,
      requisition_number: requisition.requisition_number ? String(requisition.requisition_number) : null,
      requisitionNumber: requisition.requisition_number ? String(requisition.requisition_number) : null,
      status: normalizedStatus,
      approval_status: normalizedStatus,
      approvalStatus: normalizedStatus,
      normalizedStatus,
      approverName: requisition.approver_name ? String(requisition.approver_name) : null,
      approverEmail: requisition.approver_email ? String(requisition.approver_email) : null,
      approvalNotes: requisition.approval_notes ? String(requisition.approval_notes) : null,
      items,
      line_items: items,
      lineItems: items,
      requisition_items: items,
      requisitionItems: items,
      purchase_requisition_items: items,
    };

    return NextResponse.json({
      success: true,
      data: detail,
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
