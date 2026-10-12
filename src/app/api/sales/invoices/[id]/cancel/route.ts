import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { salesErrorMessage } from '@/lib/sales-server';
import { cancelSalesInvoiceTransaction } from '@/lib/sales-transactions-server';

function conflict(message: string) {
  return NextResponse.json({ error: message, success: false }, { status: 409 });
}

function mapCancellationError(error: unknown) {
  const message = salesErrorMessage(error) || (error instanceof Error ? error.message : 'Internal server error');
  if (
    message.includes('already been cancelled') ||
    message.includes('posted payments') ||
    message.includes('already exists') ||
    message.includes('missing linked') ||
    message.includes('cannot be cancelled safely')
  ) {
    return conflict(message);
  }
  if (message.includes('not found')) return badRequest(message);
  return serverError(message);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as { reason?: string };
    const reason = body.reason?.trim();
    if (!reason) return badRequest('Cancellation reason is required.');

    const result = await cancelSalesInvoiceTransaction({ invoiceId: id, reason }, ctx);
    return NextResponse.json(result);
  } catch (err) {
    return mapCancellationError(err);
  }
}
