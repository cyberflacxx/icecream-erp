import { NextResponse } from 'next/server';

import { apiServerError, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { loadFinanceMetaResources, syncBranchCostCentres } from '@/lib/finance-foundation-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.read')) return forbidden();

  try {
    await syncBranchCostCentres(ctx.organizationId).catch(() => []);
    const payload = await loadFinanceMetaResources(ctx.organizationId);
    return NextResponse.json(payload);
  } catch (error) {
    return apiServerError({
      ctx,
      error,
      message: 'Finance accounts could not be loaded for this organization.',
      module: 'finance.meta',
      path: '/api/finance/meta',
      status: 500,
    });
  }
}
