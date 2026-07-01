import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { loadCustomerBalanceSnapshot } from '@/lib/sales-customers';
import { salesService } from '@/lib/sales-server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.customer.balance', 'sales.customer.view', 'finance.read')) return forbidden();

  try {
    const service = salesService();
    const { data: customer, error } = await service
      .from('customers')
      .select('id, code, name, payment_terms, credit_limit, current_balance, status')
      .eq('organization_id', ctx.organizationId)
      .eq('id', params.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!customer) return notFound('Customer not found.');

    const balance = await loadCustomerBalanceSnapshot(
      service,
      String(customer.id),
      customer.current_balance,
      customer.credit_limit,
      customer.payment_terms,
    );

    return NextResponse.json({
      availableCredit: balance.availableCredit,
      creditAllowed: balance.creditAllowed,
      creditLimit: balance.creditLimit,
      customerCode: customer.code,
      customerId: customer.id,
      customerName: customer.name,
      outstandingBalance: balance.outstandingBalance,
      status: customer.status,
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load customer balance.');
  }
}
