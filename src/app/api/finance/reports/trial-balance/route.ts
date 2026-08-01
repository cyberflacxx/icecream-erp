import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { summarizeDetailedTrialBalance } from '@/lib/finance';
import { financeErrorMessage, loadLedgerLines } from '@/lib/finance-server';

function previousDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.report.view', 'finance.read', 'reports.read')) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;
    const requestedBranchId = searchParams.get('branchId') ?? undefined;
    const branchId = ctx.isBranchScoped && ctx.branchId ? ctx.branchId : requestedBranchId;
    const costCenterCode = searchParams.get('costCenterCode') ?? undefined;
    const periodLines = (await loadLedgerLines(ctx.organizationId, true, {
      branchId,
      costCenterCode,
      endDate,
      startDate,
    })).map((row) => ({
      accountCode: row.accountCode || 'UNKNOWN',
      accountName: row.accountName || 'Unknown account',
      creditAmount: row.creditAmount,
      debitAmount: row.debitAmount,
    }));
    const openingLines = startDate
      ? (await loadLedgerLines(ctx.organizationId, true, {
          branchId,
          costCenterCode,
          endDate: previousDate(startDate),
        })).map((row) => ({
          accountCode: row.accountCode || 'UNKNOWN',
          accountName: row.accountName || 'Unknown account',
          creditAmount: row.creditAmount,
          debitAmount: row.debitAmount,
        }))
      : [];
    const summary = summarizeDetailedTrialBalance({ openingLines, periodLines });

    return NextResponse.json({
      ...summary,
      filters: {
        branchId: branchId ?? null,
        costCenterCode: costCenterCode ?? null,
        endDate: endDate ?? null,
        startDate: startDate ?? null,
      },
      isBalanced: Math.abs(summary.totals.closingDebit - summary.totals.closingCredit) <= 0.01,
    });
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
