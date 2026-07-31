import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { mapProductionRpcError, reopenProductionOrder } from '@/lib/production-orders-server';
import { authorizeProductionOrderWriteAccess } from '@/lib/production-server';

function parseReason(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_order.reopen')) return forbidden();

  try {
    const { id } = await params;
    const authorization = await authorizeProductionOrderWriteAccess(id, ctx);
    if (!authorization.ok) {
      return NextResponse.json({ error: authorization.message }, { status: authorization.status });
    }
    if (authorization.value.status !== 'CLOSED') {
      return NextResponse.json({ error: 'Only CLOSED production orders can be reopened.' }, { status: 409 });
    }

    const body = await request.json().catch(() => ({})) as { reason?: string | null; reopenReason?: string | null };
    const reason = parseReason(body.reason ?? body.reopenReason);
    if (!reason) {
      return badRequest('Reopen reason is required.');
    }

    const result = await reopenProductionOrder({ orderId: id, reason }, ctx);
    return NextResponse.json(result, { status: result.success === false && result.code === 'CONFLICT' ? 409 : 200 });
  } catch (err) {
    const mapped = mapProductionRpcError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
