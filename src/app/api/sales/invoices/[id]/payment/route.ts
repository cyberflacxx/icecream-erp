import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

function normalizeInvoiceStatus(amountPaid: number, total: number): string {
  if (amountPaid <= 0) return 'sent';
  if (amountPaid >= total) return 'paid';
  return 'partial_paid';
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
    .select(`id, invoice_number, status, total, amount_paid, balance_due, customer_id, sales_order_id`)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !invoice) return notFound('Invoice not found.');

  const inv = invoice as Record<string, unknown>;

  // Branch scoping check via linked sales order
  if (ctx.isBranchScoped && ctx.branchId && inv.sales_order_id) {
    const { data: order } = await service
      .schema('icecream_erp')
      .from('sales_orders')
      .select('branch_id')
      .eq('id', inv.sales_order_id as string)
      .single();

    const orderBranchId = (order as Record<string, unknown> | null)?.branch_id;
    if (orderBranchId && orderBranchId !== ctx.branchId) {
      return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
    }
  }

  if (inv.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot record payment on cancelled invoice' }, { status: 400 });
  }

  if (inv.status === 'paid') {
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

  // Fetch customer balance
  const { data: customer } = await service
    .schema('icecream_erp')
    .from('customers')
    .select('id, current_balance')
    .eq('id', inv.customer_id as string)
    .single();

  if (!customer) return notFound('Customer not found.');

  const cust = customer as Record<string, unknown>;

  // Generate payment number
  const { count } = await service
    .schema('icecream_erp')
    .from('payments')
    .select('id', { count: 'exact', head: true });

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
      payment_method: body.paymentMethod,
      reference_number: body.referenceNumber ?? null,
      notes: body.notes ?? `Invoice payment for ${inv.invoice_number}`,
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (payErr || !payment) return serverError(payErr?.message ?? 'Failed to create payment');

  // Update invoice amounts and status
  const prevAmountPaid = Number(inv.amount_paid ?? 0);
  const total = Number(inv.total ?? 0);
  const nextAmountPaid = prevAmountPaid + body.amount;
  const nextBalanceDue = Math.max(0, total - nextAmountPaid);
  const nextStatus = normalizeInvoiceStatus(nextAmountPaid, total);

  const { data: updatedInvoice, error: invErr } = await service
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

  if (invErr) return serverError(invErr.message);

  // Reduce customer balance
  const nextCustomerBalance = Math.max(0, Number(cust.current_balance ?? 0) - body.amount);
  await service
    .schema('icecream_erp')
    .from('customers')
    .update({ current_balance: nextCustomerBalance, updated_at: new Date().toISOString() })
    .eq('id', cust.id as string);

  return NextResponse.json({
    invoice: updatedInvoice,
    payment,
  });
}
