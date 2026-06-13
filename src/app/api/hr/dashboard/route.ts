import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { fetchHRDashboardMetrics } from '@/lib/hr-server';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'hr.read', 'reports.read')) return forbidden();

  try {
    const data = await fetchHRDashboardMetrics({
      branchId: ctx.isBranchScoped ? ctx.branchId : null,
      isBranchScoped: ctx.isBranchScoped,
      organizationId: ctx.organizationId,
    });
    return NextResponse.json(data);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load HR dashboard.');
  }
}
