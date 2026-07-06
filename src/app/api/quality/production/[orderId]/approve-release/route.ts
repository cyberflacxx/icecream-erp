import { NextRequest } from 'next/server';

import { can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { forwardJsonToInternalRoute } from '../../../../production/_internal-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.write', 'quality.production.approve_release', 'production.write')) return forbidden();

  const { orderId } = await params;
  const body = await request.json().catch(() => ({})) as {
    failedQuantity?: number;
    notes?: string;
    passedQuantity?: number;
    rejectionReason?: string;
    status?: 'FAILED' | 'PASSED' | 'PENDING';
  };

  return forwardJsonToInternalRoute(request, `/api/production/batches/${orderId}/quality-result`, {
    body: {
      failedQuantity: body.failedQuantity,
      notes: body.notes,
      passedQuantity: body.passedQuantity,
      rejectionReason: body.rejectionReason,
      status: body.status ?? 'PASSED',
    },
    method: 'PATCH',
  });
}
