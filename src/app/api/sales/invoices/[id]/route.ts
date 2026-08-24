import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { deriveSalesInvoiceStatus } from '@/lib/sales-workflow';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient().schema('icecream_erp');

  const invoiceResult = await service
    .from('invoices')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (invoiceResult.error) return serverError(invoiceResult.error.message);
  if (!invoiceResult.data) return notFound('Invoice not found.');

  const invoice = invoiceResult.data as Record<string, unknown>;
  const customerId = invoice.customer_id ? String(invoice.customer_id) : null;

  const [customerResult, invoiceItemsResult, paymentsResult] = await Promise.all([
    customerId
      ? service
        .from('customers')
        .select('*')
        .eq('organization_id', ctx.organizationId)
        .eq('id', customerId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    service
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', params.id),
    service
      .from('payments')
      .select('id, payment_number, payment_method, reference_number, amount, payment_date')
      .eq('organization_id', ctx.organizationId)
      .eq('invoice_id', params.id)
      .order('payment_date', { ascending: false }),
  ]);

  if (customerResult.error) return serverError(customerResult.error.message);
  if (invoiceItemsResult.error) return serverError(invoiceItemsResult.error.message);
  if (paymentsResult.error) return serverError(paymentsResult.error.message);

  const invoiceItems = (invoiceItemsResult.data ?? []) as Array<Record<string, unknown>>;
  const itemIds = [...new Set(invoiceItems.map((row) => String(row.item_id ?? '')).filter(Boolean))];
  let itemsById = new Map<string, Record<string, unknown>>();

  if (itemIds.length > 0) {
    const itemsResult = await service
      .from('items')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .in('id', itemIds);
    if (itemsResult.error) return serverError(itemsResult.error.message);
    itemsById = new Map(
      ((itemsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]),
    );
  }

  let effectiveBranchId = invoice.branch_id ? String(invoice.branch_id) : null;
  let branch: Record<string, unknown> | null = null;

  if (!effectiveBranchId && invoice.sales_order_id) {
    const orderResult = await service
      .from('sales_orders')
      .select('id, branch_id, warehouse_id')
      .eq('organization_id', ctx.organizationId)
      .eq('id', String(invoice.sales_order_id))
      .maybeSingle();
    if (orderResult.error) return serverError(orderResult.error.message);
    effectiveBranchId = orderResult.data?.branch_id ? String(orderResult.data.branch_id) : null;
  }

  if (!effectiveBranchId && invoice.warehouse_id) {
    const warehouseResult = await service
      .from('warehouses')
      .select('id, branch_id')
      .eq('organization_id', ctx.organizationId)
      .eq('id', String(invoice.warehouse_id))
      .maybeSingle();
    if (warehouseResult.error) return serverError(warehouseResult.error.message);
    effectiveBranchId = warehouseResult.data?.branch_id ? String(warehouseResult.data.branch_id) : null;
  }

  if (ctx.isBranchScoped && ctx.branchId && effectiveBranchId && effectiveBranchId !== ctx.branchId) {
    return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
  }

  if (effectiveBranchId) {
    const branchResult = await service
      .from('branches')
      .select('id, code, name, address, phone')
      .eq('organization_id', ctx.organizationId)
      .eq('id', effectiveBranchId)
      .maybeSingle();
    if (branchResult.error) return serverError(branchResult.error.message);
    branch = (branchResult.data ?? null) as Record<string, unknown> | null;
  }

  const companyResult = await service
    .from('organizations')
    .select('id, name, address, phone, email, tax_number, logo_url, currency')
    .eq('id', ctx.organizationId)
    .maybeSingle();
  if (companyResult.error) return serverError(companyResult.error.message);

  return NextResponse.json({
    ...invoice,
    customers: customerResult.data ?? null,
    invoice_items: invoiceItems.map((row) => ({
      ...row,
      items: itemsById.get(String(row.item_id ?? '')) ?? null,
    })),
    payments: paymentsResult.data ?? [],
    branch,
    company: companyResult.data ?? null,
    displayStatus: deriveSalesInvoiceStatus({
      amountPaid: invoice.amount_paid ?? invoice.paid_amount,
      approvedAt: invoice.approved_at,
      approvedBy: invoice.approved_by,
      balanceDue: invoice.balance_due,
      postedAt: invoice.posted_at,
      postedBy: invoice.posted_by,
      status: invoice.status,
      total: invoice.total ?? invoice.total_amount,
    }),
  });
}
