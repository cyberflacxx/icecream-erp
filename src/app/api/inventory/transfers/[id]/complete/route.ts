import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import {
  findOpenFiscalPeriod,
  getFinanceModuleDefaultCostCentreCodes,
  resolveFinanceCostCentreCode,
  resolveFinancePostingAccount,
} from '@/lib/finance-foundation-server';
import { toDateOnly } from '@/lib/finance-integration';
import {
  buildInventoryPostingIdempotencyKey,
  invokeInventoryPostingRpc,
  loadWarehouseBranchId,
} from '@/lib/inventory-posting-server';
import { normalizeTransferStatus } from '@/lib/inventory';
import { requireWarehouseAccess } from '@/lib/inventory-server';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

type TransferItemRow = {
  id: string;
  item_id: string;
  quantity_received: number | null;
  quantity_requested: number | null;
  quantity_sent: number | null;
  unit_cost: number | null;
};

function toTransferQuantity(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'inventory.transfer.complete', 'inventory.write', 'stock_transfer.approve')) return forbidden();

  const body = (await request.json().catch(() => ({}))) as {
    receiptLines?: Array<{ quantityReceived?: number; transferItemId?: string }>;
  };

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: transfer, error: transferError } = await service
      .from('stock_transfers')
      .select('id, transfer_number, status, notes, from_warehouse_id, to_warehouse_id')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .maybeSingle();

    if (transferError) return serverError(transferError.message);
    if (!transfer) return notFound('Stock transfer not found.');

    const normalizedStatus = normalizeTransferStatus(String(transfer.status ?? ''));
    if (normalizedStatus === 'COMPLETED') {
      return badRequest('This transfer has already been completed.');
    }
    if (normalizedStatus === 'CANCELLED') {
      return badRequest('Cancelled transfers cannot be completed.');
    }

    await Promise.all([
      requireWarehouseAccess(
        service,
        String(transfer.from_warehouse_id),
        ctx.branchId,
        ctx.isBranchScoped,
        ctx.warehouseAssignments,
      ),
      requireWarehouseAccess(
        service,
        String(transfer.to_warehouse_id),
        ctx.branchId,
        ctx.isBranchScoped,
        ctx.warehouseAssignments,
      ),
    ]);

    const { data: transferItems, error: transferItemsError } = await service
      .from('stock_transfer_items')
      .select('id, item_id, quantity_requested, quantity_sent, quantity_received, unit_cost')
      .eq('transfer_id', id);
    if (transferItemsError) return serverError(transferItemsError.message);
    if ((transferItems ?? []).length === 0) return badRequest('Transfer has no items.');

    const sourceBranchId = await loadWarehouseBranchId(service as never, String(transfer.from_warehouse_id));
    const destinationBranchId = await loadWarehouseBranchId(service as never, String(transfer.to_warehouse_id));
    const postingDate = toDateOnly(new Date().toISOString());
    const period = await findOpenFiscalPeriod(ctx.organizationId, postingDate);
    if (!period) {
      return badRequest(`No open fiscal period exists for ${postingDate}.`);
    }

    const [goodsInTransitAccount, branchInventoryAccount, sourceCostCenterCode, destinationCostCenterCode] = await Promise.all([
      resolveFinancePostingAccount(ctx.organizationId, 'GOODS_IN_TRANSIT', {
        branchId: sourceBranchId,
        fallbackAccountCode: '1260',
        transactionType: 'BRANCH_TRANSFER',
      }),
      resolveFinancePostingAccount(ctx.organizationId, 'BRANCH_INVENTORY', {
        branchId: destinationBranchId,
        fallbackAccountCode: '1250',
        transactionType: 'BRANCH_TRANSFER',
      }),
      resolveFinanceCostCentreCode(ctx.organizationId, {
        branchId: sourceBranchId,
        preferredCodes: getFinanceModuleDefaultCostCentreCodes('inventory'),
      }),
      resolveFinanceCostCentreCode(ctx.organizationId, {
        branchId: destinationBranchId,
        preferredCodes: getFinanceModuleDefaultCostCentreCodes('inventory'),
      }),
    ]);

    let dispatchResult: null | {
      journal: { entryNumber: string; id: string };
      movementIds: string[];
      status: string;
      transferId: string;
    } = null;

    if (normalizedStatus === 'APPROVED' || normalizedStatus === 'DRAFT') {
      const dispatchValue = (transferItems ?? []).reduce(
        (sum, row) => sum + (toTransferQuantity(row.quantity_requested) * toTransferQuantity(row.unit_cost)),
        0,
      );
      dispatchResult = await invokeInventoryPostingRpc<{
        journal: { entryNumber: string; id: string };
        movementIds: string[];
        status: string;
        transferId: string;
      }>(service as never, 'dispatch_stock_transfer_atomic', {
        p_actor_user_id: ctx.userId,
        p_branch_id: sourceBranchId,
        p_cost_center_code: sourceCostCenterCode,
        p_finance_lines: [
          {
            accountId: goodsInTransitAccount.id,
            branchId: sourceBranchId,
            costCenterCode: sourceCostCenterCode,
            creditAmount: 0,
            debitAmount: dispatchValue,
            description: `Goods in transit dispatch for transfer ${String(transfer.transfer_number ?? id)}`,
          },
          {
            accountId: branchInventoryAccount.id,
            branchId: sourceBranchId,
            costCenterCode: sourceCostCenterCode,
            creditAmount: dispatchValue,
            debitAmount: 0,
            description: `Source inventory dispatch for transfer ${String(transfer.transfer_number ?? id)}`,
          },
        ],
        p_idempotency_key: buildInventoryPostingIdempotencyKey({
          actorUserId: ctx.userId,
          documentId: id,
          operation: 'stock_transfer_dispatch',
        }),
        p_journal_date: postingDate,
        p_organization_id: ctx.organizationId,
        p_transfer_id: id,
      });
    }

    const latestStatus = dispatchResult?.status ?? normalizedStatus;
    if (!['IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(latestStatus)) {
      return badRequest('Transfer is not ready for receipt posting.');
    }

    const transferItemsById = new Map(
      ((transferItems ?? []) as TransferItemRow[]).map((row) => [String(row.id), row] as const),
    );
    const requestedReceiptLines = (body.receiptLines ?? [])
      .map((line) => ({
        quantityReceived: toTransferQuantity(line.quantityReceived),
        transferItemId: String(line.transferItemId ?? ''),
      }))
      .filter((line) => line.transferItemId && line.quantityReceived > 0);

    const receiptLines = (requestedReceiptLines.length > 0
      ? requestedReceiptLines
      : ((transferItems ?? []) as TransferItemRow[]).map((row) => ({
          quantityReceived: Math.max(
            0,
            (toTransferQuantity(row.quantity_sent) || toTransferQuantity(row.quantity_requested)) -
              toTransferQuantity(row.quantity_received),
          ),
          transferItemId: String(row.id),
        }))
    ).filter((line) => line.quantityReceived > 0);

    if (receiptLines.length === 0) {
      return badRequest('No remaining in-transit quantity is available for receipt.');
    }

    let receiptValue = 0;
    for (const line of receiptLines) {
      const transferItem = transferItemsById.get(line.transferItemId);
      if (!transferItem) {
        return badRequest('Receipt line references an invalid transfer item.');
      }
      const quantitySent = toTransferQuantity(transferItem.quantity_sent) || toTransferQuantity(transferItem.quantity_requested);
      const quantityReceived = toTransferQuantity(transferItem.quantity_received);
      const remainingQuantity = Math.max(0, quantitySent - quantityReceived);
      if (line.quantityReceived > remainingQuantity) {
        return badRequest('Receipt quantity exceeds the remaining in-transit quantity.');
      }
      receiptValue += line.quantityReceived * toTransferQuantity(transferItem.unit_cost);
    }

    const receiptResult = await invokeInventoryPostingRpc<{
      journal: { entryNumber: string; id: string };
      movementIds: string[];
      remainingInTransitQuantity: number;
      status: string;
      transferId: string;
    }>(service as never, 'receive_stock_transfer_atomic', {
      p_actor_user_id: ctx.userId,
      p_branch_id: destinationBranchId,
      p_cost_center_code: destinationCostCenterCode,
      p_finance_lines: [
        {
          accountId: branchInventoryAccount.id,
          branchId: destinationBranchId,
          costCenterCode: destinationCostCenterCode,
          creditAmount: 0,
          debitAmount: receiptValue,
          description: `Destination inventory receipt for transfer ${String(transfer.transfer_number ?? id)}`,
        },
        {
          accountId: goodsInTransitAccount.id,
          branchId: destinationBranchId,
          costCenterCode: destinationCostCenterCode,
          creditAmount: receiptValue,
          debitAmount: 0,
          description: `Goods in transit clearance for transfer ${String(transfer.transfer_number ?? id)}`,
        },
      ],
      p_idempotency_key: buildInventoryPostingIdempotencyKey({
        actorUserId: ctx.userId,
        documentId: id,
        operation: 'stock_transfer_receipt',
        suffix: receiptLines.map((line) => `${line.transferItemId}:${line.quantityReceived}`).join('|'),
      }),
      p_journal_date: postingDate,
      p_organization_id: ctx.organizationId,
      p_receipt_lines: receiptLines,
      p_transfer_id: id,
    });

    await recordAuditLog({
      action: receiptResult.status === 'COMPLETED' ? 'INVENTORY_TRANSFER_COMPLETED' : 'INVENTORY_TRANSFER_PARTIALLY_RECEIVED',
      entityId: id,
      entityType: 'stock_transfer',
      newValues: {
        dispatchJournalEntryId: dispatchResult?.journal.id ?? null,
        dispatchJournalNumber: dispatchResult?.journal.entryNumber ?? null,
        fiscalPeriodId: String(period.id ?? ''),
        receiptJournalEntryId: receiptResult.journal.id,
        receiptJournalNumber: receiptResult.journal.entryNumber,
        receiptLines,
        remainingInTransitQuantity: receiptResult.remainingInTransitQuantity,
        status: receiptResult.status,
        transferNumber: transfer.transfer_number,
      },
      organizationId: ctx.organizationId,
      userProfileId: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      dispatch: dispatchResult,
      fiscalPeriodId: String(period.id ?? ''),
      receipt: receiptResult,
      transferId: id,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to complete stock transfer.');
  }
}
