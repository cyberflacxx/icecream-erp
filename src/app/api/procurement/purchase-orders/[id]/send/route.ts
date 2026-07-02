import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import {
  derivePurchaseOrderStatus,
  formatPurchaseOrderDbStatus,
} from '@/lib/procurement-purchase-orders';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  try {
    const { data: existing, error: fetchErr } = await service
      .from('purchase_orders')
      .select('id, status, approved_by, approved_at, sent_at, rejected_at')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Purchase order not found.');

    const order = existing as Record<string, unknown>;
    const workflowStatus = derivePurchaseOrderStatus({
      rejectedAt: order.rejected_at,
      sentAt: order.sent_at,
      status: order.status,
    });
    if (workflowStatus !== 'APPROVED') {
      return badRequest('Only approved purchase orders can be sent.');
    }
    if (!order.approved_by && !order.approved_at) {
      return badRequest('Purchase order must be approved before sending.');
    }

    const { data: updated, error: updateErr } = await service
      .from('purchase_orders')
      .update({
        sent_at: new Date().toISOString(),
        status: formatPurchaseOrderDbStatus('sent_to_supplier', order.status),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return serverError(updateErr.message);

    return NextResponse.json(updated);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
