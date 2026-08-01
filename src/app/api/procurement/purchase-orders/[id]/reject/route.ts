import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import {
  derivePurchaseOrderStatus,
  formatPurchaseOrderDbStatus,
  isPurchaseOrderRejectable,
} from '@/lib/procurement-purchase-orders';
import { createServiceRoleClient } from '@/lib/supabase/server';

function isInvalidPoStatusEnumError(error: { message?: string } | null | undefined) {
  return (error?.message ?? '').toLowerCase().includes('invalid input value for enum');
}

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
    remarks =
      typeof body.remarks === 'string'
        ? body.remarks.trim() || null
        : typeof body.reason === 'string'
          ? body.reason.trim() || null
          : null;
  } catch {
    // remarks optional
  }

  if (!remarks) {
    return badRequest('Rejection reason is required.');
  }

  try {
    const { data: existing, error: fetchErr } = await service
      .from('purchase_orders')
      .select('id, status, approval_status, approver_user_id, approved_at, approved_by, sent_at, rejected_at, notes')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Purchase order not found.');

    const order = existing as Record<string, unknown>;
    const workflowStatus = derivePurchaseOrderStatus({
      approvalStatus: order.approval_status,
      approvedAt: order.approved_at,
      approvedBy: order.approved_by,
      rejectedAt: order.rejected_at,
      sentAt: order.sent_at,
      status: order.status,
    });
    if (!isPurchaseOrderRejectable(workflowStatus)) {
      return badRequest('Only draft, pending approval, or approved purchase orders can be rejected.');
    }
    if (order.approver_user_id && String(order.approver_user_id) !== ctx.userId) {
      return forbidden();
    }

    const rejectionTimestamp = new Date().toISOString();
    const rejectionPayload = {
      approval_status: 'REJECTED',
      rejected_at: rejectionTimestamp,
      rejected_by: ctx.userId,
      notes: remarks ?? order.notes ?? null,
      status: formatPurchaseOrderDbStatus('rejected', order.status),
    };

    let updateResult = await service
      .from('purchase_orders')
      .update(rejectionPayload)
      .eq('id', id)
      .select()
      .single();

    if (updateResult.error && isInvalidPoStatusEnumError(updateResult.error)) {
      updateResult = await service
        .from('purchase_orders')
        .update({
          ...rejectionPayload,
          status: formatPurchaseOrderDbStatus('cancelled', order.status),
        })
        .eq('id', id)
        .select()
        .single();
    }

    if (updateResult.error) return serverError(updateResult.error.message);

    return NextResponse.json(updateResult.data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to reject purchase order.');
  }
}
