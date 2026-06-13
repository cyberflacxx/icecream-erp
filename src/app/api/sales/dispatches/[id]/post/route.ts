import { NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { emitLowStockNotificationIfNeeded, emitOperationalNotifications } from '@/lib/notifications-server';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';
import { getDocumentLockReason } from '@/lib/workflow';
import { workflowService } from '@/lib/workflow-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  try {
    const { id } = await params;
    const service = salesService();
    const { data: dispatch, error: dispatchError } = await service
      .from('sales_dispatch_notes')
      .select('id, dispatch_number, invoice_id, warehouse_id, status, sales_dispatch_note_items(id, item_id, quantity_dispatched, quantity_invoiced, invoice_item_id), invoices(status, approved_at)')
      .eq('id', id)
      .single();
    if (dispatchError) throw dispatchError;
    if (String(dispatch.status).toUpperCase() !== 'PENDING') {
      return badRequest('Only pending dispatches can be posted.');
    }
    const linkedInvoice = Array.isArray(dispatch.invoices) ? dispatch.invoices[0] : dispatch.invoices;
    if (!linkedInvoice || !linkedInvoice.approved_at) {
      return badRequest('Dispatch cannot be posted until the linked invoice is approved.');
    }

    const workflow = workflowService();
    const { data: existingLock, error: lockError } = await workflow
      .from('document_locks')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('document_type', 'sales_dispatch')
      .eq('document_id', id)
      .eq('is_active', true)
      .maybeSingle();
    if (lockError) throw lockError;
    if (existingLock) return badRequest('Dispatch note is already locked.');

    const { data: postingLog, error: postingLogError } = await workflow.from('posting_logs').insert({
      document_id: id,
      document_reference: String(dispatch.dispatch_number ?? id),
      document_type: 'sales_dispatch',
      module_name: 'sales',
      organization_id: ctx.organizationId,
      payload: { source: 'sales.dispatch.post' },
      posted_by: ctx.userId,
      posting_action: 'POST',
      posting_status: 'PENDING',
    }).select().single();
    if (postingLogError) throw postingLogError;

    const items = Array.isArray(dispatch.sales_dispatch_note_items) ? dispatch.sales_dispatch_note_items : [];
    try {
      for (const item of items) {
        if (Number(item.quantity_dispatched ?? 0) > Number(item.quantity_invoiced ?? 0)) {
          return badRequest('Dispatch quantity cannot exceed invoiced quantity.');
        }

        const { data: balance, error: balanceError } = await service
          .from('stock_balances')
          .select('id, quantity_on_hand, quantity_reserved, quantity_available')
          .eq('item_id', item.item_id)
          .eq('warehouse_id', dispatch.warehouse_id)
          .single();
        if (balanceError) throw balanceError;

        const quantity = Number(item.quantity_dispatched ?? 0);
        const nextReserved = Math.max(0, Number(balance.quantity_reserved ?? 0) - quantity);
        const nextOnHand = Number(balance.quantity_on_hand ?? 0) - quantity;
        if (nextOnHand < 0) return badRequest('Negative stock blocked.');

        await service
          .from('stock_balances')
          .update({
            last_updated: new Date().toISOString(),
            quantity_available: Number(balance.quantity_available ?? 0),
            quantity_on_hand: nextOnHand,
            quantity_reserved: nextReserved,
          })
          .eq('id', balance.id);

        await service.from('stock_movements').insert({
          created_by: ctx.userId,
          item_id: item.item_id,
          movement_type: 'SALES_ISSUE',
          quantity,
          reference_id: id,
          reference_type: 'sales_dispatch',
          total_cost: 0,
          unit_cost: 0,
          warehouse_id: dispatch.warehouse_id,
        });

        await emitLowStockNotificationIfNeeded({
          actorUserId: ctx.userId,
          itemId: String(item.item_id),
          organizationId: ctx.organizationId,
          warehouseId: String(dispatch.warehouse_id ?? ''),
        });
      }

      await service
        .from('sales_dispatch_notes')
        .update({
          dispatched_by: ctx.userId,
          posted_at: new Date().toISOString(),
          status: 'POSTED',
        })
        .eq('id', id);

      await service
        .from('invoices')
        .update({ status: 'FULLY_DISPATCHED' })
        .eq('id', dispatch.invoice_id);

      await workflow.from('posting_logs').update({
        posted_at: new Date().toISOString(),
        posting_status: 'POSTED',
      }).eq('id', (postingLog as Record<string, unknown>).id);

      await workflow.from('document_locks').insert({
        document_id: id,
        document_type: 'sales_dispatch',
        is_active: true,
        lock_reason: getDocumentLockReason('POSTED'),
        locked_at: new Date().toISOString(),
        locked_by: ctx.userId,
        module_name: 'sales',
        organization_id: ctx.organizationId,
      });

      await workflow.from('workflow_history').insert({
        action: 'SALES_SALES_DISPATCH_POSTED',
        action_at: new Date().toISOString(),
        actor_id: ctx.userId,
        document_id: id,
        document_reference: String(dispatch.dispatch_number ?? id),
        document_type: 'sales_dispatch',
        from_status: 'APPROVED',
        module_name: 'sales',
        organization_id: ctx.organizationId,
        to_status: 'POSTED',
      });

      await writeSalesAuditLog('SALES_DISPATCH_POSTED', id, ctx.userId, { status: 'POSTED' }, 'sales_dispatch_note');
      await emitOperationalNotifications({
        actorUserId: ctx.userId,
        documentId: id,
        documentType: 'sales_dispatch',
        eventType: 'DISPATCH_POSTED',
        message: `Dispatch ${String(dispatch.dispatch_number ?? id)} was posted successfully.`,
        metadata: {
          dispatchNumber: String(dispatch.dispatch_number ?? id),
          invoiceId: String(dispatch.invoice_id ?? ''),
        },
        moduleName: 'dispatch',
        organizationId: ctx.organizationId,
        recipientRoleNames: ['Stores Manager', 'Sales Manager'],
        severity: 'LOW',
        title: 'Dispatch posted',
        warehouseId: String(dispatch.warehouse_id ?? ''),
      });
      return NextResponse.json({ posted: true });
    } catch (error) {
      await workflow.from('posting_logs').update({
        error_message: error instanceof Error ? error.message : 'Posting failed.',
        posted_at: new Date().toISOString(),
        posting_status: 'FAILED',
      }).eq('id', (postingLog as Record<string, unknown>).id);
      throw error;
    }
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
