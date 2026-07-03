import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import {
  derivePurchaseOrderStatus,
  formatPurchaseOrderDbStatus,
  isPurchaseOrderRejectable,
} from '@/lib/procurement-purchase-orders';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.approve')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();

  let remarks: string | null = null;
  try {
    const body = await request.json();
    remarks = body.remarks ?? null;
  } catch {
    // remarks optional
  }

  try {
    const { data: existing, error: fetchErr } = await service
      .from('purchase_orders')
      .select('id, status, approver_user_id, sent_at, rejected_at, notes')
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
    if (!isPurchaseOrderRejectable(workflowStatus)) {
      return badRequest('Only draft or approved purchase orders can be rejected.');
    }
    if (order.approver_user_id && String(order.approver_user_id) !== ctx.userId) {
      return forbidden();
    }

    const { data: updated, error: updateErr } = await service
      .from('purchase_orders')
      .update({
        rejected_at: new Date().toISOString(),
        rejected_by: ctx.userId,
        notes: remarks ?? order.notes ?? null,
        status: formatPurchaseOrderDbStatus('cancelled', order.status),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) return serverError(updateErr.message);

    return NextResponse.json(updated);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to reject purchase order.');
  }
}
