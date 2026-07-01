import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, loadLedgerLines } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.gl.view', 'finance.report.view', 'finance.read', 'reports.read')) return forbidden();

  try {
    const rows = await loadLedgerLines(ctx.organizationId);
    return NextResponse.json(
      rows.map((row, index) => ({
        accountCode: row.accountCode,
        accountName: row.accountName,
        creditAmount: row.creditAmount,
        debitAmount: row.debitAmount,
        description: row.description,
        entryDate: row.entryDate,
        entryNumber: row.entryNumber,
        id: `${row.journalId}:${index}`,
        sourceDocumentId: row.sourceDocumentId,
        sourceDocumentType: row.sourceDocumentType,
        sourceModule: row.sourceModule,
      })),
    );
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
