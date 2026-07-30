import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildFinanceSourceReference } from '@/lib/finance';
import { createLinkedFinanceTransaction, financeErrorMessage, isMissingFinanceTable, postFinanceDocument } from '@/lib/finance-server';
import { canRecordPayment } from '@/lib/sales';
import { generateSalesReferenceNumber, isMissingSalesColumn, isMissingSalesTable, logSalesRouteError, salesErrorMessage, salesService, writeSalesAuditLog } from '@/lib/sales-server';
import { isSalesTransactionRpcUnavailable, postSalesPaymentTransaction, shouldRequireSalesTransactionRpc } from '@/lib/sales-transactions-server';

function normalizeSalesPaymentMethod(value: string) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'BANK_TRANSFER') return 'BANK';
  return normalized;
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'finance.read')) return forbidden();

  try {
    const service = salesService();
    let paymentsResult: any = await service
      .from('payments')
      .select('id, payment_number, customer_id, invoice_id, payment_date, amount, payment_method, reference_number, status, created_at')
      .order('payment_date', { ascending: false });

    if (paymentsResult.error && isMissingSalesColumn(paymentsResult.error, 'payments', 'created_at')) {
      paymentsResult = await service
        .from('payments')
        .select('id, payment_number, customer_id, invoice_id, payment_date, amount, payment_method, reference_number, status')
        .order('payment_date', { ascending: false });
    }

    if (
      paymentsResult.error &&
      (
        isMissingSalesColumn(paymentsResult.error, 'payments', 'reference_number') ||
        isMissingSalesColumn(paymentsResult.error, 'payments', 'status')
      )
    ) {
      paymentsResult = await service
        .from('payments')
        .select('id, payment_number, customer_id, invoice_id, payment_date, amount, payment_method')
        .order('payment_date', { ascending: false });
    }

    if (paymentsResult.error) throw paymentsResult.error;
    return NextResponse.json(
      ((paymentsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        ...row,
        reference_number: row.reference_number ?? null,
        status: row.status ?? 'PAID',
      })),
    );
  } catch (err) {
    if (isMissingSalesTable(err)) return NextResponse.json([]);
    logSalesRouteError('payments', 'load payment list', err);
    return serverError('Sales payments could not be loaded.');
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
      branchId?: string;
      costCenterCode?: string;
      currencyCode?: string;
      departmentId?: string;
      exchangeRate?: number;
      idempotencyKey?: string;
      tenders?: Array<{
        amount: number;
        paymentMethod: string;
        referenceNumber?: string;
      }>;
    };
    if (!body.customerId || !body.invoiceId || !body.paymentDate || !body.paymentMethod) {
      return badRequest('customerId, invoiceId, paymentDate, and paymentMethod are required.');
    }
    const normalizedPaymentMethod = normalizeSalesPaymentMethod(body.paymentMethod);

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

    try {
      const transaction = await postSalesPaymentTransaction(
        {
          amount: body.amount,
          branchId: body.branchId ?? null,
          costCenterCode: body.costCenterCode ?? null,
          currencyCode: body.currencyCode ?? null,
          customerId: body.customerId,
          departmentId: body.departmentId ?? null,
          exchangeRate: body.exchangeRate ?? null,
          idempotencyKey: body.idempotencyKey ?? null,
          invoiceId: body.invoiceId,
          notes: body.remarks ?? null,
          paymentDate: body.paymentDate,
          paymentMethod: normalizedPaymentMethod,
          referenceNumber: body.referenceNumber ?? null,
          tenders: body.tenders ?? null,
        },
        ctx,
      );
      return NextResponse.json(transaction, { status: 201 });
    } catch (transactionError) {
      if (shouldRequireSalesTransactionRpc() || !isSalesTransactionRpcUnavailable(transactionError)) {
        return serverError(salesErrorMessage(transactionError) || 'Failed to post customer payment transaction.');
      }
    }

    let paymentNumber: string;
    try {
      paymentNumber = await generateSalesReferenceNumber('payments', 'PAY');
    } catch (error) {
      if (!isMissingSalesTable(error)) throw error;
      paymentNumber = `PAY-${Date.now()}`;
    }

    let paymentResult: { data: Record<string, unknown> | null; error: unknown } = await service
      .from('payments')
      .insert({
        amount: body.amount,
        created_by: ctx.userId,
        customer_id: body.customerId,
        invoice_id: body.invoiceId,
        notes: body.remarks ?? null,
        payment_date: body.paymentDate,
        payment_method: normalizedPaymentMethod,
        payment_number: paymentNumber,
        reference_number: body.referenceNumber ?? null,
        status: 'PAID',
      })
      .select()
      .single();
    if (paymentResult.error && isMissingSalesTable(paymentResult.error)) {
      const compatPaymentId = crypto.randomUUID();
      paymentResult = {
        data: {
          id: compatPaymentId,
          amount: body.amount,
          customer_id: body.customerId,
          invoice_id: body.invoiceId,
          payment_date: body.paymentDate,
          payment_method: normalizedPaymentMethod,
          payment_number: paymentNumber,
          reference_number: body.referenceNumber ?? null,
          status: 'PAID',
        },
        error: null,
      };
    }
    const { data, error } = paymentResult;
    if (error) throw error;
    const payment = (data ?? {}) as Record<string, unknown>;

    const invoiceRow = invoice as Record<string, unknown>;
    const nextAmountPaid = Number(invoiceRow.amount_paid ?? invoiceRow.paid_amount ?? 0) + body.amount;
    const nextBalance = Math.max(0, Number(invoiceRow.balance_due ?? 0) - body.amount);
    const nextInvoiceStatus = nextBalance === 0 ? 'PAID' : 'PARTIAL_PAID';
    const invoiceUpdate = await service.from('invoices').update({
      amount_paid: nextAmountPaid,
      balance_due: nextBalance,
      status: nextInvoiceStatus,
    }).eq('id', body.invoiceId);
    if (invoiceUpdate.error && salesErrorMessage(invoiceUpdate.error).includes('amount_paid')) {
      const legacyInvoiceUpdate = await service.from('invoices').update({
        paid_amount: nextAmountPaid,
        balance_due: nextBalance,
        status: nextInvoiceStatus,
      }).eq('id', body.invoiceId);
      if (legacyInvoiceUpdate.error) {
        const fallbackWithoutStatus = await service.from('invoices').update({
          paid_amount: nextAmountPaid,
          balance_due: nextBalance,
        }).eq('id', body.invoiceId);
        if (fallbackWithoutStatus.error) throw fallbackWithoutStatus.error;
      }
    } else if (invoiceUpdate.error) {
      const fallbackWithoutStatus = await service.from('invoices').update({
        amount_paid: nextAmountPaid,
        balance_due: nextBalance,
      }).eq('id', body.invoiceId);
      if (fallbackWithoutStatus.error && salesErrorMessage(fallbackWithoutStatus.error).includes('amount_paid')) {
        const legacyFallbackWithoutStatus = await service.from('invoices').update({
          paid_amount: nextAmountPaid,
          balance_due: nextBalance,
        }).eq('id', body.invoiceId);
        if (legacyFallbackWithoutStatus.error) throw legacyFallbackWithoutStatus.error;
      } else if (fallbackWithoutStatus.error) {
        throw fallbackWithoutStatus.error;
      }
    }

    let customerResult = await service.from('customers').select('current_balance').eq('id', body.customerId).single();
    if (customerResult.error && salesErrorMessage(customerResult.error).includes('current_balance')) {
      customerResult = await service.from('customers').select('outstanding_balance').eq('id', body.customerId).single();
    }
    const customer = (customerResult.data ?? null) as Record<string, unknown> | null;
    const customerUpdate = await service.from('customers').update({
      current_balance: Math.max(0, Number(customer?.current_balance ?? customer?.outstanding_balance ?? 0) - body.amount),
    }).eq('id', body.customerId);
    if (customerUpdate.error && salesErrorMessage(customerUpdate.error).includes('current_balance')) {
      await service.from('customers').update({
        outstanding_balance: Math.max(0, Number(customer?.outstanding_balance ?? 0) - body.amount),
      }).eq('id', body.customerId);
    }

    const paymentId = String(payment.id ?? '');
    const paymentDate = String(payment.payment_date ?? body.paymentDate);
    const paymentMethod = normalizeSalesPaymentMethod(String(payment.payment_method ?? normalizedPaymentMethod));

    const sourceReference = buildFinanceSourceReference('sales', 'invoice_payment', paymentId);

    let journal: { entryDate: string; entryNumber: string; id: string; sourceReference: string; totalCredit: number; totalDebit: number } | null = null;
    let linkedTransaction: { id: string; table: string } | null = null;
    try {
      journal = await postFinanceDocument({
        createdBy: ctx.userId,
        description: `Customer payment for invoice ${String(invoice.invoice_number ?? body.invoiceId)}`,
        journalDate: paymentDate,
        lines: [
          {
            accountCode: paymentMethod === 'BANK' ? '1000' : '1010',
            creditAmount: 0,
            debitAmount: Number(body.amount),
            description: `Customer payment via ${paymentMethod}`,
          },
          {
            accountCode: '1100',
            creditAmount: Number(body.amount),
            debitAmount: 0,
            description: `Reduce accounts receivable for invoice ${String(invoice.invoice_number ?? body.invoiceId)}`,
          },
        ],
        organizationId: ctx.organizationId,
        sourceDocumentId: paymentId,
        sourceDocumentType: 'invoice_payment',
        sourceModule: 'sales',
      });
    } catch (postingError) {
      return serverError(financeErrorMessage(postingError) || 'Failed to post customer payment to finance.');
    }

    if (paymentMethod === 'BANK' || paymentMethod === 'CASH' || paymentMethod === 'PETTY_CASH') {
      try {
        linkedTransaction = await createLinkedFinanceTransaction({
          amount: Number(body.amount),
          createdBy: ctx.userId,
          description: `Customer payment for invoice ${String(invoice.invoice_number ?? body.invoiceId)}`,
          direction: 'IN',
          organizationId: ctx.organizationId,
          paymentMethod: paymentMethod as 'BANK' | 'CASH' | 'PETTY_CASH',
          referenceNumber: body.referenceNumber ?? null,
          sourceDocument: sourceReference,
          transactionDate: paymentDate,
        });
      } catch (linkedTransactionError) {
        const message = financeErrorMessage(linkedTransactionError);
        if (!isMissingFinanceTable(linkedTransactionError) && !message.includes('does not exist')) {
          return serverError(message || 'Failed to post customer payment to finance.');
        }
      }
    }

    await writeSalesAuditLog(
      'SALES_PAYMENT_RECORDED',
      paymentId,
      ctx.userId,
      {
        amount: Number(body.amount),
        customerId: body.customerId,
        invoiceId: body.invoiceId,
        journalId: journal?.id ?? null,
        paymentMethod,
        paymentNumber,
      },
      'payment',
    );

    return NextResponse.json({ ...payment, journal, linkedTransaction }, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
