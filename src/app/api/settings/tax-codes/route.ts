import { NextRequest, NextResponse } from 'next/server';

import { createTaxCodeResponse, handleSettingsError, listOrganizationTable, requireSettingsAccess } from '@/app/api/settings/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    const response = await listOrganizationTable(
      'tax_rates',
      auth.ctx.organizationId,
      'id, code, name, rate, is_active, applies_to_sales, applies_to_purchase, applies_to_purchases, tax_account_id, created_at',
    );
    const rows = await response.json() as Array<Record<string, unknown>>;

    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        account_id: row.account_id ?? row.tax_account_id ?? null,
        applies_to_purchase: row.applies_to_purchase ?? row.applies_to_purchases ?? false,
      })),
    );
  } catch (error) {
    return handleSettingsError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    return await createTaxCodeResponse({
      body: (await request.json()) as {
        accountId?: string;
        appliesToPurchase?: boolean;
        appliesToSales?: boolean;
        code: string;
        isActive?: boolean;
        name: string;
        rate: number;
      },
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
