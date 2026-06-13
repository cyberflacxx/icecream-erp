import { NextRequest } from 'next/server';

import { createTaxCodeResponse, handleSettingsError, listOrganizationTable, requireSettingsAccess } from '@/app/api/settings/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    return await listOrganizationTable(
      'tax_rates',
      auth.ctx.organizationId,
      'id, code, name, rate, is_active, applies_to_sales, applies_to_purchase, account_id, created_at',
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
