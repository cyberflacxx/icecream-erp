import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeService } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const [sales, purchases, taxCodes] = await Promise.all([
      financeService().from('invoices').select('tax_amount').eq('organization_id', ctx.organizationId).is('deleted_at', null),
      financeService().from('supplier_invoices').select('tax_amount').eq('organization_id', ctx.organizationId).is('deleted_at', null),
      financeService().from('tax_rates').select('code, name, rate').eq('organization_id', ctx.organizationId).is('deleted_at', null),
    ]);
    if (sales.error) throw sales.error;
    if (purchases.error) throw purchases.error;
    if (taxCodes.error) throw taxCodes.error;

    const taxCollected = (sales.data ?? []).reduce((sum, row) => sum + Number(row.tax_amount ?? 0), 0);
    const taxPaid = (purchases.data ?? []).reduce((sum, row) => sum + Number(row.tax_amount ?? 0), 0);

    return NextResponse.json({
      taxCodes: taxCodes.data ?? [],
      taxCollected,
      taxPaid,
      taxPayable: taxCollected - taxPaid,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
