import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { validateBranchCustomerImportRows } from '@/lib/branches';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'branches.write', 'sales.write')) return forbidden();
  try {
    const body = await request.json() as { rows?: Array<Record<string, unknown>> };
    const result = validateBranchCustomerImportRows(body.rows ?? []);
    return NextResponse.json(result);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
