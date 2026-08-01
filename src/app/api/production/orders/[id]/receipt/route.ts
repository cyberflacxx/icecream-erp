import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import {
  findOpenFiscalPeriod,
  getFinanceModuleDefaultCostCentreCodes,
  resolveFinanceCostCentreCode,
  resolveFinancePostingAccount,
} from '@/lib/finance-foundation-server';
import { collapseFinancePostingLines, resolveProductionCostCentrePriority, toDateOnly } from '@/lib/finance-integration';
import { postFinanceDocument } from '@/lib/finance-server';
import { ensureNonNegative } from '@/lib/inventory';
import { mapProductionRpcError, postProductionReceipt, reverseProductionReceipt } from '@/lib/production-orders-server';
import { isProductionDocumentDateInFuture } from '@/lib/production';
import { authorizeProductionOrderWriteAccess } from '@/lib/production-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_receipt.post')) return forbidden();

  try {
    const { id } = await params;
    const authorization = await authorizeProductionOrderWriteAccess(id, ctx);
    if (!authorization.ok) {
      return NextResponse.json({ error: authorization.message }, { status: authorization.status });
    }
    const body = await request.json() as {
      batchNumber?: string | null;
      completedQuantity?: number;
      expiryDate?: string | null;
      idempotencyKey?: string | null;
      productionDate?: string | null;
      receiptDate?: string | null;
      rejectedQuantity?: number;
      remarks?: string | null;
      wastageQuantity?: number;
    };
    const completedQuantity = ensureNonNegative(body.completedQuantity ?? 0, 'completedQuantity');
    const rejectedQuantity = ensureNonNegative(body.rejectedQuantity ?? 0, 'rejectedQuantity');
    const wastageQuantity = ensureNonNegative(body.wastageQuantity ?? 0, 'wastageQuantity');
    if (isProductionDocumentDateInFuture(body.receiptDate ?? null)) {
      return badRequest('receiptDate cannot be in the future.');
    }
    if (completedQuantity + rejectedQuantity + wastageQuantity <= 0) {
      return badRequest('Receipt must include completed, rejected, or wastage quantity.');
    }

    const result = await postProductionReceipt({
      batchNumber: body.batchNumber ?? null,
      completedQuantity,
      expiryDate: body.expiryDate ?? null,
      idempotencyKey: body.idempotencyKey ?? request.headers.get('idempotency-key'),
      orderId: id,
      productionDate: body.productionDate ?? null,
      receiptDate: body.receiptDate ?? null,
      rejectedQuantity,
      remarks: body.remarks ?? null,
      wastageQuantity,
    }, ctx);
    if (result.success === false || !result.productionReceiptId) {
      return NextResponse.json(result, { status: result.success === false && result.code === 'CONFLICT' ? 409 : 200 });
    }

    const service = createServiceRoleClient();
    const receiptResult = await service
      .schema('icecream_erp')
      .from('production_receipts')
      .select('id, receipt_number, receipt_date, branch_id, total_cost')
      .eq('organization_id', ctx.organizationId)
      .eq('id', String(result.productionReceiptId))
      .single();
    if (receiptResult.error || !receiptResult.data) {
      throw receiptResult.error ?? new Error('Posted production receipt could not be loaded for finance integration.');
    }
    const receiptLinesResult = await service
      .schema('icecream_erp')
      .from('production_receipt_lines')
      .select('finished_product_id, current_completed_quantity, current_rejected_quantity, current_wastage_quantity, unit_production_cost, total_production_cost')
      .eq('organization_id', ctx.organizationId)
      .eq('production_receipt_id', String(result.productionReceiptId));
    if (receiptLinesResult.error) {
      throw receiptLinesResult.error;
    }

    try {
      const postingDate = toDateOnly(String(receiptResult.data.receipt_date ?? body.receiptDate ?? ''));
      const period = await findOpenFiscalPeriod(ctx.organizationId, postingDate);
      if (!period) {
        throw new Error(`No open fiscal period exists for ${postingDate}.`);
      }

      const branchId = receiptResult.data.branch_id ? String(receiptResult.data.branch_id) : null;
      const costCenterCode = await resolveFinanceCostCentreCode(ctx.organizationId, {
        branchId,
        preferredCodes: [
          ...resolveProductionCostCentrePriority(null),
          ...getFinanceModuleDefaultCostCentreCodes('production'),
        ],
      });
      const finishedGoodsAccount = await resolveFinancePostingAccount(ctx.organizationId, 'FINISHED_GOODS_INVENTORY', {
        branchId,
        fallbackAccountCode: '1240',
        transactionType: 'PRODUCTION_RECEIPT',
      });
      const wipAccount = await resolveFinancePostingAccount(ctx.organizationId, 'WORK_IN_PROGRESS', {
        branchId,
        fallbackAccountCode: '1230',
        transactionType: 'PRODUCTION_RECEIPT',
      });
      const writeOffAccount = await resolveFinancePostingAccount(ctx.organizationId, 'INVENTORY_WRITE_OFF', {
        branchId,
        fallbackAccountCode: '5090',
        transactionType: 'PRODUCTION_WASTAGE',
      });
      const varianceAccount = await resolveFinancePostingAccount(ctx.organizationId, 'PRODUCTION_VARIANCE', {
        branchId,
        fallbackAccountCode: '5100',
        transactionType: 'PRODUCTION_VARIANCE',
      });

      const financeLines = collapseFinancePostingLines((receiptLinesResult.data ?? []).flatMap((line) => {
        const completedAmount = Number(line.current_completed_quantity ?? 0) * Number(line.unit_production_cost ?? 0);
        const rejectedAmount = Number(line.current_rejected_quantity ?? 0) * Number(line.unit_production_cost ?? 0);
        const wastageAmount = Number(line.current_wastage_quantity ?? 0) * Number(line.unit_production_cost ?? 0);
        const totalProductionCost = Number(line.total_production_cost ?? completedAmount + rejectedAmount + wastageAmount);
        const residualVariance = totalProductionCost - completedAmount - rejectedAmount - wastageAmount;
        const lines: Array<{
          accountId: string;
          branchId?: string | null;
          costCenterCode?: string | null;
          creditAmount: number;
          debitAmount: number;
          description?: string | null;
        }> = [
          {
            accountId: wipAccount.id,
            branchId,
            costCenterCode,
            creditAmount: totalProductionCost,
            debitAmount: 0,
            description: `Clear WIP for production receipt ${String(receiptResult.data.receipt_number ?? result.productionReceiptId)}`,
          },
        ];

        if (completedAmount > 0) {
          lines.push({
            accountId: finishedGoodsAccount.id,
            branchId,
            costCenterCode,
            creditAmount: 0,
            debitAmount: completedAmount,
            description: `Finished goods receipt ${String(line.finished_product_id ?? '')}`,
          });
        }
        if (rejectedAmount + wastageAmount > 0) {
          lines.push({
            accountId: writeOffAccount.id,
            branchId,
            costCenterCode,
            creditAmount: 0,
            debitAmount: rejectedAmount + wastageAmount,
            description: `Production wastage for receipt ${String(receiptResult.data.receipt_number ?? result.productionReceiptId)}`,
          });
        }
        if (residualVariance > 0) {
          lines.push({
            accountId: varianceAccount.id,
            branchId,
            costCenterCode,
            creditAmount: 0,
            debitAmount: residualVariance,
            description: `Production variance for receipt ${String(receiptResult.data.receipt_number ?? result.productionReceiptId)}`,
          });
        } else if (residualVariance < 0) {
          lines.push({
            accountId: varianceAccount.id,
            branchId,
            costCenterCode,
            creditAmount: Math.abs(residualVariance),
            debitAmount: 0,
            description: `Production variance for receipt ${String(receiptResult.data.receipt_number ?? result.productionReceiptId)}`,
          });
        }
        return lines;
      }));

      const journal = await postFinanceDocument({
        branchId,
        costCenterCode,
        createdBy: ctx.userId,
        description: `Production receipt ${String(receiptResult.data.receipt_number ?? result.productionReceiptId)}`,
        journalDate: postingDate,
        lines: financeLines,
        organizationId: ctx.organizationId,
        sourceDocumentId: String(result.productionReceiptId),
        sourceDocumentType: 'production_receipt',
        sourceModule: 'production',
      });

      return NextResponse.json({ ...result, fiscalPeriodId: String(period.id ?? ''), journal }, { status: 200 });
    } catch (postingError) {
      await reverseProductionReceipt({
        reason: `Finance posting failed: ${postingError instanceof Error ? postingError.message : 'unknown error'}`,
        receiptId: String(result.productionReceiptId),
      }, ctx).catch(() => null);
      throw postingError;
    }
  } catch (err) {
    const mapped = mapProductionRpcError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
