import { NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { emitOperationalNotifications } from '@/lib/notifications-server';
import { deriveCustomerCreditAllowed } from '@/lib/sales-customers';
import { checkStockAvailability, evaluateCreditLimit } from '@/lib/sales';
import { fetchFinishedGoodsStockMap, reserveInvoiceStock, salesService, writeSalesAuditLog } from '@/lib/sales-server';
import { workflowService } from '@/lib/workflow-server';

type SalesRow = Record<string, unknown>;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadInvoiceForApproval(service: ReturnType<typeof salesService>, id: string) {
  const { data: invoice, error: invoiceError } = await service
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();
  if (invoiceError) throw invoiceError;

  const row = invoice as SalesRow;
  const customerId = String(row.customer_id ?? '');
  const salesOrderId = row.sales_order_id ? String(row.sales_order_id) : row.order_id ? String(row.order_id) : '';

  const [customerResult, orderResult, itemResult] = await Promise.all([
    customerId ? service.from('customers').select('*').eq('id', customerId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    salesOrderId ? service.from('sales_orders').select('*').eq('id', salesOrderId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    service.from('invoice_items').select('*').eq('invoice_id', id),
  ]);

  if (customerResult.error) throw customerResult.error;
  if (orderResult.error) throw orderResult.error;
  if (itemResult.error) throw itemResult.error;

  const order = (orderResult.data ?? null) as SalesRow | null;

  return {
    amountPaid: toNumber(row.amount_paid ?? row.paid_amount),
    balanceDue: toNumber(row.balance_due),
    branchId: row.branch_id ? String(row.branch_id) : order?.branch_id ? String(order.branch_id) : '',
    customer: (customerResult.data ?? null) as SalesRow | null,
    id: String(row.id),
    invoiceNumber: String(row.invoice_number ?? id),
    items: ((itemResult.data ?? []) as SalesRow[]).map((item) => ({
      itemId: String(item.item_id ?? ''),
      quantity: toNumber(item.quantity ?? item.quantity_invoiced),
    })),
    salesOrderId,
    status: String(row.status ?? ''),
    total: toNumber(row.total ?? row.total_amount),
    warehouseId: row.warehouse_id ? String(row.warehouse_id) : order?.warehouse_id ? String(order.warehouse_id) : '',
  };
}

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
    const invoice = await loadInvoiceForApproval(service, id);
    if (!invoice.warehouseId) return badRequest('Invoice approval requires a linked warehouse or sales order warehouse.');

    const credit = evaluateCreditLimit(
      Number(invoice.customer?.current_balance ?? 0),
      Number(invoice.customer?.credit_limit ?? 0),
      invoice.total,
      deriveCustomerCreditAllowed(invoice.customer?.payment_terms, invoice.customer?.credit_limit),
    );
    if (credit.exceeded) return badRequest('Customer credit limit exceeded.');

    const stockMap = await fetchFinishedGoodsStockMap(invoice.warehouseId);
    const stockCheck = checkStockAvailability(
      invoice.items,
      stockMap,
    );
    if (stockCheck.some((row) => !row.stockAvailable)) {
      return badRequest('Invoice approval blocked by stock shortage.');
    }

    await reserveInvoiceStock(id, invoice.warehouseId);

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
      branchId: invoice.branchId,
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
      branchId: invoice.branchId,
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
