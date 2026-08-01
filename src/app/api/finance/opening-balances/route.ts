import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createFinanceOpeningBalanceDraft, listFinanceOpeningBalances } from '@/lib/finance-foundation-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const data = await listFinanceOpeningBalances(ctx.organizationId);
    return NextResponse.json({ data });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load opening balances.');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      accountId?: string;
      branchId?: string | null;
      costCenterCode?: string | null;
      creditAmount?: number;
      currencyCode?: string | null;
      debitAmount?: number;
      effectiveDate?: string | null;
      notes?: string | null;
      reference?: string | null;
    };

    if (!body.accountId) {
      return badRequest('accountId is required.');
    }

    const saved = await createFinanceOpeningBalanceDraft(ctx, {
      accountId: body.accountId,
      branchId: body.branchId ?? null,
      costCenterCode: body.costCenterCode ?? null,
      creditAmount: body.creditAmount ?? 0,
      currencyCode: body.currencyCode ?? 'USD',
      debitAmount: body.debitAmount ?? 0,
      effectiveDate: body.effectiveDate ?? null,
      notes: body.notes ?? null,
      reference: body.reference ?? null,
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create opening balance line.';
    if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('required')) {
      return badRequest(message);
    }
    return serverError(message);
  }
}
