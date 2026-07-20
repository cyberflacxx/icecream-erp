import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildFinanceSourceReference } from '@/lib/finance';
import { createLinkedFinanceTransaction, postFinanceDocument } from '@/lib/finance-server';
import { canPayInvoice } from '@/lib/procurement';
import { createServiceRoleClient } from '@/lib/supabase/server';

const PAYMENT_SOURCES = new Set(['BANK', 'CASH', 'PETTY_CASH']);

function normalizeStringValue(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read', 'finance.read')) return forbidden();

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('supplier_payments')
    .select(
      'id, supplier_invoice_id, payment_date, payment_method, reference_number, amount_paid, status, suppliers(name), supplier_invoices(invoice_number)',
    )
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .order('payment_date', { ascending: false });

  if (error) {
    if (error.message.includes("Could not find the table 'icecream_erp.supplier_payments'")) {
      return NextResponse.json([]);
    }
    return serverError(error.message);
  }

  return NextResponse.json((data ?? []).map((row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const invoice = Array.isArray(row.supplier_invoices) ? row.supplier_invoices[0] : row.supplier_invoices;
    return {
      amountPaid: Number(row.amount_paid ?? 0),
      id: row.id,
      invoiceId: row.supplier_invoice_id ?? null,
      invoiceNumber: invoice?.invoice_number ?? null,
      method: row.payment_method,
      paymentDate: row.payment_date,
      reference: row.reference_number,
      status: row.status,
      supplierName: supplier?.name ?? 'Unknown supplier',
    };
  }));
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.payment.post', 'finance.write', 'procurement.write')) return forbidden();

  const body = (await request.json().catch(() => ({}))) as {
    amount?: number;
    amountPaid?: number;
    approvalNotes?: string | null;
    bankAccountId?: string | null;
    bank_account_id?: string | null;
    cashAccountId?: string | null;
    cash_account_id?: string | null;
    goodsReceivedNoteId?: string | null;
    goods_received_note_id?: string | null;
    grn_id?: string | null;
    grnId?: string | null;
    paymentDate?: string;
    paymentMethod?: string;
    paymentSourceType?: string;
    payment_source_type?: string;
    paymentMethod?: string;
    pettyCashRequestId?: string | null;
    petty_cash_request_id?: string | null;
    purchaseOrderId?: string | null;
    purchase_order_id?: string | null;
    referenceNumber?: string | null;
    remarks?: string | null;
    supplier_id?: string;
    supplierId?: string;
    supplierInvoiceId?: string;
    supplier_invoice_id?: string;
    supplierInvoiceId?: string;
  };

  const supplierId = normalizeStringValue(body.supplier_id, body.supplierId);
  const supplierInvoiceId = normalizeStringValue(body.supplier_invoice_id, body.supplierInvoiceId);
  const paymentSourceType = normalizeStringValue(body.payment_source_type, body.paymentSourceType, body.paymentMethod).toUpperCase();
  const purchaseOrderId = normalizeStringValue(body.purchase_order_id, body.purchaseOrderId) || null;
  const goodsReceivedNoteId = normalizeStringValue(
    body.goods_received_note_id,
    body.goodsReceivedNoteId,
    body.grn_id,
    body.grnId,
  ) || null;
  const bankAccountId = normalizeStringValue(body.bank_account_id, body.bankAccountId) || null;
  const cashAccountId = normalizeStringValue(body.cash_account_id, body.cashAccountId) || null;
  const pettyCashRequestId = normalizeStringValue(body.petty_cash_request_id, body.pettyCashRequestId) || null;
  const approvalNotes = typeof body.approvalNotes === 'string' ? body.approvalNotes.trim() || null : null;
  const amountPaid = Number(body.amountPaid ?? body.amount ?? 0);

  if (!supplierId || !supplierInvoiceId || !paymentSourceType || !amountPaid) {
    return badRequest('supplierId, supplierInvoiceId, paymentMethod, and amountPaid are required.');
  }
  if (!PAYMENT_SOURCES.has(paymentSourceType)) {
    return badRequest('Payment source must be BANK, CASH, or PETTY_CASH.');
  }
  if (paymentSourceType === 'BANK' && !bankAccountId) {
    return badRequest('Please select a bank account for this payment.');
  }
  if (paymentSourceType === 'CASH' && !cashAccountId) {
    return badRequest('Please select a cash account for this payment.');
  }
  if (paymentSourceType === 'PETTY_CASH' && !pettyCashRequestId) {
    return badRequest('Please select a petty cash request for this payment.');
  }

  const service = createServiceRoleClient();
  const tableCheck = await service.from('supplier_payments').select('id', { count: 'exact', head: true });
  if (tableCheck.error?.message.includes("Could not find the table 'icecream_erp.supplier_payments'")) {
    return serverError('Supplier payments table is not deployed in Supabase yet.');
  }
  const [invoiceResult, paymentsResult] = await Promise.all([
    service
      .from('supplier_invoices')
      .select('id, invoice_total, outstanding_amount, status, supplier_id, purchase_order_id, goods_received_note_id, grn_id')
      .eq('id', supplierInvoiceId)
      .single(),
    service.from('supplier_payments').select('amount_paid').eq('supplier_invoice_id', supplierInvoiceId),
  ]);

  if (invoiceResult.error || !invoiceResult.data) return badRequest('Supplier invoice not found.');
  if (String(invoiceResult.data.supplier_id ?? '') !== supplierId) {
    return badRequest('Selected supplier invoice does not belong to the selected supplier.');
  }

  const paidAlready = (paymentsResult.data ?? []).reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0);
  const balance = Number(invoiceResult.data.outstanding_amount ?? invoiceResult.data.invoice_total ?? 0) || (Number(invoiceResult.data.invoice_total ?? 0) - paidAlready);
  if (!canPayInvoice(balance, amountPaid)) {
    return badRequest('Payment must be greater than zero and not exceed the invoice balance.');
  }

  const [bankAccountResult, cashAccountResult, pettyCashResult] = await Promise.all([
    bankAccountId ? service.from('bank_accounts').select('id').eq('id', bankAccountId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    cashAccountId ? service.from('cash_accounts').select('id').eq('id', cashAccountId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    pettyCashRequestId ? service.from('petty_cash_requests').select('id').eq('id', pettyCashRequestId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  if (bankAccountId && (bankAccountResult.error || !bankAccountResult.data)) {
    return badRequest('Selected bank account is no longer available. Please refresh and try again.');
  }
  if (cashAccountId && (cashAccountResult.error || !cashAccountResult.data)) {
    return badRequest('Selected cash account is no longer available. Please refresh and try again.');
  }
  if (pettyCashRequestId && (pettyCashResult.error || !pettyCashResult.data)) {
    return badRequest('Selected petty cash request is no longer available. Please refresh and try again.');
  }

  const linkedPurchaseOrderId =
    purchaseOrderId ||
    (invoiceResult.data.purchase_order_id ? String(invoiceResult.data.purchase_order_id) : '') ||
    null;
  const linkedGrnId =
    goodsReceivedNoteId ||
    (invoiceResult.data.goods_received_note_id ? String(invoiceResult.data.goods_received_note_id) : '') ||
    (invoiceResult.data.grn_id ? String(invoiceResult.data.grn_id) : '') ||
    null;

  const { data, error } = await service
    .from('supplier_payments')
    .insert({
      amount_paid: amountPaid,
      approval_notes: approvalNotes,
      approved_at: new Date().toISOString(),
      approved_by: ctx.userId,
      bank_account_id: bankAccountId,
      cash_account_id: cashAccountId,
      created_by: ctx.userId,
      goods_received_note_id: linkedGrnId,
      grn_id: linkedGrnId,
      organization_id: ctx.organizationId,
      payment_source_type: paymentSourceType,
      payment_date: body.paymentDate ?? new Date().toISOString().slice(0, 10),
      payment_method: paymentSourceType,
      petty_cash_request_id: pettyCashRequestId,
      purchase_order_id: linkedPurchaseOrderId,
      reference_number: body.referenceNumber ?? null,
      remarks: body.remarks ?? null,
      status: 'POSTED',
      supplier_id: supplierId,
      supplier_invoice_id: supplierInvoiceId,
    })
    .select()
    .single();

  if (error) return serverError(error.message);
  const sourceReference = buildFinanceSourceReference('procurement', 'supplier_payment', String(data.id));

  let journal: { entryNumber: string; id: string } | null = null;
  let linkedTransaction: { id: string; table: string } | null = null;
  try {
    journal = await postFinanceDocument({
      createdBy: ctx.userId,
      description: `Supplier payment ${data.reference_number ?? data.id}`,
      journalDate: String(data.payment_date ?? body.paymentDate ?? new Date().toISOString().slice(0, 10)),
      lines: [
        {
          accountCode: '2000',
          creditAmount: 0,
          debitAmount: amountPaid,
          description: `Reduce accounts payable for supplier invoice ${supplierInvoiceId}`,
        },
        {
          accountCode: paymentSourceType === 'BANK' ? '1000' : paymentSourceType === 'CASH' ? '1010' : '1020',
          creditAmount: amountPaid,
          debitAmount: 0,
          description: `Supplier payment via ${paymentSourceType}`,
        },
      ],
      organizationId: ctx.organizationId,
      sourceDocumentId: String(data.id),
      sourceDocumentType: 'supplier_payment',
      sourceModule: 'procurement',
    });

    linkedTransaction = await createLinkedFinanceTransaction({
      amount: amountPaid,
      createdBy: ctx.userId,
      description: `Supplier payment ${data.reference_number ?? data.id}`,
      direction: 'OUT',
      organizationId: ctx.organizationId,
      paymentMethod: paymentSourceType as 'BANK' | 'CASH' | 'PETTY_CASH',
      referenceNumber: body.referenceNumber ?? null,
      sourceDocument: sourceReference,
      transactionDate: String(data.payment_date ?? body.paymentDate ?? new Date().toISOString().slice(0, 10)),
    });
  } catch (postingError) {
    return serverError(postingError instanceof Error ? postingError.message : 'Failed to post supplier payment to finance.');
  }

  await service
    .from('supplier_invoices')
    .update({
      outstanding_amount: Math.max(0, balance - amountPaid),
      status: amountPaid >= balance ? 'PAID' : 'PARTIAL_PAID',
    })
    .eq('id', supplierInvoiceId);

  return NextResponse.json({ ...data, journal, linkedTransaction }, { status: 201 });
}
