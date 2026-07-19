import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { normalizeRequisitionItemId, normalizeRequisitionUnitOfMeasureId } from '@/lib/procurement-requisitions';
import { isMissingColumnError } from '@/lib/postgrest-compat';
import { createServiceRoleClient } from '@/lib/supabase/server';

const LEGACY_REQUISITION_ITEM_COLUMNS = ['pr_id', 'quantity', 'estimated_cost', 'notes'] as const;
const REQUISITION_SELECT_BASE =
  'id, requisition_number, department, request_date, needed_by_date, status, approval_status, requested_by, approver_user_id, approved_by, approved_at, rejected_by, rejected_at, remarks';
const REQUISITION_SELECT_WITH_APPROVER_DETAILS = `${REQUISITION_SELECT_BASE}, approver_name, approver_email, approval_notes`;
const APPROVED_REQUISITION_STATUSES = ['approved', 'level1_approved', 'submitted', 'pending_approval'] as const;

function stripMissingLegacyRequisitionItemColumn<T extends Record<string, unknown>>(payload: T, error: unknown) {
  const column = LEGACY_REQUISITION_ITEM_COLUMNS.find((entry) =>
    isMissingColumnError(error, 'purchase_requisition_items', entry),
  );
  if (!column) return null;

  const nextPayload = { ...payload };
  delete nextPayload[column];
  return nextPayload;
}

function sanitizeStatusFilter(value: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

function applyApprovedRequisitionFilter<T extends { or: (filters: string) => T }>(query: T) {
  return query.or(
    `status.in.(${APPROVED_REQUISITION_STATUSES.join(',')}),approval_status.in.(${APPROVED_REQUISITION_STATUSES.join(',')})`,
  );
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
  const status = searchParams.get('status');
  const picker = searchParams.get('picker') === 'true';
  const forPurchaseOrder = searchParams.get('forPurchaseOrder') === 'true';
  const department = searchParams.get('department');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const select = picker ? REQUISITION_SELECT_WITH_APPROVER_DETAILS : REQUISITION_SELECT_BASE;
    let query = service
      .from('purchase_requisitions')
      .select(select, picker ? undefined : { count: 'exact' })
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false });

    const normalizedStatus = sanitizeStatusFilter(status);
    if (forPurchaseOrder || normalizedStatus === 'approved') {
      query = applyApprovedRequisitionFilter(query);
    } else if (normalizedStatus) {
      query = query.or(`status.eq.${normalizedStatus},approval_status.eq.${normalizedStatus}`);
    }
    if (department) query = query.eq('department', department);
    if (startDate) query = query.gte('request_date', startDate);
    if (endDate) query = query.lte('request_date', endDate);

    const from = (page - 1) * pageSize;
    const { data, count, error } = picker
      ? await query.limit(pageSize)
      : await query.range(from, from + pageSize - 1);

    if (
      error &&
      picker &&
      ['approver_name', 'approver_email', 'approval_notes'].some((column) =>
        isMissingColumnError(error, 'purchase_requisitions', column),
      )
    ) {
      const fallbackQuery = service
        .from('purchase_requisitions')
        .select(REQUISITION_SELECT_BASE)
        .is('deleted_at', null)
        .eq('organization_id', ctx.organizationId)
        .order('created_at', { ascending: false });

      const fallbackApplied =
        forPurchaseOrder || normalizedStatus === 'approved'
          ? applyApprovedRequisitionFilter(fallbackQuery)
          : normalizedStatus
            ? fallbackQuery.or(`status.eq.${normalizedStatus},approval_status.eq.${normalizedStatus}`)
            : fallbackQuery;

      if (department) fallbackApplied.eq('department', department);
      if (startDate) fallbackApplied.gte('request_date', startDate);
      if (endDate) fallbackApplied.lte('request_date', endDate);

      const fallbackResult = picker
        ? await fallbackApplied.limit(pageSize)
        : await fallbackApplied.range(from, from + pageSize - 1);
      if (fallbackResult.error) return serverError(fallbackResult.error.message);

      const rows = fallbackResult.data ?? [];
      const userIds = [
        ...new Set(
          rows
            .flatMap((row) => [row.requested_by, row.approver_user_id, row.approved_by, row.rejected_by])
            .map((value) => String(value ?? ''))
            .filter(Boolean),
        ),
      ];
      const usersResult = userIds.length
        ? await service.from('users').select('id, full_name').in('id', userIds)
        : { data: [], error: null };
      const usersById = new Map(
        (usersResult.error ? [] : usersResult.data ?? []).map((row) => [String(row.id), String(row.full_name ?? 'Unknown')]),
      );
      const mapped = rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        requisition_number: r.requisition_number,
        requisitionNumber: r.requisition_number,
        department: r.department,
        created_at: r.request_date,
        createdAt: r.request_date,
        requestDate: r.request_date,
        neededByDate: r.needed_by_date,
        status: r.approval_status ?? r.status,
        approvalStatus: r.approval_status ?? r.status,
        requested_by: r.requested_by ? String(r.requested_by) : null,
        requestedBy: usersById.get(String(r.requested_by ?? '')) ?? 'Unknown',
        requestedById: r.requested_by ? String(r.requested_by) : null,
        approverName: usersById.get(String(r.approver_user_id ?? '')) ?? null,
        approverEmail: null,
        approverUserId: r.approver_user_id ? String(r.approver_user_id) : null,
        approvalNotes: null,
        approvedBy: usersById.get(String(r.approved_by ?? '')) ?? null,
        approvedAt: r.approved_at ? String(r.approved_at) : null,
        rejectedBy: usersById.get(String(r.rejected_by ?? '')) ?? null,
        rejectedAt: r.rejected_at ? String(r.rejected_at) : null,
        remarks: r.remarks ? String(r.remarks) : null,
        label: `${String(r.requisition_number ?? 'Requisition')} - ${usersById.get(String(r.requested_by ?? '')) ?? 'Unknown'} - ${String(r.approval_status ?? r.status ?? 'draft').replace(/_/g, ' ')}`,
      }));

      if (picker) {
        return NextResponse.json({ success: true, data: mapped });
      }

      return NextResponse.json({
        data: mapped,
        pagination: { page, pageSize, total: fallbackResult.count ?? 0 },
      });
    }

    if (error) return serverError(error.message);

    const userIds = [
      ...new Set(
        (data ?? [])
          .flatMap((row) => [row.requested_by, row.approver_user_id, row.approved_by, row.rejected_by])
          .map((value) => String(value ?? ''))
          .filter(Boolean),
      ),
    ];
    const usersResult = userIds.length
      ? await service.from('users').select('id, full_name').in('id', userIds)
      : { data: [], error: null };
    const usersById = new Map(
      (usersResult.error ? [] : usersResult.data ?? []).map((row) => [String(row.id), String(row.full_name ?? 'Unknown')]),
    );

    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      requisition_number: r.requisition_number,
      requisitionNumber: r.requisition_number,
      department: r.department,
      created_at: r.request_date,
      createdAt: r.request_date,
      requestDate: r.request_date,
      neededByDate: r.needed_by_date,
      status: r.approval_status ?? r.status,
      approvalStatus: r.approval_status ?? r.status,
      requested_by: r.requested_by ? String(r.requested_by) : null,
      requestedBy: usersById.get(String(r.requested_by ?? '')) ?? 'Unknown',
      requestedById: r.requested_by ? String(r.requested_by) : null,
      approverName: usersById.get(String(r.approver_user_id ?? '')) ?? (r.approver_name ? String(r.approver_name) : null),
      approverEmail: r.approver_email ? String(r.approver_email) : null,
      approverUserId: r.approver_user_id ? String(r.approver_user_id) : null,
      approvalNotes: r.approval_notes ? String(r.approval_notes) : null,
      approvedBy: usersById.get(String(r.approved_by ?? '')) ?? null,
      approvedAt: r.approved_at ? String(r.approved_at) : null,
      rejectedBy: usersById.get(String(r.rejected_by ?? '')) ?? null,
      rejectedAt: r.rejected_at ? String(r.rejected_at) : null,
      remarks: r.remarks ? String(r.remarks) : null,
      label: `${String(r.requisition_number ?? 'Requisition')} - ${usersById.get(String(r.requested_by ?? '')) ?? 'Unknown'} - ${String(r.approval_status ?? r.status ?? 'draft').replace(/_/g, ' ')}`,
    }));

    if (picker) {
      return NextResponse.json({ success: true, data: mapped });
    }

    return NextResponse.json({
      data: mapped,
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const service = createServiceRoleClient();

  let body: {
    department: string;
    neededByDate?: string | null;
    remarks?: string | null;
    approverName?: string | null;
    approverEmail?: string | null;
    approverUserId?: string | null;
    approvalNotes?: string | null;
    items: Array<{
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

  if (!body.department || !body.items?.length) {
    return badRequest('department and items are required');
  }

  try {
    const normalizedItems = body.items.map((item) => ({
      ...item,
      itemId: normalizeRequisitionItemId(item),
      unitOfMeasureId: normalizeRequisitionUnitOfMeasureId(item),
    }));

    if (normalizedItems.some((item) => !item.itemId)) {
      return badRequest('Selected item is no longer available. Please refresh and try again.');
    }
    if (normalizedItems.some((item) => !item.unitOfMeasureId)) {
      return badRequest('Selected unit of measurement is no longer available. Please refresh and try again.');
    }

    // Validate items exist
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

    // Generate requisition number
    const { count: reqCount } = await service
      .from('purchase_requisitions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId);

    const requisitionNumber = `REQ-${String((reqCount ?? 0) + 1).padStart(5, '0')}`;

    const { data: requisition, error: reqErr } = await service
      .from('purchase_requisitions')
      .insert({
        pr_number: requisitionNumber,
        requisition_number: requisitionNumber,
        department: body.department,
        needed_by_date: body.neededByDate ?? null,
        remarks: body.remarks ?? null,
        approver_name: body.approverName?.trim() || null,
        approver_email: body.approverEmail?.trim() || null,
        approver_user_id: body.approverUserId ?? null,
        approval_notes: body.approvalNotes?.trim() || null,
        request_date: new Date().toISOString(),
        requested_by: ctx.userId,
        organization_id: ctx.organizationId,
        status: 'draft',
        approval_status: 'draft',
      })
      .select()
      .single();

    if (reqErr) return serverError(reqErr.message);

    let itemPayload = normalizedItems.map((item) => ({
      pr_id: (requisition as Record<string, unknown>).id,
      requisition_id: (requisition as Record<string, unknown>).id,
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

    const { data: full } = await service
      .from('purchase_requisitions')
      .select('*, purchase_requisition_items(*)')
      .eq('id', (requisition as Record<string, unknown>).id)
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
    }, { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
