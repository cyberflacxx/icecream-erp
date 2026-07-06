import { NextRequest } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { forwardJsonToInternalRoute } from '../../_internal-proxy';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'production.write', 'production.warehouse.issue')) return forbidden();

  const body = await request.json().catch(() => ({})) as { batchId?: string; orderId?: string };
  const batchId = body.batchId ?? body.orderId;
  if (!batchId) return badRequest('batchId is required.');

  return forwardJsonToInternalRoute(request, `/api/production/batches/${batchId}/start`);
}
