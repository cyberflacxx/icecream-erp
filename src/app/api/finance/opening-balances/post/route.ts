import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { postFinanceOpeningBalanceDrafts } from '@/lib/finance-foundation-server';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write', 'finance.gl.post')) return forbidden();

  try {
    const body = await request.json().catch(() => ({})) as { effectiveDate?: string | null };
    const result = await postFinanceOpeningBalanceDrafts(ctx, {
      effectiveDate: body.effectiveDate ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to post opening balances.';
    if (
      message.toLowerCase().includes('draft') ||
      message.toLowerCase().includes('balance') ||
      message.toLowerCase().includes('period')
    ) {
      return badRequest(message);
    }
    return serverError(message);
  }
}
