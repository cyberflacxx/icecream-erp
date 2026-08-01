import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, unauthorized } from '@/lib/api-auth';
import { findJournalBySource, loadLedgerLines, postFinanceDocument } from '@/lib/finance-server';
import { mapProductionRpcError, reverseProductionReceipt } from '@/lib/production-orders-server';
import {
  authorizeProductionOrderWriteAccess,
  loadProductionReceiptAuthorizationRecord,
} from '@/lib/production-server';

function parseReason(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_receipt.reverse')) return forbidden();

  try {
    const { id, receiptId } = await params;
    const authorization = await authorizeProductionOrderWriteAccess(id, ctx);
    if (!authorization.ok) {
      return NextResponse.json({ error: authorization.message }, { status: authorization.status });
    }

    const receipt = await loadProductionReceiptAuthorizationRecord(receiptId, ctx.organizationId);
    if (!receipt || receipt.organizationId !== ctx.organizationId || receipt.productionOrderId !== id) {
      return notFound('Production receipt not found.');
    }

    const body = await request.json().catch(() => ({})) as { reason?: string | null; reversalReason?: string | null };
    const reason = parseReason(body.reason ?? body.reversalReason);
    if (!reason) {
      return badRequest('Reversal reason is required.');
    }

    const result = await reverseProductionReceipt({ reason, receiptId }, ctx);
    if (result.success !== false) {
      const sourceJournal = await findJournalBySource(ctx.organizationId, 'production', 'production_receipt', receiptId);
      if (sourceJournal) {
        const sourceLines = (await loadLedgerLines(ctx.organizationId, true)).filter((line) => line.journalId === sourceJournal.id);
        if (sourceLines.length > 0) {
          const reversalJournal = await postFinanceDocument({
            branchId: sourceLines[0]?.branchId ?? null,
            costCenterCode: sourceLines[0]?.costCenterCode ?? null,
            createdBy: ctx.userId,
            description: `Production receipt reversal ${receiptId}`,
            journalDate: new Date().toISOString().slice(0, 10),
            lines: sourceLines.map((line) => ({
              accountId: line.accountId,
              branchId: line.branchId,
              costCenterCode: line.costCenterCode,
              creditAmount: line.debitAmount,
              debitAmount: line.creditAmount,
              description: line.description,
            })),
            organizationId: ctx.organizationId,
            sourceDocumentId: receiptId,
            sourceDocumentType: 'production_receipt_reversal',
            sourceModule: 'production',
          });
          return NextResponse.json({ ...result, journal: reversalJournal }, { status: result.success === false && result.code === 'CONFLICT' ? 409 : 200 });
        }
      }
    }
    return NextResponse.json(result, { status: result.success === false && result.code === 'CONFLICT' ? 409 : 200 });
  } catch (err) {
    const mapped = mapProductionRpcError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
