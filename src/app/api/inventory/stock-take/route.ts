import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  findOpenFiscalPeriod,
  getFinanceModuleDefaultCostCentreCodes,
  resolveFinanceCostCentreCode,
  resolveFinancePostingAccount,
} from '@/lib/finance-foundation-server';
import { collapseFinancePostingLines, resolveInventoryPostingMappingKey, toDateOnly } from '@/lib/finance-integration';
import {
  buildInventoryPostingIdempotencyKey,
  invokeInventoryPostingRpc,
  loadWarehouseBranchId,
} from '@/lib/inventory-posting-server';
import { requireWarehouseAccess } from '@/lib/inventory-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

function buildStockTakeNumber() {
  return `STK-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.write', 'reports.read')) return forbidden();

  const service = createServiceRoleClient();
  const body = (await request.json().catch(() => ({}))) as {
    items?: Array<{ itemId: string; physicalQuantity: number }>;
    postVariances?: boolean;
    reason?: string;
    warehouseId?: string;
  };

  if (!body.warehouseId || !body.items?.length) {
    return badRequest('warehouseId and at least one stock take line are required.');
  }

  try {
    await requireWarehouseAccess(service, body.warehouseId, ctx.branchId, ctx.isBranchScoped, ctx.warehouseAssignments);
    const branchId = await loadWarehouseBranchId(service as never, body.warehouseId);
    const postingDate = toDateOnly(new Date().toISOString());
    const rows = [];

    for (const line of body.items) {
      const { data: balance, error } = await service
        .from('stock_balances')
        .select('quantity_on_hand, avg_cost, average_cost, items(item_type, unit_cost, item_categories(name))')
        .eq('item_id', line.itemId)
        .eq('warehouse_id', body.warehouseId)
        .maybeSingle();

      if (error) return serverError(error.message);

      const systemQuantity = Number(balance?.quantity_on_hand ?? 0);
      const countedQuantity = Number(line.physicalQuantity);
      const variance = countedQuantity - systemQuantity;
      const item = Array.isArray(balance?.items) ? balance.items[0] : balance?.items;
      const category = item && typeof item === 'object'
        ? Array.isArray((item as Record<string, unknown>).item_categories)
          ? ((item as Record<string, unknown>).item_categories as Array<Record<string, unknown>>)[0]
          : (item as Record<string, unknown>).item_categories
        : null;
      const unitCost = Number(
        balance?.average_cost ??
          balance?.avg_cost ??
          (item && typeof item === 'object' ? (item as Record<string, unknown>).unit_cost : 0) ??
          0,
      );

      rows.push({
        countedQuantity,
        itemCategoryName: category && typeof category === 'object' ? String((category as Record<string, unknown>).name ?? '') : '',
        itemId: line.itemId,
        itemType: item && typeof item === 'object' ? String((item as Record<string, unknown>).item_type ?? '') : '',
        systemQuantity,
        unitCost,
        variance,
        varianceValue: variance * unitCost,
      });
    }

    const status = body.postVariances ? 'APPROVED' : 'DRAFT';
    const documentNumber = buildStockTakeNumber();
    const idempotencyKey = buildInventoryPostingIdempotencyKey({
      actorUserId: ctx.userId,
      documentId: `${body.warehouseId}:${documentNumber}`,
      operation: 'stock_take_post',
    });

    const { data: stockTake, error: stockTakeError } = await service
      .from('inventory_stock_takes')
      .insert({
        approved_at: body.postVariances ? new Date().toISOString() : null,
        approved_by: body.postVariances ? ctx.userId : null,
        branch_id: branchId,
        count_date: postingDate,
        created_by: ctx.userId,
        document_number: documentNumber,
        idempotency_key: idempotencyKey,
        notes: body.reason ?? null,
        organization_id: ctx.organizationId,
        posted_at: null,
        posted_by: null,
        reason: body.reason ?? 'Stock take variance',
        status,
        submitted_at: body.postVariances ? new Date().toISOString() : null,
        submitted_by: body.postVariances ? ctx.userId : null,
        warehouse_id: body.warehouseId,
      })
      .select('id, document_number, status')
      .single();

    if (stockTakeError || !stockTake) {
      return serverError(stockTakeError?.message ?? 'Failed to create stock take.');
    }

    const { error: linesError } = await service
      .from('inventory_stock_take_items')
      .insert(
        rows.map((row) => ({
          counted_quantity: row.countedQuantity,
          expiry_date: null,
          item_id: row.itemId,
          reason: body.reason ?? 'Stock take variance',
          stock_take_id: stockTake.id,
          system_quantity: row.systemQuantity,
          unit_cost: row.unitCost,
          variance_quantity: row.variance,
          variance_value: row.varianceValue,
        })),
      );

    if (linesError) {
      return serverError(linesError.message);
    }

    if (!body.postVariances) {
      return NextResponse.json(
        {
          items: rows,
          posted: false,
          stockTakeId: stockTake.id,
          stockTakeNumber: stockTake.document_number,
          status: stockTake.status,
          warehouseId: body.warehouseId,
        },
        { status: 201 },
      );
    }

    const period = await findOpenFiscalPeriod(ctx.organizationId, postingDate);
    if (!period) {
      return badRequest(`No open fiscal period exists for ${postingDate}.`);
    }

    const costCenterCode = await resolveFinanceCostCentreCode(ctx.organizationId, {
      branchId,
      preferredCodes: getFinanceModuleDefaultCostCentreCodes('inventory'),
    });
    const financeLines = collapseFinancePostingLines(
      (await Promise.all(rows.flatMap(async (row) => {
        if (row.variance === 0) return [];

        const mappingKey = resolveInventoryPostingMappingKey({
          itemCategoryName: row.itemCategoryName,
          itemType: row.itemType,
        });
        const inventoryAccount = await resolveFinancePostingAccount(ctx.organizationId, mappingKey, {
          branchId,
          fallbackAccountCode: mappingKey === 'PACKAGING_INVENTORY' ? '1217' : '1210',
          transactionType: 'STOCK_TAKE',
        });
        const varianceAccount = await resolveFinancePostingAccount(ctx.organizationId, 'INVENTORY_VARIANCE', {
          branchId,
          fallbackAccountCode: '1270',
          transactionType: 'STOCK_TAKE',
        });
        const amount = Math.abs(row.variance) * row.unitCost;

        if (row.variance > 0) {
          return [
            {
              accountId: inventoryAccount.id,
              branchId,
              costCenterCode,
              creditAmount: 0,
              debitAmount: amount,
              description: `Stock take gain for item ${row.itemId}`,
            },
            {
              accountId: varianceAccount.id,
              branchId,
              costCenterCode,
              creditAmount: amount,
              debitAmount: 0,
              description: `Stock take gain offset for item ${row.itemId}`,
            },
          ];
        }

        return [
          {
            accountId: varianceAccount.id,
            branchId,
            costCenterCode,
            creditAmount: 0,
            debitAmount: amount,
            description: `Stock take loss for item ${row.itemId}`,
          },
          {
            accountId: inventoryAccount.id,
            branchId,
            costCenterCode,
            creditAmount: amount,
            debitAmount: 0,
            description: `Stock take loss offset for item ${row.itemId}`,
          },
        ];
      }))).flat(),
    );

    if (financeLines.length === 0) {
      const { error: noVariancePostError } = await service
        .from('inventory_stock_takes')
        .update({
          posted_at: new Date().toISOString(),
          posted_by: ctx.userId,
          status: 'POSTED',
        })
        .eq('id', stockTake.id);

      if (noVariancePostError) {
        return serverError(noVariancePostError.message);
      }

      return NextResponse.json(
        {
          items: rows,
          journal: null,
          posted: true,
          stockTakeId: stockTake.id,
          stockTakeNumber: stockTake.document_number,
          status: 'POSTED',
          warehouseId: body.warehouseId,
        },
        { status: 201 },
      );
    }

    const postingResult = await invokeInventoryPostingRpc<{
      journal: { entryNumber: string; id: string };
      movementIds: string[];
      status: string;
      stockTakeId: string;
      success: boolean;
    }>(service as never, 'post_inventory_stock_take_atomic', {
      p_actor_user_id: ctx.userId,
      p_branch_id: branchId,
      p_cost_center_code: costCenterCode,
      p_finance_lines: financeLines,
      p_idempotency_key: idempotencyKey,
      p_journal_date: postingDate,
      p_organization_id: ctx.organizationId,
      p_stock_take_id: stockTake.id,
    });

    return NextResponse.json(
      {
        ...postingResult,
        fiscalPeriodId: String(period.id ?? ''),
        items: rows,
        posted: true,
        stockTakeNumber: stockTake.document_number,
        warehouseId: body.warehouseId,
      },
      { status: 201 },
    );
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to complete stock take');
  }
}
