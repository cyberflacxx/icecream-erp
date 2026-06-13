import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { canRecordPayment } from '@/lib/sales';
import { generateSalesReferenceNumber, salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'finance.read')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service
      .from('payments')
      .select('id, payment_number, customer_id, invoice_id, payment_date, amount, payment_method, reference_number, status')
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      amount: number;
      customerId: string;
      invoiceId: string;
      paymentDate: string;
      paymentMethod: string;
      referenceNumber?: string;
      remarks?: string;
    };
    if (!body.customerId || !body.invoiceId || !body.paymentDate || !body.paymentMethod) {
      return badRequest('customerId, invoiceId, paymentDate, and paymentMethod are required.');
    }

    const service = salesService();
    const { data: invoice, error: invoiceError } = await service
      .from('invoices')
      .select('id, total, amount_paid, balance_due, customer_id, invoice_number')
      .eq('id', body.invoiceId)
      .single();
    if (invoiceError) throw invoiceError;
    if (!canRecordPayment(Number(invoice.balance_due ?? 0), body.amount)) {
      return badRequest('Payment amount exceeds invoice balance.');
    }

    const paymentNumber = await generateSalesReferenceNumber('payments', 'PAY');
    const { data, error } = await service
      .from('payments')
      .insert({
        amount: body.amount,
        created_by: ctx.userId,
        customer_id: body.customerId,
        invoice_id: body.invoiceId,
        notes: body.remarks ?? null,
        payment_date: body.paymentDate,
        payment_method: body.paymentMethod,
        payment_number: paymentNumber,
        reference_number: body.referenceNumber ?? null,
        status: 'PAID',
      })
      .select()
      .single();
    if (error) throw error;

    const nextAmountPaid = Number(invoice.amount_paid ?? 0) + body.amount;
    const nextBalance = Math.max(0, Number(invoice.balance_due ?? 0) - body.amount);
    await service.from('invoices').update({
      amount_paid: nextAmountPaid,
      balance_due: nextBalance,
      status: nextBalance === 0 ? 'PAID' : 'PARTIAL_PAID',
    }).eq('id', body.invoiceId);

    const { data: customer } = await service.from('customers').select('current_balance').eq('id', body.customerId).single();
    await service.from('customers').update({
      current_balance: Math.max(0, Number(customer?.current_balance ?? 0) - body.amount),
    }).eq('id', body.customerId);

    await writeSalesAuditLog('SALES_PAYMENT_RECORDED', String(data.id), ctx.userId, { paymentNumber }, 'payment');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
