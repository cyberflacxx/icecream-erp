import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { summarizeTrialBalance } from '@/lib/finance';
import { financeErrorMessage, loadLedgerLines } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.report.view', 'finance.read', 'reports.read')) return forbidden();

  try {
    const lines = (await loadLedgerLines(ctx.organizationId)).map((row) => ({
      accountCode: row.accountCode || 'UNKNOWN',
      accountName: row.accountName || 'Unknown account',
      creditAmount: row.creditAmount,
      debitAmount: row.debitAmount,
    }));

    return NextResponse.json(summarizeTrialBalance(lines));
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
