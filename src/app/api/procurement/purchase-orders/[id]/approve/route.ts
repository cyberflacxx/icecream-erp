import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import {
  derivePurchaseOrderStatus,
  formatPurchaseOrderDbStatus,
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
  let approvalNotes: string | null = null;

  try {
    const body = await request.json();
    approvalNotes = typeof body?.approvalNotes === 'string'
      ? body.approvalNotes.trim() || null
      : typeof body?.remarks === 'string'
        ? body.remarks.trim() || null
        : null;
  } catch {}

  try {
    const { data: existing, error: fetchErr } = await service
      .from('purchase_orders')
      .select('id, status, approval_status, approver_user_id, approved_at, approved_by, rejected_at, sent_at')
      .is('deleted_at', null)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return notFound('Purchase order not found.');
    const order = existing as Record<string, unknown>;
    if (
      !['DRAFT', 'PENDING_APPROVAL'].includes(
        derivePurchaseOrderStatus({
          approvalStatus: order.approval_status,
          approvedAt: order.approved_at,
          approvedBy: order.approved_by,
          rejectedAt: order.rejected_at,
          sentAt: order.sent_at,
          status: order.status,
        }),
      )
    ) {
      return badRequest('Only draft or pending approval purchase orders can be approved.');
    }
    if (order.approver_user_id && String(order.approver_user_id) !== ctx.userId) {
      return forbidden();
    }

    const { data: updated, error: updateErr } = await service
      .from('purchase_orders')
      .update({
        approval_notes: approvalNotes,
        approval_status: 'APPROVED',
        approved_by: ctx.userId,
        approved_at: new Date().toISOString(),
        approver_id: order.approver_user_id ? String(order.approver_user_id) : null,
        status: formatPurchaseOrderDbStatus('approved', order.status),
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
