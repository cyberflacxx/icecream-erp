import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, loadLedgerLines } from '@/lib/finance-server';
import { summarizeProfitAndLossFromLedger } from '@/lib/finance';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.report.view', 'finance.read', 'reports.read')) return forbidden();

  try {
    return NextResponse.json(summarizeProfitAndLossFromLedger(await loadLedgerLines(ctx.organizationId)));
  } catch (err) {
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}
