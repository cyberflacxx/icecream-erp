import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { canRecordPayment } from '@/lib/sales';
import { generateSalesReferenceNumber, isMissingSalesTable, salesErrorMessage, salesService, writeSalesAuditLog } from '@/lib/sales-server';

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
    if (isMissingSalesTable(err)) return NextResponse.json([]);
    return serverError(salesErrorMessage(err) || 'Internal server error');
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
    let invoiceResult = await service
      .from('invoices')
      .select('id, total, amount_paid, balance_due, customer_id, invoice_number')
      .eq('id', body.invoiceId)
      .single();
    if (
      invoiceResult.error &&
      (salesErrorMessage(invoiceResult.error).includes('amount_paid') || salesErrorMessage(invoiceResult.error).includes('total'))
    ) {
      invoiceResult = await service
        .from('invoices')
        .select('id, total_amount, paid_amount, balance_due, customer_id, invoice_number')
        .eq('id', body.invoiceId)
        .single();
    }
    const { data: invoice, error: invoiceError } = invoiceResult;
    if (invoiceError) throw invoiceError;
    if (!canRecordPayment(Number(invoice.balance_due ?? 0), body.amount)) {
      return badRequest('Payment amount exceeds invoice balance.');
    }

    let paymentNumber: string;
    try {
      paymentNumber = await generateSalesReferenceNumber('payments', 'PAY');
    } catch (error) {
      if (!isMissingSalesTable(error)) throw error;
      paymentNumber = `PAY-${Date.now()}`;
    }

    let paymentResult = await service
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
    if (paymentResult.error && isMissingSalesTable(paymentResult.error)) {
      paymentResult = {
        data: {
          id: paymentNumber,
          amount: body.amount,
          customer_id: body.customerId,
          invoice_id: body.invoiceId,
          payment_date: body.paymentDate,
          payment_method: body.paymentMethod,
          payment_number: paymentNumber,
          reference_number: body.referenceNumber ?? null,
          status: 'PAID',
        },
        error: null,
      };
    }
    const { data, error } = paymentResult;
    if (error) throw error;

    const nextAmountPaid = Number(invoice.amount_paid ?? invoice.paid_amount ?? 0) + body.amount;
    const nextBalance = Math.max(0, Number(invoice.balance_due ?? 0) - body.amount);
    const invoiceUpdate = await service.from('invoices').update({
      amount_paid: nextAmountPaid,
      balance_due: nextBalance,
      status: nextBalance === 0 ? 'PAID' : 'PARTIAL_PAID',
    }).eq('id', body.invoiceId);
    if (invoiceUpdate.error && salesErrorMessage(invoiceUpdate.error).includes('amount_paid')) {
      await service.from('invoices').update({
        paid_amount: nextAmountPaid,
        balance_due: nextBalance,
        status: nextBalance === 0 ? 'PAID' : 'PARTIAL_PAID',
      }).eq('id', body.invoiceId);
    }

    let customerResult = await service.from('customers').select('current_balance').eq('id', body.customerId).single();
    if (customerResult.error && salesErrorMessage(customerResult.error).includes('current_balance')) {
      customerResult = await service.from('customers').select('outstanding_balance').eq('id', body.customerId).single();
    }
    const { data: customer } = customerResult;
    const customerUpdate = await service.from('customers').update({
      current_balance: Math.max(0, Number(customer?.current_balance ?? customer?.outstanding_balance ?? 0) - body.amount),
    }).eq('id', body.customerId);
    if (customerUpdate.error && salesErrorMessage(customerUpdate.error).includes('current_balance')) {
      await service.from('customers').update({
        outstanding_balance: Math.max(0, Number(customer?.outstanding_balance ?? 0) - body.amount),
      }).eq('id', body.customerId);
    }

    await writeSalesAuditLog('SALES_PAYMENT_RECORDED', String(data.id), ctx.userId, { paymentNumber }, 'payment');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
