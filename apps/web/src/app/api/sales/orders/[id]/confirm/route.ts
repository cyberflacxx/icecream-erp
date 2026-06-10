import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ─── POST /api/sales/orders/[id]/confirm ─────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.write')) return forbidden();

  const service = createServiceRoleClient();

  // Fetch order with customer
  const { data: order, error: fetchErr } = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .select(`*, customers(id, name, payment_terms, credit_limit, current_balance)`)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !order) return notFound('Sales order not found.');

  const o = order as Record<string, unknown>;

  // Branch access check
  if (ctx.isBranchScoped && ctx.branchId && o.branch_id && o.branch_id !== ctx.branchId) {
    return NextResponse.json({ error: 'This role is limited to its assigned branch.' }, { status: 403 });
  }

  if (o.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft sales orders can be confirmed.' }, { status: 400 });
  }

  // Credit limit check if payment terms include "credit"
  const customer = o.customers as Record<string, unknown> | null;
  if (customer) {
    const paymentTerms = String(customer.payment_terms ?? '').toLowerCase();
    if (paymentTerms.includes('credit')) {
      const creditLimit = Number(customer.credit_limit ?? 0);
      if (creditLimit > 0) {
        const currentBalance = Number(customer.current_balance ?? 0);
        const orderTotal = Number(o.total ?? 0);
        const projected = currentBalance + orderTotal;
        if (projected > creditLimit) {
          const available = Math.max(0, creditLimit - currentBalance);
          return NextResponse.json(
            {
              error: `Credit limit exceeded for ${customer.name}. Credit limit: $${creditLimit.toFixed(2)}. Current balance: $${currentBalance.toFixed(2)}. Available credit: $${available.toFixed(2)}. Order total: $${orderTotal.toFixed(2)}.`,
              code: 'CREDIT_LIMIT_EXCEEDED',
            },
            { status: 400 },
          );
        }
      }
    }
  }

  const { data, error } = await service
    .schema('icecream_erp')
    .from('sales_orders')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return serverError(error.message);

  return NextResponse.json(data);
}
