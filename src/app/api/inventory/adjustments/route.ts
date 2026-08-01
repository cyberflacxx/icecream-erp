import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  findOpenFiscalPeriod,
  getFinanceModuleDefaultCostCentreCodes,
  resolveFinanceCostCentreCode,
  resolveFinancePostingAccount,
} from '@/lib/finance-foundation-server';
import { resolveInventoryPostingMappingKey, toDateOnly } from '@/lib/finance-integration';
import {
  buildInventoryPostingIdempotencyKey,
  invokeInventoryPostingRpc,
  loadWarehouseBranchId,
} from '@/lib/inventory-posting-server';
import { getBalance, requireItem, requireWarehouseAccess } from '@/lib/inventory-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write')) return forbidden();

  const service = createServiceRoleClient();
  const body = (await request.json().catch(() => ({}))) as {
    itemId?: string;
    quantity?: number;
    reason?: string;
    transactionAt?: string;
    type?: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
    unitCost?: number;
    warehouseId?: string;
  };

  const { itemId, warehouseId, quantity, transactionAt, type, reason } = body;
  if (!itemId || !warehouseId || quantity === undefined || !type || !reason || !transactionAt) {
    return badRequest('itemId, warehouseId, quantity, type, reason, and transactionAt are required.');
  }

  if (!['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'].includes(type)) {
    return badRequest('type must be ADJUSTMENT_IN or ADJUSTMENT_OUT.');
  }

  const qty = Number(quantity);
  if (Number.isNaN(qty) || qty <= 0) {
    return badRequest('quantity must be a positive number.');
  }

  try {
    const parsedTransactionAt = new Date(transactionAt);
    if (Number.isNaN(parsedTransactionAt.getTime())) {
      return badRequest('transactionAt must be a valid ISO date-time.');
    }

    const [item, warehouse] = await Promise.all([
      requireItem(service, itemId),
      requireWarehouseAccess(service, warehouseId, ctx.branchId, ctx.isBranchScoped, ctx.warehouseAssignments),
    ]);
    const branchId = await loadWarehouseBranchId(service as never, warehouseId);
    const unitCost = Number(body.unitCost ?? item.unit_cost ?? 0);
    const totalValue = Math.max(0, qty * unitCost);
    const balance = await getBalance(service, itemId, warehouseId);
    const available = Number(balance?.quantity_available ?? balance?.quantity_on_hand ?? balance?.quantity ?? 0);

    if (type === 'ADJUSTMENT_OUT' && available < qty) {
      return badRequest(
        `Insufficient stock for ${item.name}. Available: ${available.toFixed(3)}, Required: ${qty.toFixed(3)}`,
      );
    }

    const postingDate = toDateOnly(parsedTransactionAt.toISOString());
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
      itemType: String(item.item_type ?? ''),
    });
    const inventoryAccount = await resolveFinancePostingAccount(ctx.organizationId, mappingKey, {
      branchId,
      fallbackAccountCode: mappingKey === 'PACKAGING_INVENTORY' ? '1217' : '1210',
      transactionType: 'STOCK_ADJUSTMENT',
    });
    const varianceAccount = await resolveFinancePostingAccount(ctx.organizationId, 'INVENTORY_VARIANCE', {
      branchId,
      fallbackAccountCode: '1270',
      transactionType: 'STOCK_ADJUSTMENT',
    });
    const financeLines = type === 'ADJUSTMENT_IN'
      ? [
          {
            accountId: inventoryAccount.id,
            branchId,
            costCenterCode,
            creditAmount: 0,
            debitAmount: totalValue,
            description: `Inventory gain for ${item.name}`,
          },
          {
            accountId: varianceAccount.id,
            branchId,
            costCenterCode,
            creditAmount: totalValue,
            debitAmount: 0,
            description: `Inventory gain offset for ${item.name}`,
          },
        ]
      : [
          {
            accountId: varianceAccount.id,
            branchId,
            costCenterCode,
            creditAmount: 0,
            debitAmount: totalValue,
            description: `Inventory loss for ${item.name}`,
          },
          {
            accountId: inventoryAccount.id,
            branchId,
            costCenterCode,
            creditAmount: totalValue,
            debitAmount: 0,
            description: `Inventory reduction for ${item.name}`,
          },
        ];

    const postingResult = await invokeInventoryPostingRpc<{
      adjustmentId: string;
      adjustmentNumber: string;
      journal: { entryNumber: string; id: string };
      movementId: string;
      movementType: string;
      quantityOnHand: number;
      stockValue: number;
      success: boolean;
    }>(service as never, 'post_inventory_adjustment_atomic', {
      p_actor_user_id: ctx.userId,
      p_branch_id: branchId,
      p_cost_center_code: costCenterCode,
      p_finance_lines: financeLines,
      p_idempotency_key: buildInventoryPostingIdempotencyKey({
        actorUserId: ctx.userId,
        documentId: `${warehouseId}:${itemId}:${postingDate}:${type}`,
        operation: 'stock_adjustment_post',
      }),
      p_item_id: itemId,
      p_journal_date: postingDate,
      p_movement_type: type,
      p_organization_id: ctx.organizationId,
      p_quantity: qty,
      p_reason: reason,
      p_unit_cost: unitCost,
      p_warehouse_id: warehouseId,
    });

    return NextResponse.json(
      {
        ...postingResult,
        fiscalPeriodId: String(period.id ?? ''),
        itemId,
        warehouseId,
      },
      { status: 201 },
    );
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to post stock adjustment.');
  }
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.adjustment.view', 'inventory.read')) return forbidden();

  const service = createServiceRoleClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(25, parseInt(searchParams.get('pageSize') ?? '10'));
  const from = (page - 1) * pageSize;

  try {
    const { loadInventoryReversalSnapshots } = await import('@/lib/inventory-reversal-server');
    const query = service
      .from('stock_adjustments')
      .select('id, adjustment_number, adjustment_date, status, reason, warehouse_id, journal_entry_id, posted_at, reversed_at, reversal_reason, created_at', {
        count: 'exact',
      })
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    const { data, count, error } = await query;
    if (error) {
      return serverError(error.message);
    }

    const adjustmentIds = (data ?? []).map((row) => String(row.id ?? ''));
    const warehouseIds = [...new Set((data ?? []).map((row) => String(row.warehouse_id ?? '')).filter(Boolean))];
    const [linesResult, itemsResult, warehousesResult, reversalMap] = await Promise.all([
      adjustmentIds.length
        ? service.from('stock_adjustment_items').select('adjustment_id, item_id, quantity_adjusted, movement_type, unit_cost').in('adjustment_id', adjustmentIds)
        : Promise.resolve({ data: [], error: null }),
      adjustmentIds.length
        ? service
            .from('stock_adjustment_items')
            .select('adjustment_id, item_id, items!item_id(id, code, name)')
            .in('adjustment_id', adjustmentIds)
        : Promise.resolve({ data: [], error: null }),
      warehouseIds.length
        ? service.from('warehouses').select('id, name').in('id', warehouseIds)
        : Promise.resolve({ data: [], error: null }),
      loadInventoryReversalSnapshots(service, 'stock_adjustment', adjustmentIds),
    ]);

    if (linesResult.error) return serverError(linesResult.error.message);
    if (itemsResult.error) return serverError(itemsResult.error.message);
    if (warehousesResult.error) return serverError(warehousesResult.error.message);

    const lineByAdjustmentId = new Map(
      (linesResult.data ?? []).map((row) => [String(row.adjustment_id ?? ''), row] as const),
    );
    const itemByAdjustmentId = new Map(
      (itemsResult.data ?? []).map((row) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        return [String(row.adjustment_id ?? ''), item ?? null] as const;
      }),
    );
    const warehousesById = new Map(
      (warehousesResult.data ?? []).map((row) => [String(row.id ?? ''), String(row.name ?? 'Unknown warehouse')] as const),
    );

    return NextResponse.json({
      data: (data ?? []).map((row) => {
        const id = String(row.id ?? '');
        const line = lineByAdjustmentId.get(id) as Record<string, unknown> | undefined;
        const item = itemByAdjustmentId.get(id) as Record<string, unknown> | null | undefined;
        const reversal = reversalMap.get(id)?.[0] ?? null;
        return {
          id,
          adjustmentDate: row.adjustment_date ? String(row.adjustment_date) : null,
          adjustmentNumber: String(row.adjustment_number ?? ''),
          item: item
            ? {
                code: String(item.code ?? ''),
                id: String(item.id ?? ''),
                name: String(item.name ?? 'Unknown item'),
              }
            : null,
          journalEntryId: row.journal_entry_id ? String(row.journal_entry_id) : null,
          movementType: line?.movement_type ? String(line.movement_type) : null,
          quantity: Number(line?.quantity_adjusted ?? 0),
          reason: String(row.reason ?? ''),
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
          status: reversal ? 'REVERSED' : String(row.status ?? ''),
          unitCost: Number(line?.unit_cost ?? 0),
          warehouse: row.warehouse_id
            ? {
                id: String(row.warehouse_id),
                name: warehousesById.get(String(row.warehouse_id)) ?? 'Unknown warehouse',
              }
            : null,
        };
      }),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load stock adjustments.');
  }
}
