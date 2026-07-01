import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { GET as getFinanceIntegrity } from '@/app/api/admin/integrity/finance/route';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.integrity.repair', 'finance.write', 'settings.manage')) return forbidden();

  try {
    const response = await getFinanceIntegrity(request);
    const issues = await response.json();
    return NextResponse.json({
      canAutoRepair: false,
      issues,
      summary: {
        high: issues.filter((issue: { severity?: string }) => issue.severity === 'high').length,
        low: issues.filter((issue: { severity?: string }) => issue.severity === 'low').length,
        medium: issues.filter((issue: { severity?: string }) => issue.severity === 'medium').length,
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to build finance repair preview.');
  }
}
