import { NextRequest, NextResponse } from 'next/server';
import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { postSupplierPaymentTransaction } from '@/lib/procurement-transactions-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const PAYMENT_SOURCES = new Set(['BANK', 'BANK_TRANSFER', 'CASH', 'MOBILE_MONEY', 'PETTY_CASH', 'CREDIT']);
const text = (...values: unknown[]) => values.map((value) => String(value ?? '').trim()).find(Boolean) ?? '';
function paymentSource(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'BANK_TRANSFER' || normalized === 'BANK') return 'BANK';
  if (normalized === 'MOBILE_MONEY' || normalized === 'ECOCASH') return 'MOBILE_MONEY';
  return normalized;
}

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.read', 'finance.read')) return forbidden();
  const { data, error } = await createServiceRoleClient().from('supplier_payments')
    .select('id, supplier_invoice_id, payment_date, payment_method, reference_number, amount_paid, status, suppliers(name), supplier_invoices(invoice_number)')
    .eq('organization_id', ctx.organizationId).is('deleted_at', null).order('payment_date', { ascending: false });
  if (error) return error.message.includes("Could not find the table 'icecream_erp.supplier_payments'") ? NextResponse.json([]) : serverError(error.message);
  return NextResponse.json((data ?? []).map((row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const invoice = Array.isArray(row.supplier_invoices) ? row.supplier_invoices[0] : row.supplier_invoices;
    return { amountPaid: Number(row.amount_paid ?? 0), id: row.id, invoiceId: row.supplier_invoice_id ?? null, invoiceNumber: invoice?.invoice_number ?? null, method: row.payment_method, paymentDate: row.payment_date, reference: row.reference_number, status: row.status, supplierName: supplier?.name ?? 'Unknown supplier' };
  }));
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.payment.post', 'finance.write', 'procurement.write')) return forbidden();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const supplierId = text(body.supplier_id, body.supplierId);
  const supplierInvoiceId = text(body.supplier_invoice_id, body.supplierInvoiceId);
  const paymentSourceType = paymentSource(text(body.payment_source_type, body.paymentSourceType, body.paymentMethod));
  const amountPaid = Number(body.amountPaid ?? body.amount ?? 0);
  const bankAccountId = text(body.bank_account_id, body.bankAccountId) || null;
  const cashAccountId = text(body.cash_account_id, body.cashAccountId) || null;
  const pettyCashRequestId = text(body.petty_cash_request_id, body.pettyCashRequestId) || null;
  const idempotencyKey = text(body.idempotencyKey, request.headers.get('idempotency-key')) || crypto.randomUUID();
  if (!supplierId || !supplierInvoiceId || !paymentSourceType || !amountPaid) return badRequest('supplierId, supplierInvoiceId, paymentMethod, and amountPaid are required.');
  if (!PAYMENT_SOURCES.has(paymentSourceType)) return badRequest('Payment source must be BANK_TRANSFER, CASH, MOBILE_MONEY, PETTY_CASH, or CREDIT.');
  if (paymentSourceType === 'CREDIT') return badRequest('CREDIT represents unpaid supplier credit terms and must not create a cash or bank supplier payment.');
  if (paymentSourceType === 'BANK' && !bankAccountId) return badRequest('Please select a bank account for this payment.');
  if ((paymentSourceType === 'CASH' || paymentSourceType === 'MOBILE_MONEY') && !cashAccountId) return badRequest('Please select a cash or mobile-money account for this payment.');
  if (paymentSourceType === 'PETTY_CASH' && !pettyCashRequestId) return badRequest('Please select a petty cash request for this payment.');
  try {
    const transaction = await postSupplierPaymentTransaction({ ...body, amountPaid, bankAccountId, cashAccountId, goodsReceivedNoteId: text(body.goods_received_note_id, body.goodsReceivedNoteId, body.grn_id, body.grnId) || null, idempotencyKey, paymentMethod: paymentSourceType, paymentSourceType, pettyCashRequestId, purchaseOrderId: text(body.purchase_order_id, body.purchaseOrderId) || null, supplierId, supplierInvoiceId }, ctx);
    return NextResponse.json(transaction, { status: transaction.idempotentReplay ? 200 : 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to post supplier payment transaction.');
  }
}
