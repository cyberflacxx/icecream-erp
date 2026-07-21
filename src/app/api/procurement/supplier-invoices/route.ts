import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { getErrorMessage, isMissingTableError } from '@/lib/postgrest-compat';
import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

function logSupplierInvoiceError(step: string, error: unknown) {
  const row = error && typeof error === 'object' ? (error as Record<string, unknown>) : null;
  console.error('Supplier invoice request failed.', {
    code: typeof row?.code === 'string' ? row.code : 'UNKNOWN',
    detail: typeof row?.details === 'string' ? row.details : null,
    message: getErrorMessage(error) || 'Unknown supplier invoice error',
    step,
    table: 'supplier_invoices',
  });
}

function normalizeStringValue(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function normalizeNumberValue(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient();
  const [invoices, payments] = await Promise.all([
    service
      .from('supplier_invoices')
      .select(
        'id, supplier_id, purchase_order_id, goods_received_note_id, outstanding_amount, invoice_number, invoice_date, due_date, invoice_total, status, suppliers(name), purchase_orders(po_number), goods_received_notes(grn_number)',
      )
      .eq('organization_id', ctx.organizationId)
      .is('deleted_at', null)
      .order('invoice_date', { ascending: false }),
    service.from('supplier_payments').select('supplier_invoice_id, amount_paid').eq('organization_id', ctx.organizationId).is('deleted_at', null),
  ]);

  if (invoices.error) {
    if (isMissingTableError(invoices.error, 'supplier_invoices')) {
      return NextResponse.json([]);
    }
    logSupplierInvoiceError('list_supplier_invoices', invoices.error);
    return serverError('Unable to load supplier invoices right now.');
  }
  let paymentsData = payments.data ?? [];
  if (payments.error) {
    if (isMissingTableError(payments.error, 'supplier_payments')) {
      paymentsData = [];
    } else {
      logSupplierInvoiceError('list_supplier_payments', payments.error);
      return serverError('Unable to load supplier invoices right now.');
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
    const grn = Array.isArray(row.goods_received_notes) ? row.goods_received_notes[0] : row.goods_received_notes;
    const total = Number(row.invoice_total ?? 0);
    const paidAmount = paidByInvoice.get(String(row.id)) ?? 0;
    const outstandingAmount = Number(row.outstanding_amount ?? Math.max(0, total - paidAmount));
    return {
      balance: outstandingAmount,
      dueDate: row.due_date,
      goodsReceivedNoteId: row.goods_received_note_id ?? null,
      goodsReceivedNoteNumber: grn?.grn_number ?? null,
      id: row.id,
      invoiceDate: row.invoice_date,
      invoiceNumber: row.invoice_number,
      paidAmount,
      purchaseOrderId: row.purchase_order_id ?? null,
      purchaseOrderNumber: po?.po_number ?? null,
      outstandingAmount,
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
    due_date?: string | null;
    dueDate?: string | null;
    goods_received_note_id?: string | null;
    goodsReceivedNoteId?: string | null;
    grn_id?: string | null;
    grnId?: string | null;
    goodsReceivedNoteId?: string | null;
    invoice_amount?: number | null;
    invoiceDate?: string | null;
    invoiceNumber?: string;
    items?: Array<{
      itemId?: string | null;
      item_id?: string | null;
      poUnitCost?: number;
      po_unit_cost?: number;
      quantity?: number;
      quantityInvoiced?: number;
      quantity_invoiced?: number;
      unitCost?: number;
      unit_cost?: number;
    }>;
    purchase_order_id?: string | null;
    purchaseOrderId?: string | null;
    supplier_id?: string;
    supplierId?: string;
  };

  const supplierId = normalizeStringValue(body.supplier_id, body.supplierId);
  const purchaseOrderId = normalizeStringValue(body.purchase_order_id, body.purchaseOrderId) || null;
  const goodsReceivedNoteId = normalizeStringValue(
    body.goods_received_note_id,
    body.goodsReceivedNoteId,
    body.grn_id,
    body.grnId,
  ) || null;
  const normalizedItems = (body.items ?? [])
    .map((item) => ({
      itemId: normalizeStringValue(item.item_id, item.itemId),
      poUnitCost: normalizeNumberValue(item.po_unit_cost, item.poUnitCost, item.unit_cost, item.unitCost),
      quantityInvoiced: normalizeNumberValue(item.quantity_invoiced, item.quantityInvoiced, item.quantity),
      unitCost: normalizeNumberValue(item.unit_cost, item.unitCost, item.po_unit_cost, item.poUnitCost),
    }))
    .filter((item) => item.itemId);

  if (!supplierId || !body.invoiceNumber || !normalizedItems.length) {
    return badRequest('supplierId, invoiceNumber, and items are required.');
  }

  if (normalizedItems.some((item) => item.quantityInvoiced <= 0 || item.unitCost < 0 || item.poUnitCost < 0)) {
    return badRequest('Invoice quantities must be greater than zero and costs cannot be negative.');
  }

  const total = normalizedItems.reduce((sum, item) => sum + item.quantityInvoiced * item.unitCost, 0);
  const service = createServiceRoleClient();
  const tableCheck = await service.from('supplier_invoices').select('id', { count: 'exact', head: true });
  if (tableCheck.error && isMissingTableError(tableCheck.error, 'supplier_invoices')) {
    return serverError('Supplier invoices table is not deployed in Supabase yet.');
  }
  if (tableCheck.error) {
    logSupplierInvoiceError('check_supplier_invoices_table', tableCheck.error);
    return serverError('Unable to save supplier invoice right now.');
  }

  const [supplierResult, orderResult, grnResult] = await Promise.all([
    service.from('suppliers').select('id').eq('organization_id', ctx.organizationId).eq('id', supplierId).maybeSingle(),
    purchaseOrderId
      ? service.from('purchase_orders').select('id, supplier_id').eq('organization_id', ctx.organizationId).eq('id', purchaseOrderId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    goodsReceivedNoteId
      ? service
          .from('goods_received_notes')
          .select('id, supplier_id, purchase_order_id, po_id')
          .eq('organization_id', ctx.organizationId)
          .eq('id', goodsReceivedNoteId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (supplierResult.error || !supplierResult.data) {
    return badRequest('Selected supplier is no longer available. Please refresh and try again.');
  }
  if (orderResult.error || (purchaseOrderId && !orderResult.data)) {
    return badRequest('Selected purchase order is no longer available. Please refresh and try again.');
  }
  if (grnResult.error || (goodsReceivedNoteId && !grnResult.data)) {
    return badRequest('Selected goods received note is no longer available. Please refresh and try again.');
  }

  const linkedPurchaseOrderId =
    purchaseOrderId ||
    (grnResult.data?.purchase_order_id ? String(grnResult.data.purchase_order_id) : '') ||
    (grnResult.data?.po_id ? String(grnResult.data.po_id) : '') ||
    null;

  const { data: invoice, error } = await service
    .from('supplier_invoices')
    .insert({
      due_date: body.due_date ?? body.dueDate ?? null,
      goods_received_note_id: goodsReceivedNoteId,
      invoice_date: body.invoiceDate ?? new Date().toISOString().slice(0, 10),
      invoice_number: body.invoiceNumber,
      invoice_total: total,
      organization_id: ctx.organizationId,
      outstanding_amount: total,
      purchase_order_id: linkedPurchaseOrderId,
      grn_id: goodsReceivedNoteId,
      status: 'PENDING',
      supplier_id: supplierId,
    })
    .select()
    .single();

  if (error || !invoice) {
    logSupplierInvoiceError('create_supplier_invoice', error);
    return serverError('Unable to save supplier invoice right now.');
  }

  const { error: itemsError } = await service.from('supplier_invoice_items').insert(
    normalizedItems.map((item) => ({
      item_id: item.itemId,
      po_unit_cost: item.poUnitCost,
      quantity_invoiced: item.quantityInvoiced,
      supplier_invoice_id: invoice.id,
      unit_cost: item.unitCost,
      unit_cost_reference: item.poUnitCost || item.unitCost,
    })),
  );

  if (itemsError) {
    logSupplierInvoiceError('create_supplier_invoice_items', itemsError);
    return serverError('Unable to save supplier invoice right now.');
  }

  await recordAuditLog({
    action: 'SUPPLIER_INVOICE_LINKED',
    entityId: String(invoice.id),
    entityType: 'supplier_invoice',
    newValues: {
      goodsReceivedNoteId,
      invoiceNumber: body.invoiceNumber,
      itemCount: normalizedItems.length,
      purchaseOrderId: linkedPurchaseOrderId,
      supplierId,
      total,
    },
    organizationId: ctx.organizationId,
    userAgent: request.headers.get('user-agent'),
    userProfileId: ctx.userAccountId ?? ctx.userId,
  });

  return NextResponse.json(invoice, { status: 201 });
}
