import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { closeProductionOrder, mapProductionRpcError } from '@/lib/production-orders-server';
import { authorizeProductionOrderWriteAccess } from '@/lib/production-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_order.close')) return forbidden();

  try {
    const { id } = await params;
    const authorization = await authorizeProductionOrderWriteAccess(id, ctx);
    if (!authorization.ok) {
      return NextResponse.json({ error: authorization.message }, { status: authorization.status });
    }
    const body = await request.json().catch(() => ({})) as { closingNotes?: string | null };
    const result = await closeProductionOrder({ closingNotes: body.closingNotes ?? null, orderId: id }, ctx);
    return NextResponse.json(result);
  } catch (err) {
    const mapped = mapProductionRpcError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
