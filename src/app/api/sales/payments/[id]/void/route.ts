import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesErrorMessage } from '@/lib/sales-server';
import { voidSalesPaymentTransaction } from '@/lib/sales-transactions-server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { reason?: unknown };
  const reason = String(body.reason ?? '').trim();
  if (!id || !reason) return badRequest('A receipt void reason is required.');

  try {
    const result = await voidSalesPaymentTransaction({ paymentId: id, reason }, ctx);
    return NextResponse.json(result);
  } catch (error) {
    return serverError(salesErrorMessage(error) || 'Failed to void customer receipt.');
  }
}
