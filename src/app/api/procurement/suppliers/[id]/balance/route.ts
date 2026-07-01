import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'procurement.supplier.view', 'supplier.read', 'procurement.read', 'finance.read')) return forbidden();

  const { id } = await params;
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('suppliers')
    .select('id, code, name, credit_limit, current_balance, payment_terms, status')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .eq('id', id)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Supplier not found.');

  return NextResponse.json({
    availableCredit: Math.max(0, Number(data.credit_limit ?? 0) - Number(data.current_balance ?? 0)),
    code: data.code,
    creditLimit: Number(data.credit_limit ?? 0),
    currentBalance: Number(data.current_balance ?? 0),
    paymentTerms: data.payment_terms ?? null,
    status: data.status,
    supplierId: data.id,
    supplierName: data.name,
  });
}
