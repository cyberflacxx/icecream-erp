import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { ensureNonNegative } from '@/lib/inventory';
import { mapProductionRpcError, postProductionReceipt } from '@/lib/production-orders-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production_receipt.post')) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json() as {
      batchNumber?: string | null;
      completedQuantity?: number;
      expiryDate?: string | null;
      idempotencyKey?: string | null;
      productionDate?: string | null;
      receiptDate?: string | null;
      rejectedQuantity?: number;
      remarks?: string | null;
      wastageQuantity?: number;
    };
    const completedQuantity = ensureNonNegative(body.completedQuantity ?? 0, 'completedQuantity');
    const rejectedQuantity = ensureNonNegative(body.rejectedQuantity ?? 0, 'rejectedQuantity');
    const wastageQuantity = ensureNonNegative(body.wastageQuantity ?? 0, 'wastageQuantity');
    if (completedQuantity + rejectedQuantity + wastageQuantity <= 0) {
      return badRequest('Receipt must include completed, rejected, or wastage quantity.');
    }

    const result = await postProductionReceipt({
      batchNumber: body.batchNumber ?? null,
      completedQuantity,
      expiryDate: body.expiryDate ?? null,
      idempotencyKey: body.idempotencyKey ?? request.headers.get('idempotency-key'),
      orderId: id,
      productionDate: body.productionDate ?? null,
      receiptDate: body.receiptDate ?? null,
      rejectedQuantity,
      remarks: body.remarks ?? null,
      wastageQuantity,
    }, ctx);
    return NextResponse.json(result, { status: result.success === false && result.code === 'CONFLICT' ? 409 : 200 });
  } catch (err) {
    const mapped = mapProductionRpcError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
