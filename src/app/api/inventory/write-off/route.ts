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
import {
  findOpenFiscalPeriod,
  getFinanceModuleDefaultCostCentreCodes,
  resolveFinanceCostCentreCode,
  resolveFinancePostingAccount,
} from '@/lib/finance-foundation-server';
import { resolveInventoryPostingMappingKey, toDateOnly } from '@/lib/finance-integration';
import { buildInventoryPostingIdempotencyKey, invokeInventoryPostingRpc } from '@/lib/inventory-posting-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write')) return forbidden();

  const service = createServiceRoleClient();

  const body = (await request.json()) as {
    batchId?: string;
    reason?: string;
  };

  const { batchId, reason } = body;

  if (!batchId || !reason) {
    return badRequest('batchId and reason are required.');
  }

  // Fetch the batch
  const { data: batch, error: batchErr } = await service
    .from('inventory_batches')
    .select(
      `id, batch_number, expiry_date, quantity_remaining, status, item_id, warehouse_id, unit_cost,
       items!item_id(id, name)`,
    )
    .eq('id', batchId)
    .single();

  if (batchErr || !batch) return notFound('Inventory batch not found.');

  // Branch scope check
  if (ctx.isBranchScoped && ctx.branchId) {
    const { data: wh } = await service
      .from('warehouses')
      .select('branch_id')
      .eq('id', batch.warehouse_id)
      .single();
    if (!wh || wh.branch_id !== ctx.branchId) {
      return forbidden();
    }
  }

  // Only expired batches can be written off
  if (!batch.expiry_date) {
    return badRequest('Only batches with an expiry date can be written off.');
  }

  const expiryDate = new Date(batch.expiry_date);
  expiryDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (expiryDate.getTime() > today.getTime()) {
    return badRequest('Only expired batches can be written off.');
  }

  const quantityToWriteOff = Number(batch.quantity_remaining);
  if (quantityToWriteOff <= 0) {
    return badRequest('Batch has no remaining quantity to write off.');
  }

  const rawBatchItems = batch.items as { id?: string; name?: string } | Array<{ id?: string; name?: string }> | null;
  const batchItemObj = Array.isArray(rawBatchItems) ? (rawBatchItems[0] ?? null) : rawBatchItems;
  const itemName = batchItemObj?.name ?? 'Unknown';
  const postingDate = toDateOnly(new Date().toISOString());

  // Get stock balance
  const { data: balance, error: balErr } = await service
    .from('stock_balances')
    .select('id, quantity_on_hand, quantity_available, quantity_reserved')
    .eq('item_id', batch.item_id)
    .eq('warehouse_id', batch.warehouse_id)
    .single();

  if (balErr || !balance) {
    return badRequest(`No stock balance found for item ${itemName} in the specified warehouse.`);
  }

  const currentOnHand = Number(balance.quantity_on_hand);
  const currentReserved = Number(balance.quantity_reserved);

  if (currentOnHand < quantityToWriteOff) {
    return badRequest(
      `Insufficient stock for ${itemName}. On hand: ${currentOnHand.toFixed(3)}, Required: ${quantityToWriteOff.toFixed(3)}`,
    );
  }

  // Reduce reserved proportionally (take minimum of reserved and write-off qty)
  const reservedReduction = Math.min(currentReserved, quantityToWriteOff);
  const newOnHand = currentOnHand - quantityToWriteOff;
  const newReserved = currentReserved - reservedReduction;
  const newAvailable = newOnHand - newReserved;
  const { data: warehouseMeta, error: warehouseMetaError } = await service
    .from('warehouses')
    .select('id, branch_id')
    .eq('id', batch.warehouse_id)
    .single();
  if (warehouseMetaError || !warehouseMeta) {
    return serverError(warehouseMetaError?.message ?? 'Warehouse was not found.');
  }
  const branchId = warehouseMeta.branch_id ? String(warehouseMeta.branch_id) : null;
  const period = await findOpenFiscalPeriod(ctx.organizationId, postingDate);
  if (!period) {
    return badRequest(`No open fiscal period exists for ${postingDate}.`);
  }
  const costCenterCode = await resolveFinanceCostCentreCode(ctx.organizationId, {
    branchId,
    preferredCodes: getFinanceModuleDefaultCostCentreCodes('inventory'),
  });
  const mappingKey = resolveInventoryPostingMappingKey({
    itemCategoryName: null,
    itemType: null,
  });
  const inventoryAccount = await resolveFinancePostingAccount(ctx.organizationId, mappingKey, {
    branchId,
    fallbackAccountCode: '1210',
    transactionType: 'WRITE_OFF',
  });
  const writeOffAccount = await resolveFinancePostingAccount(ctx.organizationId, 'INVENTORY_WRITE_OFF', {
    branchId,
    fallbackAccountCode: '5090',
    transactionType: 'WRITE_OFF',
  });
  const writeOffValue = Number(batch.unit_cost ?? 0) * quantityToWriteOff;
  const postingResult = await invokeInventoryPostingRpc<{
    batchId: string;
    journal: { entryNumber: string; id: string };
    movementId: string;
    quantityOnHand: number;
    status: string;
    stockValue: number;
    success: boolean;
  }>(service as never, 'post_inventory_write_off_atomic', {
    p_actor_user_id: ctx.userId,
    p_batch_id: batchId,
    p_branch_id: branchId,
    p_cost_center_code: costCenterCode,
    p_finance_lines: [
      {
        accountId: writeOffAccount.id,
        branchId,
        costCenterCode,
        creditAmount: 0,
        debitAmount: writeOffValue,
        description: `Inventory write-off for ${itemName}`,
      },
      {
        accountId: inventoryAccount.id,
        branchId,
        costCenterCode,
        creditAmount: writeOffValue,
        debitAmount: 0,
        description: `Inventory reduction for ${itemName}`,
      },
    ],
    p_idempotency_key: buildInventoryPostingIdempotencyKey({
      actorUserId: ctx.userId,
      documentId: String(batchId),
      operation: 'inventory_write_off_post',
    }),
    p_journal_date: postingDate,
    p_organization_id: ctx.organizationId,
    p_reason: reason,
  });

  return NextResponse.json({ ...postingResult, fiscalPeriodId: String(period.id ?? '') });
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.read', 'inventory.adjustment.view')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(25, parseInt(searchParams.get('pageSize') ?? '10'));
  const from = (page - 1) * pageSize;

  try {
    const { loadInventoryReversalSnapshots } = await import('@/lib/inventory-reversal-server');
    const { data, count, error } = await service
      .from('inventory_posting_runs')
      .select('source_document_id, result, journal_entry_id, created_at', { count: 'exact' })
      .eq('organization_id', ctx.organizationId)
      .eq('operation_type', 'inventory_write_off_post')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) return serverError(error.message);

    const batchIds = (data ?? []).map((row) => String(row.source_document_id ?? '')).filter(Boolean);
    const [batchesResult, movementsResult, itemsResult, warehousesResult, reversalMap] = await Promise.all([
      batchIds.length
        ? service.from('inventory_batches').select('id, batch_number, expiry_date, item_id, warehouse_id, unit_cost').in('id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      batchIds.length
        ? service
            .from('stock_movements')
            .select('source_document_id, quantity, total_value, total_cost')
            .eq('source_document_type', 'inventory_write_off')
            .in('source_document_id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      batchIds.length
        ? service.from('inventory_batches').select('id, item_id, items!item_id(id, code, name)').in('id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      batchIds.length
        ? service.from('inventory_batches').select('id, warehouse_id, warehouses!warehouse_id(id, name)').in('id', batchIds)
        : Promise.resolve({ data: [], error: null }),
      loadInventoryReversalSnapshots(service, 'inventory_write_off', batchIds),
    ]);

    if (batchesResult.error) return serverError(batchesResult.error.message);
    if (movementsResult.error) return serverError(movementsResult.error.message);
    if (itemsResult.error) return serverError(itemsResult.error.message);
    if (warehousesResult.error) return serverError(warehousesResult.error.message);

    const batchById = new Map((batchesResult.data ?? []).map((row) => [String(row.id ?? ''), row] as const));
    const movementByBatchId = new Map((movementsResult.data ?? []).map((row) => [String(row.source_document_id ?? ''), row] as const));
    const itemByBatchId = new Map(
      (itemsResult.data ?? []).map((row) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        return [String(row.id ?? ''), item ?? null] as const;
      }),
    );
    const warehouseByBatchId = new Map(
      (warehousesResult.data ?? []).map((row) => {
        const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
        return [String(row.id ?? ''), warehouse ?? null] as const;
      }),
    );

    return NextResponse.json({
      data: batchIds.map((batchId) => {
        const batch = batchById.get(batchId) as Record<string, unknown> | undefined;
        const movement = movementByBatchId.get(batchId) as Record<string, unknown> | undefined;
        const item = itemByBatchId.get(batchId) as Record<string, unknown> | null | undefined;
        const warehouse = warehouseByBatchId.get(batchId) as Record<string, unknown> | null | undefined;
        const run = (data ?? []).find((row) => String(row.source_document_id ?? '') === batchId);
        const reversal = reversalMap.get(batchId)?.[0] ?? null;
        return {
          batchId,
          batchNumber: String(batch?.batch_number ?? ''),
          expiryDate: batch?.expiry_date ? String(batch.expiry_date) : null,
          item: item
            ? {
                code: String(item.code ?? ''),
                id: String(item.id ?? ''),
                name: String(item.name ?? 'Unknown item'),
              }
            : null,
          journalEntryId: run?.journal_entry_id ? String(run.journal_entry_id) : null,
          quantity: Number(movement?.quantity ?? 0),
          reversal: reversal
            ? {
                approvedBy: reversal.approvedBy,
                approvedByName: reversal.approvedByName,
                id: reversal.id,
                originalJournalId: reversal.originalJournalId,
                originalMovementIds: reversal.originalMovementIds,
                postedAt: reversal.postedAt,
                postedBy: reversal.postedBy,
                postedByName: reversal.postedByName,
                reason: reversal.reason,
                requestedBy: reversal.requestedBy,
                requestedByName: reversal.requestedByName,
                reversalJournalId: reversal.reversalJournalId,
                reversalJournalNumber: reversal.reversalJournalNumber,
                reversalMovementIds: reversal.movementIds,
                reversalNumber: reversal.reversalNumber,
                reversalReference: reversal.reversalReference,
                status: reversal.status,
              }
            : null,
          status: reversal ? 'REVERSED' : 'POSTED',
          unitCost: Number(batch?.unit_cost ?? 0),
          value: Number(movement?.total_value ?? movement?.total_cost ?? 0),
          warehouse: warehouse
            ? {
                id: String(warehouse.id ?? ''),
                name: String(warehouse.name ?? 'Unknown warehouse'),
              }
            : null,
        };
      }),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load inventory write-offs.');
  }
}
