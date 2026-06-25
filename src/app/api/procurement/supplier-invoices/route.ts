import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient();
  const [invoices, payments] = await Promise.all([
    service.from('supplier_invoices').select('id, supplier_id, invoice_number, invoice_date, due_date, invoice_total, status, suppliers(name), purchase_orders(po_number)').eq('organization_id', ctx.organizationId).is('deleted_at', null).order('invoice_date', { ascending: false }),
    service.from('supplier_payments').select('supplier_invoice_id, amount_paid').eq('organization_id', ctx.organizationId).is('deleted_at', null),
  ]);

  if (invoices.error) {
    if (invoices.error.message.includes("Could not find the table 'icecream_erp.supplier_invoices'")) {
      return NextResponse.json([]);
    }
    return serverError(invoices.error.message);
  }
  let paymentsData = payments.data ?? [];
  if (payments.error) {
    if (payments.error.message.includes("Could not find the table 'icecream_erp.supplier_payments'")) {
      paymentsData = [];
    } else {
      return serverError(payments.error.message);
    }
  }

  const paidByInvoice = new Map<string, number>();
  for (const payment of paymentsData) {
    const key = String(payment.supplier_invoice_id);
    paidByInvoice.set(key, (paidByInvoice.get(key) ?? 0) + Number(payment.amount_paid ?? 0));
  }

  return NextResponse.json((invoices.data ?? []).map((row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const po = Array.isArray(row.purchase_orders) ? row.purchase_orders[0] : row.purchase_orders;
    const total = Number(row.invoice_total ?? 0);
    const paidAmount = paidByInvoice.get(String(row.id)) ?? 0;
    return {
      balance: total - paidAmount,
      dueDate: row.due_date,
      id: row.id,
      invoiceDate: row.invoice_date,
      invoiceNumber: row.invoice_number,
      paidAmount,
      purchaseOrderNumber: po?.po_number ?? null,
      status: row.status,
      supplierId: row.supplier_id,
      supplierName: supplier?.name ?? 'Unknown supplier',
      total,
    };
  }));
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.write', 'finance.write')) return forbidden();

  const body = (await request.json().catch(() => ({}))) as {
    dueDate?: string | null;
    goodsReceivedNoteId?: string | null;
    invoiceDate?: string | null;
    invoiceNumber?: string;
    items?: Array<{ itemId: string; poUnitCost?: number; quantityInvoiced: number; unitCost: number }>;
    purchaseOrderId?: string | null;
    supplierId?: string;
  };

  if (!body.supplierId || !body.invoiceNumber || !body.items?.length) {
    return badRequest('supplierId, invoiceNumber, and items are required.');
  }

  const total = body.items.reduce((sum, item) => sum + Number(item.quantityInvoiced) * Number(item.unitCost), 0);
  const service = createServiceRoleClient();
  const tableCheck = await service.from('supplier_invoices').select('id', { count: 'exact', head: true });
  if (tableCheck.error?.message.includes("Could not find the table 'icecream_erp.supplier_invoices'")) {
    return serverError('Supplier invoices table is not deployed in Supabase yet.');
  }
  const { data: invoice, error } = await service
    .from('supplier_invoices')
    .insert({
      due_date: body.dueDate ?? null,
      goods_received_note_id: body.goodsReceivedNoteId ?? null,
      invoice_date: body.invoiceDate ?? new Date().toISOString().slice(0, 10),
      invoice_number: body.invoiceNumber,
      invoice_total: total,
      organization_id: ctx.organizationId,
      purchase_order_id: body.purchaseOrderId ?? null,
      status: 'PENDING',
      supplier_id: body.supplierId,
    })
    .select()
    .single();

  if (error || !invoice) return serverError(error?.message ?? 'Failed to create supplier invoice.');

  const { error: itemsError } = await service.from('supplier_invoice_items').insert(
    body.items.map((item) => ({
      item_id: item.itemId,
      po_unit_cost: item.poUnitCost ?? item.unitCost,
      quantity_invoiced: item.quantityInvoiced,
      supplier_invoice_id: invoice.id,
      unit_cost: item.unitCost,
      unit_cost_reference: item.poUnitCost ?? item.unitCost,
    })),
  );

  if (itemsError) return serverError(itemsError.message);
  return NextResponse.json(invoice, { status: 201 });
}
