import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, loadLedgerLines } from '@/lib/finance-server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.gl.view', 'finance.report.view', 'finance.read', 'reports.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get('branchId') ?? undefined;
    const branchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : requestedBranchId;
    const costCenterCode = searchParams.get('costCenterCode') ?? undefined;
    const accountCode = searchParams.get('accountCode') ?? undefined;
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;
    const rows = await loadLedgerLines(ctx.organizationId, true, {
      accountCode,
      branchId,
      costCenterCode,
      endDate,
      startDate,
    });
    return NextResponse.json(
      rows.map((row, index) => ({
        accountCode: row.accountCode,
        accountName: row.accountName,
        branchId: row.branchId,
        creditAmount: row.creditAmount,
        costCenterCode: row.costCenterCode,
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
