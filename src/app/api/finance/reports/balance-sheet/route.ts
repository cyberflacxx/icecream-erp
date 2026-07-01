import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { summarizeBalanceSheetFromLedger } from '@/lib/finance';
import { financeErrorMessage, loadLedgerLines } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.report.view', 'finance.read', 'reports.read')) return forbidden();

  try {
    const totals = summarizeBalanceSheetFromLedger(await loadLedgerLines(ctx.organizationId));
    return NextResponse.json(totals);
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
