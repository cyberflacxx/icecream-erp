import { NextRequest, NextResponse } from 'next/server';

import { type AuthContext, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { isPendingInventoryApprovalStatus, normalizeInventoryApprovalStatus, toNumber } from '@/lib/inventory';
import { createServiceRoleClient } from '@/lib/supabase/server';

const EMPTY_SCOPE = ['00000000-0000-0000-0000-000000000000'];
const INVENTORY_DOCUMENT_TYPES = new Set([
  'stock_transfer',
  'stock_adjustment',
  'branch_transfer',
  'goods_return',
  'stock_take',
  'inventory_stock_take',
  'production_material_issue',
  'raw_material_request',
  'finished_goods_transfer',
  'inventory_write_off',
]);

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
type Row = Record<string, unknown>;
type SourceKind =
  | 'finished_goods_transfer'
  | 'goods_return'
  | 'production_material_request'
  | 'stock_adjustment'
  | 'stock_take'
  | 'stock_transfer';
type SourceContextStatus = 'mapped' | 'source_missing' | 'unsupported_source';
type DocumentDetail = {
  currentApprover: string | null;
  description: string;
  destinationWarehouseId: string | null;
  notes: string | null;
  quantity: number | null;
  referenceNumber: string;
  requestDate: string;
  sourceContextDiagnostic: string | null;
  sourceContextStatus: SourceContextStatus;
  sourceWarehouseId: string | null;
};
type SafeListResult = {
  diagnostic: string | null;
  rows: Row[];
};

function normalizeCode(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function hasGlobalInventoryScope(ctx: AuthContext) {
  return ctx.permissions.includes('view_all_branches') || ctx.permissions.includes('settings.manage');
}

function isInventoryApproval(row: Row) {
  const moduleName = normalizeCode(row.module_name);
  const documentType = normalizeCode(row.document_type);
  const entityType = normalizeCode(row.entity_type).replace(/^inventory\./, '');

  return moduleName === 'inventory' || INVENTORY_DOCUMENT_TYPES.has(documentType) || INVENTORY_DOCUMENT_TYPES.has(entityType);
}

async function resolveWarehouseScope(service: ServiceClient, ctx: AuthContext) {
  if (hasGlobalInventoryScope(ctx) && ctx.warehouseAssignments.length === 0) return null;

  const warehouseIds = new Set(ctx.warehouseAssignments);
  const branchIds = [...new Set([ctx.branchId, ...ctx.branchAssignments].filter(Boolean).map(String))];

  if (branchIds.length) {
    const { data, error } = await service
      .from('warehouses')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .in('branch_id', branchIds);
    if (error) throw error;
    for (const row of data ?? []) warehouseIds.add(String(row.id));
  }

  return warehouseIds.size ? [...warehouseIds] : EMPTY_SCOPE;
}

function sourceKindForApproval(row: Row): SourceKind | null {
  const documentType = normalizeCode(row.document_type || row.entity_type).replace(/^inventory\./, '');

  if (documentType.includes('stock_transfer') || documentType.includes('branch_transfer')) return 'stock_transfer';
  if (documentType.includes('stock_adjustment')) return 'stock_adjustment';
  if (documentType.includes('goods_return')) return 'goods_return';
  if (documentType.includes('finished_goods_transfer')) return 'finished_goods_transfer';
  if (
    documentType.includes('production_material_request') ||
    documentType.includes('production_material_issue') ||
    documentType.includes('raw_material_request')
  ) {
    return 'production_material_request';
  }
  if (documentType.includes('stock_take')) return 'stock_take';

  return null;
}

async function safeList(query: PromiseLike<{ data: unknown; error: { message: string } | null }>, label: string): Promise<SafeListResult> {
  const result = await query;
  if (result.error) {
    return { diagnostic: `${label}: ${result.error.message}`, rows: [] };
  }

  return {
    diagnostic: null,
    rows: Array.isArray(result.data)
      ? result.data.filter((row): row is Row => Boolean(row) && typeof row === 'object')
      : [],
  };
}

function sumRows(rows: Row[], key: string, candidates: string[]) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const id = String(row[key] ?? '');
    if (!id) continue;
    const quantity = candidates.reduce((value, candidate) => {
      return value || Math.abs(toNumber(row[candidate]));
    }, 0);
    totals.set(id, (totals.get(id) ?? 0) + quantity);
  }

  return totals;
}

async function loadInventoryDocumentDetails(service: ServiceClient, organizationId: string, approvals: Row[]) {
  const idsByKind = new Map<SourceKind, Set<string>>();
  for (const approval of approvals) {
    const kind = sourceKindForApproval(approval);
    const id = String(approval.entity_id ?? '');
    if (!kind || !id || kind === 'stock_take') continue;
    const ids = idsByKind.get(kind) ?? new Set<string>();
    ids.add(id);
    idsByKind.set(kind, ids);
  }

  const transferIds = [...(idsByKind.get('stock_transfer') ?? [])];
  const adjustmentIds = [...(idsByKind.get('stock_adjustment') ?? [])];
  const goodsReturnIds = [...(idsByKind.get('goods_return') ?? [])];
  const materialRequestIds = [...(idsByKind.get('production_material_request') ?? [])];
  const finishedGoodsTransferIds = [...(idsByKind.get('finished_goods_transfer') ?? [])];

  const [
    transfers,
    transferItems,
    adjustments,
    adjustmentItems,
    goodsReturns,
    goodsReturnItems,
    materialRequests,
    materialRequestItems,
    finishedGoodsTransfers,
  ] = await Promise.all([
    transferIds.length
      ? safeList(
          service
            .from('stock_transfers')
            .select('id, transfer_number, from_warehouse_id, to_warehouse_id, from_warehouse, to_warehouse, transfer_date, notes, requested_by, approved_by, status')
            .eq('organization_id', organizationId)
            .in('id', transferIds),
          'stock_transfers',
        )
      : Promise.resolve({ diagnostic: null, rows: [] }),
    transferIds.length
      ? safeList(
          service
            .from('stock_transfer_items')
            .select('transfer_id, quantity_requested, quantity_sent, quantity_received')
            .in('transfer_id', transferIds),
          'stock_transfer_items',
        )
      : Promise.resolve({ diagnostic: null, rows: [] }),
    adjustmentIds.length
      ? safeList(
          service
            .from('stock_adjustments')
            .select('id, adjustment_number, warehouse_id, adjustment_date, reason, notes, created_by, approved_by, status')
            .eq('organization_id', organizationId)
            .in('id', adjustmentIds),
          'stock_adjustments',
        )
      : Promise.resolve({ diagnostic: null, rows: [] }),
    adjustmentIds.length
      ? safeList(
          service
            .from('stock_adjustment_items')
            .select('adjustment_id, quantity_adjusted')
            .in('adjustment_id', adjustmentIds),
          'stock_adjustment_items',
        )
      : Promise.resolve({ diagnostic: null, rows: [] }),
    goodsReturnIds.length
      ? safeList(
          service
            .from('goods_return_vouchers')
            .select('id, return_number, return_warehouse_id, return_date, return_source, status, qc_status, approved_by')
            .eq('organization_id', organizationId)
            .in('id', goodsReturnIds),
          'goods_return_vouchers',
        )
      : Promise.resolve({ diagnostic: null, rows: [] }),
    goodsReturnIds.length
      ? safeList(
          service
            .from('goods_return_voucher_items')
            .select('voucher_id, quantity_returned, total_value, return_reason')
            .in('voucher_id', goodsReturnIds),
          'goods_return_voucher_items',
        )
      : Promise.resolve({ diagnostic: null, rows: [] }),
    materialRequestIds.length
      ? safeList(
          service
            .from('production_material_requests')
            .select('id, request_number, request_date, status, notes, requested_by, approved_by, production_batches(warehouse_id, batch_number)')
            .eq('organization_id', organizationId)
            .in('id', materialRequestIds),
          'production_material_requests',
        )
      : Promise.resolve({ diagnostic: null, rows: [] }),
    materialRequestIds.length
      ? safeList(
          service
            .from('production_material_request_items')
            .select('production_material_request_id, quantity_requested, quantity_approved, quantity_issued')
            .in('production_material_request_id', materialRequestIds),
          'production_material_request_items',
        )
      : Promise.resolve({ diagnostic: null, rows: [] }),
    finishedGoodsTransferIds.length
      ? safeList(
          service
            .from('finished_goods_transfers')
            .select('id, production_batch_id, source_warehouse_id, destination_warehouse_id, quantity_transferred, transfer_date, received_by')
            .in('id', finishedGoodsTransferIds),
          'finished_goods_transfers',
        )
      : Promise.resolve({ diagnostic: null, rows: [] }),
  ]);

  const diagnosticsByKind = new Map<SourceKind, string>();
  for (const [kind, result] of [
    ['stock_transfer', transfers],
    ['stock_transfer', transferItems],
    ['stock_adjustment', adjustments],
    ['stock_adjustment', adjustmentItems],
    ['goods_return', goodsReturns],
    ['goods_return', goodsReturnItems],
    ['production_material_request', materialRequests],
    ['production_material_request', materialRequestItems],
    ['finished_goods_transfer', finishedGoodsTransfers],
  ] as Array<[SourceKind, SafeListResult]>) {
    if (result.diagnostic) diagnosticsByKind.set(kind, result.diagnostic);
  }

  const transferQuantities = sumRows(transferItems.rows, 'transfer_id', ['quantity_requested', 'quantity_sent', 'quantity_received']);
  const adjustmentQuantities = sumRows(adjustmentItems.rows, 'adjustment_id', ['quantity_adjusted']);
  const goodsReturnQuantities = sumRows(goodsReturnItems.rows, 'voucher_id', ['quantity_returned']);
  const materialRequestQuantities = sumRows(materialRequestItems.rows, 'production_material_request_id', ['quantity_requested', 'quantity_approved', 'quantity_issued']);

  const detailsByKind = new Map<SourceKind, Map<string, DocumentDetail>>([
    ['stock_transfer', new Map()],
    ['stock_adjustment', new Map()],
    ['goods_return', new Map()],
    ['production_material_request', new Map()],
    ['finished_goods_transfer', new Map()],
  ]);

  for (const transfer of transfers.rows) {
    const id = String(transfer.id);
    detailsByKind.get('stock_transfer')?.set(id, {
      currentApprover: transfer.approved_by ? String(transfer.approved_by) : null,
      description: 'Warehouse stock transfer',
      destinationWarehouseId: transfer.to_warehouse_id || transfer.to_warehouse ? String(transfer.to_warehouse_id ?? transfer.to_warehouse) : null,
      notes: transfer.notes ? String(transfer.notes) : null,
      quantity: transferQuantities.get(id) ?? null,
      referenceNumber: String(transfer.transfer_number ?? id),
      requestDate: String(transfer.transfer_date ?? ''),
      sourceContextDiagnostic: null,
      sourceContextStatus: 'mapped',
      sourceWarehouseId: transfer.from_warehouse_id || transfer.from_warehouse ? String(transfer.from_warehouse_id ?? transfer.from_warehouse) : null,
    });
  }

  for (const adjustment of adjustments.rows) {
    const id = String(adjustment.id);
    detailsByKind.get('stock_adjustment')?.set(id, {
      currentApprover: adjustment.approved_by ? String(adjustment.approved_by) : null,
      description: String(adjustment.reason ?? 'Stock adjustment'),
      destinationWarehouseId: null,
      notes: adjustment.notes ?? adjustment.reason ? String(adjustment.notes ?? adjustment.reason) : null,
      quantity: adjustmentQuantities.get(id) ?? null,
      referenceNumber: String(adjustment.adjustment_number ?? id),
      requestDate: String(adjustment.adjustment_date ?? ''),
      sourceContextDiagnostic: null,
      sourceContextStatus: 'mapped',
      sourceWarehouseId: adjustment.warehouse_id ? String(adjustment.warehouse_id) : null,
    });
  }

  for (const goodsReturn of goodsReturns.rows) {
    const id = String(goodsReturn.id);
    detailsByKind.get('goods_return')?.set(id, {
      currentApprover: goodsReturn.approved_by ? String(goodsReturn.approved_by) : null,
      description: String(goodsReturn.return_source ?? 'Goods return voucher'),
      destinationWarehouseId: goodsReturn.return_warehouse_id ? String(goodsReturn.return_warehouse_id) : null,
      notes: null,
      quantity: goodsReturnQuantities.get(id) ?? null,
      referenceNumber: String(goodsReturn.return_number ?? id),
      requestDate: String(goodsReturn.return_date ?? ''),
      sourceContextDiagnostic: null,
      sourceContextStatus: 'mapped',
      sourceWarehouseId: null,
    });
  }

  for (const materialRequest of materialRequests.rows) {
    const id = String(materialRequest.id);
    const productionBatch = Array.isArray(materialRequest.production_batches)
      ? materialRequest.production_batches[0] as Row | undefined
      : materialRequest.production_batches as Row | undefined;
    detailsByKind.get('production_material_request')?.set(id, {
      currentApprover: materialRequest.approved_by ? String(materialRequest.approved_by) : null,
      description: productionBatch?.batch_number ? `Production materials for ${String(productionBatch.batch_number)}` : 'Production material request',
      destinationWarehouseId: productionBatch?.warehouse_id ? String(productionBatch.warehouse_id) : null,
      notes: materialRequest.notes ? String(materialRequest.notes) : null,
      quantity: materialRequestQuantities.get(id) ?? null,
      referenceNumber: String(materialRequest.request_number ?? id),
      requestDate: String(materialRequest.request_date ?? ''),
      sourceContextDiagnostic: null,
      sourceContextStatus: 'mapped',
      sourceWarehouseId: null,
    });
  }

  for (const transfer of finishedGoodsTransfers.rows) {
    const id = String(transfer.id);
    detailsByKind.get('finished_goods_transfer')?.set(id, {
      currentApprover: transfer.received_by ? String(transfer.received_by) : null,
      description: 'Finished goods transfer',
      destinationWarehouseId: transfer.destination_warehouse_id ? String(transfer.destination_warehouse_id) : null,
      notes: null,
      quantity: transfer.quantity_transferred === null || transfer.quantity_transferred === undefined ? null : toNumber(transfer.quantity_transferred),
      referenceNumber: id,
      requestDate: String(transfer.transfer_date ?? ''),
      sourceContextDiagnostic: null,
      sourceContextStatus: 'mapped',
      sourceWarehouseId: transfer.source_warehouse_id ? String(transfer.source_warehouse_id) : null,
    });
  }

  const detailByApprovalId = new Map<string, DocumentDetail>();
  for (const approval of approvals) {
    const approvalId = String(approval.id);
    const entityId = String(approval.entity_id ?? '');
    const kind = sourceKindForApproval(approval);

    if (!kind) {
      detailByApprovalId.set(approvalId, {
        currentApprover: null,
        description: String(approval.document_reference ?? approval.entity_id ?? 'Inventory approval'),
        destinationWarehouseId: null,
        notes: null,
        quantity: null,
        referenceNumber: String(approval.document_reference ?? approval.entity_id ?? approval.id),
        requestDate: String(approval.requested_at ?? ''),
        sourceContextDiagnostic: 'Approval document type has no inventory source mapper.',
        sourceContextStatus: 'unsupported_source',
        sourceWarehouseId: null,
      });
      continue;
    }

    if (kind === 'stock_take') {
      detailByApprovalId.set(approvalId, {
        currentApprover: null,
        description: 'Inventory stock take',
        destinationWarehouseId: null,
        notes: null,
        quantity: null,
        referenceNumber: String(approval.document_reference ?? approval.entity_id ?? approval.id),
        requestDate: String(approval.requested_at ?? ''),
        sourceContextDiagnostic: 'Stock take approvals are recognized, but no source table mapper is configured.',
        sourceContextStatus: 'unsupported_source',
        sourceWarehouseId: null,
      });
      continue;
    }

    const detail = detailsByKind.get(kind)?.get(entityId);
    if (detail) {
      detailByApprovalId.set(approvalId, detail);
      continue;
    }

    detailByApprovalId.set(approvalId, {
      currentApprover: null,
      description: String(approval.document_reference ?? approval.entity_id ?? 'Inventory approval'),
      destinationWarehouseId: null,
      notes: null,
      quantity: null,
      referenceNumber: String(approval.document_reference ?? approval.entity_id ?? approval.id),
      requestDate: String(approval.requested_at ?? ''),
      sourceContextDiagnostic: diagnosticsByKind.get(kind) ?? `No ${kind} source row found for approval entity_id ${entityId}.`,
      sourceContextStatus: 'source_missing',
      sourceWarehouseId: null,
    });
  }

  return detailByApprovalId;
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const status = normalizeInventoryApprovalStatus(searchParams.get('status') ?? 'PENDING');
  const requestType = normalizeCode(searchParams.get('requestType'));
  const warehouseId = searchParams.get('warehouseId');
  const requester = searchParams.get('requester');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const pendingStatusRequested = isPendingInventoryApprovalStatus(status);

  try {
    const warehouseScope = await resolveWarehouseScope(service, ctx);
    let query = service
      .from('approval_requests')
      .select(
        `id, entity_type, entity_id, current_step, status, requested_at, completed_at, requested_by,
         module_name, document_type, document_reference, request_reason, approver_role_name, approver_user_id,
         actions:approval_actions(id, action, comments, acted_at)`,
      )
      .eq('organization_id', ctx.organizationId)
      .order('requested_at', { ascending: false });

    if (status && status !== 'ALL' && !pendingStatusRequested) {
      query = query.eq('status', status);
    }
    if (requester) query = query.eq('requested_by', requester);
    if (startDate) query = query.gte('requested_at', new Date(startDate).toISOString());
    if (endDate) query = query.lte('requested_at', new Date(`${endDate}T23:59:59.999Z`).toISOString());

    const { data, error } = await query;
    if (error) return serverError(error.message);

    const baseApprovals = ((data ?? []) as Row[])
      .filter(isInventoryApproval)
      .filter((row) => !requestType || normalizeCode(row.document_type || row.entity_type).includes(requestType))
      .filter((row) => {
        if (!status || status === 'ALL') return true;
        if (pendingStatusRequested) return isPendingInventoryApprovalStatus(row.status);
        return normalizeInventoryApprovalStatus(row.status) === status;
      });

    const detailByApprovalId = await loadInventoryDocumentDetails(service, ctx.organizationId, baseApprovals);
    const userIds = [...new Set(baseApprovals.flatMap((row) => [row.requested_by, row.approver_user_id]).filter(Boolean).map(String))];
    const { data: users, error: usersError } = userIds.length
      ? await service.from('users').select('id, first_name, last_name, full_name, email').eq('organization_id', ctx.organizationId).in('id', userIds)
      : { data: [], error: null };
    if (usersError) return serverError(usersError.message);

    const usersById = new Map((users ?? []).map((user: Row) => [
      String(user.id),
      String(user.full_name ?? (`${String(user.first_name ?? '')} ${String(user.last_name ?? '')}`.trim() || user.email || user.id)),
    ]));

    const approvals = baseApprovals
      .map((row) => {
        const documentType = normalizeCode(row.document_type || row.entity_type).replace(/^inventory\./, '');
        const detail = detailByApprovalId.get(String(row.id));
        const sourceWarehouseId = detail?.sourceWarehouseId ? String(detail.sourceWarehouseId) : null;
        const destinationWarehouseId = detail?.destinationWarehouseId ? String(detail.destinationWarehouseId) : null;

        if (warehouseId && sourceWarehouseId !== warehouseId && destinationWarehouseId !== warehouseId) return null;
        if (
          warehouseScope &&
          (sourceWarehouseId || destinationWarehouseId) &&
          !warehouseScope.includes(sourceWarehouseId ?? '') &&
          !warehouseScope.includes(destinationWarehouseId ?? '')
        ) {
          return null;
        }

        const requestedById = row.requested_by ? String(row.requested_by) : null;
        const approverId = row.approver_user_id ? String(row.approver_user_id) : detail?.currentApprover ? String(detail.currentApprover) : null;

        return {
          id: String(row.id),
          entity_id: String(row.entity_id ?? ''),
          entity_type: String(row.entity_type ?? row.document_type ?? 'inventory_approval'),
          current_step: Number(row.current_step ?? 1),
          status: String(row.status ?? 'PENDING'),
          requested_at: String(row.requested_at ?? ''),
          completed_at: row.completed_at ? String(row.completed_at) : null,
          actions: Array.isArray(row.actions) ? row.actions : [],
          approvalId: String(row.id),
          approvalStatus: String(row.status ?? 'PENDING'),
          approvalNotes: row.request_reason ? String(row.request_reason) : detail?.notes ? String(detail.notes) : null,
          canApprove: can(ctx, 'inventory.write', 'inventory.transfer.approve', 'procurement.approve') && isPendingInventoryApprovalStatus(row.status),
          currentApprover: approverId ? usersById.get(approverId) ?? approverId : String(row.approver_role_name ?? 'Current approver'),
          destinationWarehouseId,
          itemDescription: detail?.description ? String(detail.description) : String(row.document_reference ?? row.entity_id ?? 'Inventory approval'),
          quantity: detail?.quantity ?? null,
          referenceNumber: detail?.referenceNumber ? String(detail.referenceNumber) : String(row.document_reference ?? row.entity_id ?? row.id),
          requestDate: detail?.requestDate ? String(detail.requestDate) : String(row.requested_at ?? ''),
          requestedBy: requestedById ? usersById.get(requestedById) ?? requestedById : null,
          requesterId: requestedById,
          requestType: documentType || String(row.entity_type ?? 'inventory_approval'),
          sourceContextDiagnostic: detail?.sourceContextDiagnostic ?? null,
          sourceContextStatus: detail?.sourceContextStatus ?? 'unsupported_source',
          sourceWarehouseId,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, data: approvals });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load inventory approvals');
  }
}
