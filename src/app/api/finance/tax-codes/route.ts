import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { financeErrorMessage, financeService, isMissingFinanceTable, writeFinanceAuditLog } from '@/lib/finance-server';

export async function GET(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    const { data, error } = await financeService()
      .from('tax_rates')
      .select('id, code, name, rate, is_active, applies_to_sales, applies_to_purchase, applies_to_purchases, tax_account_id')
      .eq('organization_id', ctx.organizationId)
      .is('deleted_at', null)
      .order('code', { ascending: true });
    if (error) throw error;
    return NextResponse.json((data ?? []).map((row) => ({
      ...row,
      account_id: row.tax_account_id ?? null,
      applies_to_purchase: row.applies_to_purchase ?? row.applies_to_purchases ?? true,
    })));
  } catch (err) {
    if (isMissingFinanceTable(err)) return NextResponse.json([]);
    return serverError(financeErrorMessage(err) || 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  try {
    const body = await request.json() as {
      accountId?: string;
      appliesToPurchase?: boolean;
      appliesToSales?: boolean;
      code: string;
      isActive?: boolean;
      name: string;
      rate: number;
    };
    if (!body.code || !body.name || Number(body.rate) < 0) {
      return badRequest('code, name, and a non-negative rate are required');
    }

    const { data, error } = await financeService()
      .from('tax_rates')
      .insert({
        organization_id: ctx.organizationId,
        code: body.code,
        name: body.name,
        rate: body.rate,
        tax_account_id: body.accountId ?? null,
        is_active: body.isActive ?? true,
        applies_to_sales: body.appliesToSales ?? true,
        applies_to_purchase: body.appliesToPurchase ?? true,
      })
      .select()
      .single();
    if (error) throw error;

    await writeFinanceAuditLog('TAX_CODE_CREATED', data.id, ctx.userId, { code: body.code, rate: body.rate }, 'tax_code');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
