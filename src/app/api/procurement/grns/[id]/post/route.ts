import { NextRequest, NextResponse } from 'next/server';

import {
  badRequest,
  can,
  forbidden,
  getAuthContext,
  serverError,
  unauthorized,
} from '@/lib/api-auth';
import {
  findOpenFiscalPeriod,
  getFinanceModuleDefaultCostCentreCodes,
  resolveFinanceCostCentreCode,
  resolveFinancePostingAccount,
} from '@/lib/finance-foundation-server';
import { collapseFinancePostingLines, resolveInventoryPostingMappingKey, toDateOnly } from '@/lib/finance-integration';
import { isWarehouseAvailableToContext } from '@/lib/branch-access';
import { buildInventoryPostingIdempotencyKey, invokeInventoryPostingRpc } from '@/lib/inventory-posting-server';
import { fetchGoodsReceivedNoteDetail, isGrnStockPostingError } from '@/lib/procurement-goods-received';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

function isFinanceConfigurationError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.startsWith('no active cost centre mapping is configured') ||
    normalized.startsWith('cost centre ') ||
    normalized.startsWith('missing active account mapping for') ||
    normalized.startsWith('fallback account ') ||
    normalized.endsWith('is a header account and cannot receive postings.') ||
    normalized.endsWith('is inactive.')
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.post', 'procurement.grn.post', 'inventory.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: existing, error: existingError } = await service
      .from('goods_received_notes')
      .select('id, status, quality_status, stock_posted, warehouse_id, grn_number, received_date, created_at, supplier_id, purchase_order_id')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .maybeSingle();

    if (existingError) return serverError(existingError.message);
    if (!existing) {
      return badRequest('Goods received note not found.');
    }

    const { data: warehouse, error: warehouseError } = await service
      .from('warehouses')
      .select('id, organization_id, branch_id, is_active, name')
      .eq('id', String(existing.warehouse_id ?? ''))
      .maybeSingle();
    if (warehouseError) return serverError(warehouseError.message);
    if (
      !isWarehouseAvailableToContext(ctx, warehouse
        ? {
            branchId: warehouse.branch_id ? String(warehouse.branch_id) : null,
            id: String(warehouse.id),
            isActive: warehouse.is_active !== false,
            name: warehouse.name ? String(warehouse.name) : null,
            organizationId: String(warehouse.organization_id ?? ''),
          }
        : null)
    ) {
      return forbidden();
    }

    if (existing.stock_posted === true || String(existing.status ?? '').trim().toUpperCase() === 'POSTED') {
      return badRequest('Goods Received Note has already been posted.');
    }
    if (String(existing.status ?? '').trim().toUpperCase() === 'REJECTED' || String(existing.quality_status ?? '').trim().toUpperCase() === 'REJECTED') {
      return badRequest('Rejected Goods Received Notes cannot be posted.');
    }
    if (String(existing.quality_status ?? '').trim().toUpperCase() !== 'APPROVED') {
      return badRequest('Goods Received Note must be approved before posting.');
    }

    const grnDetail = await fetchGoodsReceivedNoteDetail(service, {
      grnId: id,
      organizationId: ctx.organizationId,
    });
    const postingDate = toDateOnly(
      String(
        existing.received_date ??
          grnDetail.received_date ??
          grnDetail.created_at ??
          '',
      ),
    );
    const period = await findOpenFiscalPeriod(ctx.organizationId, postingDate);
    if (!period) {
      return badRequest(`No open fiscal period exists for ${postingDate}.`);
    }

    const branchId = warehouse?.branch_id ? String(warehouse.branch_id) : null;
    const costCenterCode = await resolveFinanceCostCentreCode(ctx.organizationId, {
      branchId,
      preferredCodes: getFinanceModuleDefaultCostCentreCodes('procurement'),
    });
    const itemIds = [
      ...new Set(
        (Array.isArray(grnDetail.items) ? grnDetail.items : [])
          .map((line) => String((line as Record<string, unknown>).item_id ?? (line as Record<string, unknown>).itemId ?? '').trim())
          .filter(Boolean),
      ),
    ];
    const itemsResult = itemIds.length > 0
      ? await service
          .from('items')
          .select('id, item_type, item_category_id, item_categories(name)')
          .in('id', itemIds)
      : { data: [], error: null };
    if (itemsResult.error) {
      return serverError(itemsResult.error.message);
    }
    const itemMeta = new Map(
      ((itemsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => {
        const category = Array.isArray(row.item_categories) ? row.item_categories[0] : row.item_categories;
        return [
          String(row.id ?? ''),
          {
            itemCategoryName: category && typeof category === 'object' ? String((category as Record<string, unknown>).name ?? '') : '',
            itemType: String(row.item_type ?? ''),
          },
        ] as const;
      }),
    );

    const payableAccount = await resolveFinancePostingAccount(ctx.organizationId, 'SUPPLIER_PAYABLES', {
      branchId,
      fallbackAccountCode: '2110',
      transactionType: 'GRN_POSTING',
    });
    const rawLines = Array.isArray(grnDetail.items) ? grnDetail.items : [];
    const debitLines = await Promise.all(rawLines.map(async (line) => {
      const row = line as Record<string, unknown>;
      const itemId = String(row.item_id ?? row.itemId ?? '').trim();
      const quantity = Number(row.quantity_received ?? row.receivedQuantity ?? row.quantityReceived ?? row.quantity ?? 0);
      const unitCost = Number(row.unit_cost ?? row.unitCost ?? 0);
      const amount = quantity * unitCost;
      if (!itemId || amount <= 0) {
        return null;
      }
      const meta = itemMeta.get(itemId);
      const mappingKey = resolveInventoryPostingMappingKey({
        itemCategoryName: meta?.itemCategoryName ?? null,
        itemType: meta?.itemType ?? null,
      });
      const inventoryAccount = await resolveFinancePostingAccount(ctx.organizationId, mappingKey, {
        branchId,
        fallbackAccountCode:
          mappingKey === 'PACKAGING_INVENTORY'
            ? '1217'
            : mappingKey === 'FINISHED_GOODS_INVENTORY'
              ? '1240'
              : '1210',
        transactionType: 'GRN_POSTING',
      });
      return {
        accountId: inventoryAccount.id,
        branchId,
        costCenterCode,
        creditAmount: 0,
        debitAmount: amount,
        description: `GRN inventory receipt for item ${itemId}`,
      };
    }));
    const financeLines = collapseFinancePostingLines([
      ...debitLines.filter(Boolean) as Array<{
        accountId: string;
        branchId?: string | null;
        costCenterCode?: string | null;
        creditAmount: number;
        debitAmount: number;
        description?: string | null;
      }>,
      {
        accountId: payableAccount.id,
        branchId,
        costCenterCode,
        creditAmount: debitLines.reduce((sum, line) => sum + Number(line?.debitAmount ?? 0), 0),
        debitAmount: 0,
        description: `Supplier payable for GRN ${String(existing.grn_number ?? id)}`,
      },
    ]);
    if (financeLines.length < 2) {
      return badRequest('Goods Received Note has no valuated lines to post.');
    }

    const postingResult = await invokeInventoryPostingRpc<{
      grnId: string;
      inventoryValuePosted: number;
      journal: { entryNumber: string; id: string; totalCredit?: number; totalDebit?: number };
      movementIds: string[];
      status: string;
      success: boolean;
    }>(service as never, 'post_goods_received_note_atomic', {
      p_branch_id: branchId,
      p_cost_center_code: costCenterCode,
      p_finance_lines: financeLines,
      p_grn_id: id,
      p_idempotency_key: buildInventoryPostingIdempotencyKey({
        actorUserId: ctx.userId,
        documentId: id,
        operation: 'goods_received_note_post',
      }),
      p_journal_date: postingDate,
      p_journal_description: `GRN ${String(existing.grn_number ?? id)} receipt posting`,
      p_organization_id: ctx.organizationId,
      p_actor_user_id: ctx.userId,
    });

    await recordAuditLog({
      action: 'GRN_POSTED_TO_STOCK',
      entityId: id,
      entityType: 'goods_received_note',
      newValues: {
        inventoryValuePosted: postingResult.inventoryValuePosted,
        journalEntryId: postingResult.journal.id,
        journalNumber: postingResult.journal.entryNumber,
        movementIds: postingResult.movementIds,
        postingDate,
        status: postingResult.status,
      },
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ ...postingResult, fiscalPeriodId: String(period.id ?? '') });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to post GRN.';
    const details = isGrnStockPostingError(error) ? error.details : undefined;
    if (isFinanceConfigurationError(message)) {
      return NextResponse.json({
        success: false,
        message,
        code: 'GRN_FINANCE_CONFIGURATION_REQUIRED',
        details,
      }, { status: 400 });
    }
    if (message === 'Please select a receiving warehouse before posting GRN.') {
      return NextResponse.json({
        success: false,
        message,
        code: 'GRN_STOCK_POST_FAILED',
        details,
      }, { status: 400 });
    }
    console.error('GRN post failed.', {
      details,
      grnId: id,
      message,
    });
    return NextResponse.json({
      success: false,
      message: 'Goods received note could not update inventory. Please check warehouse and item details.',
      code: 'GRN_STOCK_POST_FAILED',
      details,
    }, { status: 500 });
  }
}
