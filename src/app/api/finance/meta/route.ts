import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
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
    return serverError(error instanceof Error ? error.message : 'Failed to load finance metadata.');
  }
}
