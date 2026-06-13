import { NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { emitOperationalNotifications } from '@/lib/notifications-server';
import { checkStockAvailability, evaluateCreditLimit } from '@/lib/sales';
import { fetchFinishedGoodsStockMap, reserveInvoiceStock, salesService, writeSalesAuditLog } from '@/lib/sales-server';
import { workflowService } from '@/lib/workflow-server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();

  try {
    const { id } = await params;
    const service = salesService();
    const { data: invoice, error: invoiceError } = await service
      .from('invoices')
      .select('id, customer_id, sales_order_id, total, amount_paid, balance_due, status, customers(credit_limit, current_balance, credit_allowed), invoice_items(item_id, quantity), sales_orders(warehouse_id)')
      .eq('id', id)
      .single();
    if (invoiceError) throw invoiceError;

    const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers;
    const salesOrder = Array.isArray(invoice.sales_orders) ? invoice.sales_orders[0] : invoice.sales_orders;
    const credit = evaluateCreditLimit(
      Number(customer?.current_balance ?? 0),
      Number(customer?.credit_limit ?? 0),
      Number(invoice.total ?? 0),
      Boolean(customer?.credit_allowed),
    );
    if (credit.exceeded) return badRequest('Customer credit limit exceeded.');

    const stockMap = await fetchFinishedGoodsStockMap(String(salesOrder?.warehouse_id ?? ''));
    const stockCheck = checkStockAvailability(
      (Array.isArray(invoice.invoice_items) ? invoice.invoice_items : []).map((item) => ({
        itemId: String(item.item_id),
        quantity: Number(item.quantity ?? 0),
      })),
      stockMap,
    );
    if (stockCheck.some((row) => !row.stockAvailable)) {
      return badRequest('Invoice approval blocked by stock shortage.');
    }

    await reserveInvoiceStock(id, String(salesOrder?.warehouse_id ?? ''));

    const { data, error } = await service
      .from('invoices')
      .update({
        approved_at: new Date().toISOString(),
        approved_by: ctx.userId,
        status: 'APPROVED',
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await workflowService().from('workflow_history').insert({
      action: 'SALES_SALES_INVOICE_APPROVED',
      action_at: new Date().toISOString(),
      actor_id: ctx.userId,
      document_id: id,
      document_reference: String((data as Record<string, unknown>).invoice_number ?? id),
      document_type: 'sales_invoice',
      from_status: 'PENDING_APPROVAL',
      module_name: 'sales',
      organization_id: ctx.organizationId,
      to_status: 'APPROVED',
    });

    await writeSalesAuditLog('SALES_INVOICE_APPROVED', id, ctx.userId, { status: 'APPROVED' }, 'invoice');

    await emitOperationalNotifications({
      actorUserId: ctx.userId,
      branchId: String((data as Record<string, unknown>).branch_id ?? ''),
      documentId: id,
      documentType: 'sales_invoice',
      eventType: 'INVOICE_APPROVED',
      message: `Invoice ${String((data as Record<string, unknown>).invoice_number ?? id)} is approved and ready for dispatch.`,
      metadata: {
        invoiceNumber: String((data as Record<string, unknown>).invoice_number ?? id),
      },
      moduleName: 'sales',
      organizationId: ctx.organizationId,
      recipientRoleNames: ['Stores Manager', 'Sales Manager', 'Finance Manager'],
      severity: 'MEDIUM',
      title: 'Invoice approved',
    });

    await emitOperationalNotifications({
      actorUserId: ctx.userId,
      branchId: String((data as Record<string, unknown>).branch_id ?? ''),
      documentId: id,
      documentType: 'sales_invoice',
      eventType: 'DISPATCH_READY',
      message: `Dispatch can proceed for invoice ${String((data as Record<string, unknown>).invoice_number ?? id)}.`,
      metadata: {
        invoiceNumber: String((data as Record<string, unknown>).invoice_number ?? id),
      },
      moduleName: 'dispatch',
      organizationId: ctx.organizationId,
      recipientRoleNames: ['Stores Manager', 'Dispatch Clerk'],
      severity: 'LOW',
      title: 'Dispatch ready',
    });

    return NextResponse.json(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
