import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { branchService, ensureBranchScope, writeBranchAuditLog } from '@/lib/branches-server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'finance.read')) return forbidden();
  const { id } = await params;

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const { data, error } = await service
      .from('branch_payments')
      .select('id, payment_date, payment_method, amount_paid, reference_number, branch_sale_id, branch_customer_id, status')
      .eq('branch_id', id)
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write', 'finance.write')) return forbidden();
  const { id } = await params;

  try {
    ensureBranchScope(ctx, id);
    const service = branchService();
    const body = await request.json() as {
      amountPaid: number;
      branchCustomerId?: string;
      branchSaleId?: string;
      paymentDate?: string;
      paymentMethod: string;
      referenceNumber?: string;
      shiftCloseId?: string;
    };
    if (!body.amountPaid || !body.paymentMethod) return badRequest('amountPaid and paymentMethod are required');

    const { data, error } = await service
      .from('branch_payments')
      .insert({
        branch_id: id,
        shift_close_id: body.shiftCloseId ?? null,
        branch_sale_id: body.branchSaleId ?? null,
        branch_customer_id: body.branchCustomerId ?? null,
        payment_date: body.paymentDate ?? new Date().toISOString().slice(0, 10),
        payment_method: body.paymentMethod,
        amount_paid: body.amountPaid,
        reference_number: body.referenceNumber ?? null,
        received_by: ctx.userId,
        posted_at: new Date().toISOString(),
        posted_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;

    if (body.branchCustomerId) {
      const { data: customer } = await service.from('branch_customers').select('current_balance').eq('id', body.branchCustomerId).maybeSingle();
      if (customer) {
        await service.from('branch_customers').update({
          current_balance: Math.max(0, Number(customer.current_balance ?? 0) - Number(body.amountPaid)),
          updated_at: new Date().toISOString(),
        }).eq('id', body.branchCustomerId);
      }
    }

    await writeBranchAuditLog('BRANCH_PAYMENT_CREATED', data.id, ctx.userId, { branchId: id, amountPaid: body.amountPaid }, 'branch_payment');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
