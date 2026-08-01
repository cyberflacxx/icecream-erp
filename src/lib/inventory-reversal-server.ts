import { createServiceRoleClient } from '@/lib/supabase/server';

export type InventoryReversalResult = {
  code?: string;
  message?: string;
  success: boolean;
  [key: string]: unknown;
};

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

type ReversalSnapshot = {
  approvedBy: string | null;
  approvedByName: string | null;
  branchId: string | null;
  createdAt: string | null;
  fiscalPeriodId: string | null;
  id: string;
  idempotencyKey: string | null;
  movementIds: string[];
  operationType: string;
  originalDocumentId: string;
  originalDocumentType: string;
  originalJournalId: string | null;
  originalMovementIds: string[];
  postedAt: string | null;
  postedBy: string | null;
  postedByName: string | null;
  reason: string;
  reversalJournalId: string | null;
  reversalJournalNumber: string | null;
  reversalNumber: string | null;
  reversalReason: string;
  reversalReference: string | null;
  requestedBy: string | null;
  requestedByName: string | null;
  status: string;
};

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? '')).filter(Boolean);
}

export function mapInventoryReversalError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : 'Inventory reversal failed.';

  if (
    message.includes('not found') ||
    message.includes('not eligible') ||
    message.includes('No open fiscal period') ||
    message.includes('was not found')
  ) {
    return { message, status: 404 };
  }

  if (
    message.includes('already') ||
    message.includes('Only ') ||
    message.includes('Cannot ') ||
    message.includes('cannot ') ||
    message.includes('requires') ||
    message.includes('Insufficient') ||
    message.includes('closed') ||
    message.includes('blocked') ||
    message.includes('exceeds')
  ) {
    return { message, status: 409 };
  }

  return { message, status: 400 };
}

export async function invokeInventoryReversalRpc<T>(
  service: ServiceClient,
  fn: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await service.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export async function reverseGoodsReceivedNote(input: {
  actorUserId: string;
  branchId: string | null;
  costCenterCode: string | null;
  grnId: string;
  idempotencyKey: string;
  journalDate: string;
  organizationId: string;
  reason: string;
}) {
  const service = createServiceRoleClient();
  return invokeInventoryReversalRpc<InventoryReversalResult>(service, 'reverse_goods_received_note_atomic', {
    p_actor_user_id: input.actorUserId,
    p_branch_id: input.branchId,
    p_cost_center_code: input.costCenterCode,
    p_grn_id: input.grnId,
    p_idempotency_key: input.idempotencyKey,
    p_journal_date: input.journalDate,
    p_organization_id: input.organizationId,
    p_reason: input.reason,
  });
}

export async function reverseInventoryAdjustment(input: {
  actorUserId: string;
  adjustmentId: string;
  branchId: string | null;
  costCenterCode: string | null;
  idempotencyKey: string;
  journalDate: string;
  organizationId: string;
  reason: string;
}) {
  const service = createServiceRoleClient();
  return invokeInventoryReversalRpc<InventoryReversalResult>(service, 'reverse_inventory_adjustment_atomic', {
    p_actor_user_id: input.actorUserId,
    p_adjustment_id: input.adjustmentId,
    p_branch_id: input.branchId,
    p_cost_center_code: input.costCenterCode,
    p_idempotency_key: input.idempotencyKey,
    p_journal_date: input.journalDate,
    p_organization_id: input.organizationId,
    p_reason: input.reason,
  });
}

export async function reverseInventoryWriteOff(input: {
  actorUserId: string;
  batchId: string;
  branchId: string | null;
  costCenterCode: string | null;
  idempotencyKey: string;
  journalDate: string;
  organizationId: string;
  reason: string;
}) {
  const service = createServiceRoleClient();
  return invokeInventoryReversalRpc<InventoryReversalResult>(service, 'reverse_inventory_write_off_atomic', {
    p_actor_user_id: input.actorUserId,
    p_batch_id: input.batchId,
    p_branch_id: input.branchId,
    p_cost_center_code: input.costCenterCode,
    p_idempotency_key: input.idempotencyKey,
    p_journal_date: input.journalDate,
    p_organization_id: input.organizationId,
    p_reason: input.reason,
  });
}

export async function reverseStockTransferDispatch(input: {
  actorUserId: string;
  branchId: string | null;
  costCenterCode: string | null;
  idempotencyKey: string;
  journalDate: string;
  organizationId: string;
  reason: string;
  transferId: string;
}) {
  const service = createServiceRoleClient();
  return invokeInventoryReversalRpc<InventoryReversalResult>(service, 'reverse_stock_transfer_dispatch_atomic', {
    p_actor_user_id: input.actorUserId,
    p_branch_id: input.branchId,
    p_cost_center_code: input.costCenterCode,
    p_idempotency_key: input.idempotencyKey,
    p_journal_date: input.journalDate,
    p_organization_id: input.organizationId,
    p_reason: input.reason,
    p_transfer_id: input.transferId,
  });
}

export async function reverseStockTransferReceipt(input: {
  actorUserId: string;
  branchId: string | null;
  costCenterCode: string | null;
  idempotencyKey: string;
  journalDate: string;
  organizationId: string;
  reason: string;
  transferId: string;
}) {
  const service = createServiceRoleClient();
  return invokeInventoryReversalRpc<InventoryReversalResult>(service, 'reverse_stock_transfer_receipt_atomic', {
    p_actor_user_id: input.actorUserId,
    p_branch_id: input.branchId,
    p_cost_center_code: input.costCenterCode,
    p_idempotency_key: input.idempotencyKey,
    p_journal_date: input.journalDate,
    p_organization_id: input.organizationId,
    p_reason: input.reason,
    p_transfer_id: input.transferId,
  });
}

export async function loadInventoryReversalSnapshots(
  service: ServiceClient,
  originalDocumentType: string,
  originalDocumentIds: string[],
) {
  const ids = [...new Set(originalDocumentIds.map((value) => String(value ?? '').trim()).filter(Boolean))];
  if (!ids.length) return new Map<string, ReversalSnapshot[]>();

  const { data, error } = await service
    .from('inventory_reversal_runs')
    .select(
      'id, original_document_type, original_document_id, operation_type, original_journal_entry_id, reversal_journal_entry_id, branch_id, fiscal_period_id, reason, reversal_number, reversal_reference, original_movement_ids, reversal_movement_ids, requested_by, approved_by, posted_by, idempotency_key, status, created_at, posted_at, result',
    )
    .eq('original_document_type', originalDocumentType)
    .in('original_document_id', ids)
    .order('created_at', { ascending: false });

  if (error) {
    if (String(error.message ?? '').includes("Could not find the table 'icecream_erp.inventory_reversal_runs'")) {
      return new Map<string, ReversalSnapshot[]>();
    }

    throw error;
  }

  const journalIds = [
    ...new Set(
      (data ?? [])
        .flatMap((row) => [row.original_journal_entry_id, row.reversal_journal_entry_id])
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  ];
  const journalsResult = journalIds.length
    ? await service.from('journal_entries').select('id, entry_number').in('id', journalIds)
    : { data: [], error: null };
  if (journalsResult.error) {
    throw journalsResult.error;
  }
  const journalsById = new Map(
    (journalsResult.data ?? []).map((row) => [String(row.id ?? ''), String(row.entry_number ?? '')] as const),
  );
  const userIds = [
    ...new Set(
      (data ?? [])
        .flatMap((row) => [row.requested_by, row.approved_by, row.posted_by])
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  ];
  const usersResult = userIds.length
    ? await service.from('users').select('id, first_name, last_name, email').in('id', userIds)
    : { data: [], error: null };
  if (usersResult.error) {
    throw usersResult.error;
  }
  const usersById = new Map(
    (usersResult.data ?? []).map((row) => {
      const name = [String(row.first_name ?? '').trim(), String(row.last_name ?? '').trim()].filter(Boolean).join(' ').trim();
      return [String(row.id ?? ''), name || String(row.email ?? '').trim() || String(row.id ?? '')] as const;
    }),
  );

  const grouped = new Map<string, ReversalSnapshot[]>();

  for (const row of data ?? []) {
    const result = (row.result ?? {}) as Record<string, unknown>;
    const originalDocumentId = String(row.original_document_id ?? '').trim();
    if (!originalDocumentId) continue;

    const snapshot: ReversalSnapshot = {
      approvedBy: row.approved_by ? String(row.approved_by) : null,
      approvedByName: row.approved_by ? usersById.get(String(row.approved_by)) ?? String(row.approved_by) : null,
      branchId: row.branch_id ? String(row.branch_id) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
      fiscalPeriodId: row.fiscal_period_id ? String(row.fiscal_period_id) : null,
      id: String(row.id ?? ''),
      idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
      movementIds: toStringArray(result.movementIds ?? result.reversalMovementIds),
      operationType: String(row.operation_type ?? ''),
      originalDocumentId,
      originalDocumentType: String(row.original_document_type ?? ''),
      originalJournalId: row.original_journal_entry_id ? String(row.original_journal_entry_id) : null,
      originalMovementIds: toStringArray(row.original_movement_ids),
      postedAt: row.posted_at ? String(row.posted_at) : null,
      postedBy: row.posted_by ? String(row.posted_by) : null,
      postedByName: row.posted_by ? usersById.get(String(row.posted_by)) ?? String(row.posted_by) : null,
      reason: String(row.reason ?? ''),
      reversalJournalId: row.reversal_journal_entry_id ? String(row.reversal_journal_entry_id) : null,
      reversalJournalNumber: row.reversal_journal_entry_id
        ? journalsById.get(String(row.reversal_journal_entry_id)) ?? null
        : null,
      reversalNumber: row.reversal_number ? String(row.reversal_number) : null,
      reversalReason: String(row.reason ?? ''),
      reversalReference: row.reversal_reference ? String(row.reversal_reference) : null,
      requestedBy: row.requested_by ? String(row.requested_by) : null,
      requestedByName: row.requested_by ? usersById.get(String(row.requested_by)) ?? String(row.requested_by) : null,
      status: String(row.status ?? ''),
    };

    grouped.set(originalDocumentId, [...(grouped.get(originalDocumentId) ?? []), snapshot]);
  }

  return grouped;
}
