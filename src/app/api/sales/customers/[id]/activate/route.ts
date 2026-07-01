import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { salesService, writeSalesAuditLog } from '@/lib/sales-server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.customer.activate', 'sales.write')) return forbidden();

  try {
    const service = salesService();
    const { data, error } = await service
      .from('customers')
      .update({ status: 'ACTIVE' })
      .eq('organization_id', ctx.organizationId)
      .eq('id', params.id)
      .is('deleted_at', null)
      .select('id, status')
      .maybeSingle();
    if (error) throw error;
    if (!data) return notFound('Customer not found.');

    await writeSalesAuditLog('SALES_CUSTOMER_ACTIVATED', String(data.id), ctx.userId, { status: 'ACTIVE' }, 'customer');
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to activate customer.');
  }
}
