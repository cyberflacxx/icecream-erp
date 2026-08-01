import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { resolveFinancePostingAccount } from '@/lib/finance-foundation-server';
import { buildFinanceSourceReference } from '@/lib/finance';
import { createLinkedFinanceTransaction, financeErrorMessage, isMissingFinanceTable, postFinanceDocument } from '@/lib/finance-server';
import { isSalesTransactionRpcUnavailable, postSalesPaymentTransaction, shouldRequireSalesTransactionRpc } from '@/lib/sales-transactions-server';
import { createServiceRoleClient } from '@/lib/supabase/server';

function normalizeInvoiceStatus(amountPaid: number, total: number): string {
  if (amountPaid <= 0) return 'SENT';
  if (amountPaid >= total) return 'PAID';
  return 'PARTIAL_PAID';
}

function isMissingInvoiceColumnError(error: unknown, columnName: string) {
  if (typeof error !== 'object' || error === null || !('message' in error)) return false;
  return String((error as { message?: unknown }).message ?? '').includes(`column invoices.${columnName} does not exist`);
}

function normalizePaymentMethod(value: string) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'BANK_TRANSFER') return 'BANK';
  return normalized;
}

// ─── POST /api/sales/invoices/[id]/payment ────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write', 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  // Fetch invoice with customer
  const { data: invoice, error: fetchErr } = await service
    .schema('icecream_erp')
    .from('invoices')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !invoice) return notFound('Invoice not found.');

  const inv = invoice as Record<string, unknown>;

  // Branch scoping check via linked sales order
  const linkedOrderId = inv.sales_order_id ?? inv.order_id;
  const invoiceBranchId = inv.branch_id ? String(inv.branch_id) : null;
  if (ctx.isBranchScoped && ctx.branchId && invoiceBranchId && invoiceBranchId !== ctx.branchId) {
    return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
  }
  if (ctx.isBranchScoped && ctx.branchId && linkedOrderId && !invoiceBranchId) {
    const { data: order } = await service
      .schema('icecream_erp')
      .from('sales_orders')
      .select('branch_id')
      .eq('id', linkedOrderId as string)
      .single();

    const orderBranchId = (order as Record<string, unknown> | null)?.branch_id;
    if (orderBranchId && orderBranchId !== ctx.branchId) {
      return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
    }
  }

  const currentStatus = String(inv.status ?? '').toLowerCase();
  if (currentStatus === 'cancelled') {
    return NextResponse.json({ error: 'Cannot record payment on cancelled invoice' }, { status: 400 });
  }

  if (currentStatus === 'paid') {
    return NextResponse.json(
      { error: `Invoice ${inv.invoice_number} is already fully paid` },
      { status: 400 },
    );
  }

  const body = await request.json() as {
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    referenceNumber?: string;
    notes?: string;
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

  if (!body.amount || !body.paymentDate || !body.paymentMethod) {
    return NextResponse.json(
      { error: 'amount, paymentDate, and paymentMethod are required' },
      { status: 400 },
    );
  }

  if (body.amount <= 0) {
    return NextResponse.json({ error: 'Payment amount must be positive' }, { status: 400 });
  }
  const paymentMethod = normalizePaymentMethod(body.paymentMethod);

  const balanceDue = Number(inv.balance_due ?? 0);
  if (body.amount > balanceDue) {
    return NextResponse.json(
      {
        error: `Payment amount $${body.amount.toFixed(2)} exceeds balance due $${balanceDue.toFixed(2)}. Overpayment not allowed.`,
        code: 'OVERPAYMENT',
      },
      { status: 400 },
    );
  }

  try {
    const transaction = await postSalesPaymentTransaction(
      {
        amount: body.amount,
        branchId: invoiceBranchId ?? body.branchId ?? null,
        costCenterCode: body.costCenterCode ?? null,
        currencyCode: body.currencyCode ?? null,
        departmentId: body.departmentId ?? null,
        exchangeRate: body.exchangeRate ?? null,
        idempotencyKey: body.idempotencyKey ?? null,
        invoiceId: params.id,
        notes: body.notes ?? null,
        paymentDate: body.paymentDate,
        paymentMethod,
        referenceNumber: body.referenceNumber ?? null,
        tenders: body.tenders ?? null,
      },
      ctx,
    );
    return NextResponse.json(transaction);
  } catch (transactionError) {
    if (shouldRequireSalesTransactionRpc() || !isSalesTransactionRpcUnavailable(transactionError)) {
      return serverError(financeErrorMessage(transactionError) || 'Failed to post invoice payment transaction.');
    }
  }

  // Fetch customer balance
  let customerResult = await service
    .schema('icecream_erp')
    .from('customers')
    .select('id, current_balance')
    .eq('id', inv.customer_id as string)
    .single();
  if (customerResult.error && String(customerResult.error.message ?? '').includes('current_balance')) {
    customerResult = await service
      .schema('icecream_erp')
      .from('customers')
      .select('id, outstanding_balance')
      .eq('id', inv.customer_id as string)
      .single();
  }
  const customer = customerResult.data;

  if (!customer) return notFound('Customer not found.');

  const cust = customer as Record<string, unknown>;

  // Generate payment number
  const countResult = await service
    .schema('icecream_erp')
    .from('payments')
    .select('id', { count: 'exact', head: true });
  if (countResult.error) {
    if (isMissingFinanceTable(countResult.error)) {
      return serverError('Sales payments table is not deployed in the live database yet.');
    }
    return serverError(financeErrorMessage(countResult.error) || 'Failed to prepare invoice payment.');
  }
  const count = countResult.count;

  const paymentNumber = `PAY-${String((count ?? 0) + 1).padStart(5, '0')}`;

  // Create payment record
  const { data: payment, error: payErr } = await service
    .schema('icecream_erp')
    .from('payments')
    .insert({
      payment_number: paymentNumber,
      invoice_id: params.id,
      customer_id: inv.customer_id,
      amount: body.amount,
      payment_date: body.paymentDate,
      payment_method: paymentMethod,
      reference_number: body.referenceNumber ?? null,
      notes: body.notes ?? `Invoice payment for ${inv.invoice_number}`,
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (payErr || !payment) return serverError(payErr?.message ?? 'Failed to create payment');

  // Update invoice amounts and status
  const prevAmountPaid = Number(inv.amount_paid ?? inv.paid_amount ?? 0);
  const total = Number(inv.total ?? inv.total_amount ?? 0);
  const nextAmountPaid = prevAmountPaid + body.amount;
  const nextBalanceDue = Math.max(0, total - nextAmountPaid);
  const nextStatus = normalizeInvoiceStatus(nextAmountPaid, total);

  const primaryUpdate = await service
    .schema('icecream_erp')
    .from('invoices')
    .update({
      amount_paid: nextAmountPaid,
      balance_due: nextBalanceDue,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single();

  let updatedInvoice = primaryUpdate.data;
  let invoiceUpdateError = primaryUpdate.error;
  if (invoiceUpdateError && isMissingInvoiceColumnError(invoiceUpdateError, 'amount_paid')) {
    const fallbackUpdate = await service
      .schema('icecream_erp')
      .from('invoices')
      .update({
        balance_due: nextBalanceDue,
        paid_amount: nextAmountPaid,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();
    updatedInvoice = fallbackUpdate.data;
    invoiceUpdateError = fallbackUpdate.error;
  }

  if (invoiceUpdateError) return serverError(invoiceUpdateError.message);

  // Reduce customer balance
  const nextCustomerBalance = Math.max(0, Number(cust.current_balance ?? cust.outstanding_balance ?? 0) - body.amount);
  const customerUpdate = await service
    .schema('icecream_erp')
    .from('customers')
    .update({ current_balance: nextCustomerBalance, updated_at: new Date().toISOString() })
    .eq('id', cust.id as string);
  if (customerUpdate.error && String(customerUpdate.error.message ?? '').includes('current_balance')) {
    await service
      .schema('icecream_erp')
      .from('customers')
      .update({ outstanding_balance: nextCustomerBalance, updated_at: new Date().toISOString() })
      .eq('id', cust.id as string);
  }

  let journal: { entryNumber: string; id: string } | null = null;
  let linkedTransaction: { id: string; table: string } | null = null;
  try {
    const sourceReference = buildFinanceSourceReference('sales', 'invoice_payment', String(payment.id));
    const tenderAccount =
      paymentMethod === 'BANK'
        ? await resolveFinancePostingAccount(ctx.organizationId, 'BANK_ACCOUNT', { fallbackAccountCode: '1120' })
        : paymentMethod === 'PETTY_CASH'
          ? await resolveFinancePostingAccount(ctx.organizationId, 'PETTY_CASH_ACCOUNT', { fallbackAccountCode: '1130' })
          : await resolveFinancePostingAccount(ctx.organizationId, 'CASH_ACCOUNT', { fallbackAccountCode: '1110' });
    const receivableAccount = await resolveFinancePostingAccount(ctx.organizationId, 'ACCOUNTS_RECEIVABLE', { fallbackAccountCode: '1140' });

    journal = await postFinanceDocument({
      createdBy: ctx.userId,
      description: `Customer payment for invoice ${String(inv.invoice_number ?? params.id)}`,
      journalDate: body.paymentDate,
      lines: [
        {
          accountId: tenderAccount.id,
          creditAmount: 0,
          debitAmount: Number(body.amount),
          description: `Customer payment via ${paymentMethod}`,
        },
        {
          accountId: receivableAccount.id,
          creditAmount: Number(body.amount),
          debitAmount: 0,
          description: `Reduce accounts receivable for invoice ${String(inv.invoice_number ?? params.id)}`,
        },
      ],
      organizationId: ctx.organizationId,
      sourceDocumentId: String(payment.id),
      sourceDocumentType: 'invoice_payment',
      sourceModule: 'sales',
    });

    if (paymentMethod === 'BANK' || paymentMethod === 'CASH' || paymentMethod === 'PETTY_CASH') {
      linkedTransaction = await createLinkedFinanceTransaction({
        amount: Number(body.amount),
        createdBy: ctx.userId,
        description: `Customer payment for invoice ${String(inv.invoice_number ?? params.id)}`,
        direction: 'IN',
        organizationId: ctx.organizationId,
        paymentMethod: paymentMethod as 'BANK' | 'CASH' | 'PETTY_CASH',
        referenceNumber: body.referenceNumber ?? null,
        sourceDocument: sourceReference,
        transactionDate: body.paymentDate,
      });
    }
  } catch (postingError) {
    return serverError(postingError instanceof Error ? postingError.message : 'Failed to post invoice payment to finance.');
  }

  return NextResponse.json({
    invoice: updatedInvoice,
    payment,
    journal,
    linkedTransaction,
  });
}
