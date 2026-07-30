import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { ensurePositiveQuantity } from '@/lib/inventory';
import { mapProductionRpcError, releaseProductionOrder } from '@/lib/production-orders-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_order.release')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as { allowOverRelease?: boolean; releaseNotes?: string | null; releasedQuantity?: number };
    if (body.releasedQuantity === undefined) return badRequest('releasedQuantity is required.');
    const releasedQuantity = ensurePositiveQuantity(body.releasedQuantity, 'releasedQuantity');
    const result = await releaseProductionOrder({
      allowOverRelease: body.allowOverRelease ?? can(ctx, 'production.override.over_release', 'settings.manage'),
      orderId: id,
      releaseNotes: body.releaseNotes ?? null,
      releasedQuantity,
    }, ctx);
    return NextResponse.json(result);
  } catch (err) {
    const mapped = mapProductionRpcError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
