import { NextRequest } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { forwardJsonToInternalRoute } from '../../_internal-proxy';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write', 'production.warehouse.transfer')) return forbidden();

  const body = await request.json().catch(() => ({})) as {
    batchId?: string;
    destinationWarehouseId?: string;
    orderId?: string;
    receivedBy?: string;
    transferDate?: string;
  };
  const batchId = body.batchId ?? body.orderId;
  if (!batchId) return badRequest('batchId is required.');
  if (!body.destinationWarehouseId) return badRequest('destinationWarehouseId is required.');

  return forwardJsonToInternalRoute(
    request,
    `/api/production/batches/${batchId}/transfer-finished-goods`,
    {
      body: {
        destinationWarehouseId: body.destinationWarehouseId,
        receivedBy: body.receivedBy,
        transferDate: body.transferDate,
      },
    },
  );
}
