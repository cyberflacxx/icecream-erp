import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { validateChartOfAccountImportRows } from '@/lib/finance';

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'finance.write')) return forbidden();

  const body = await request.json() as { rows?: Array<Record<string, unknown>> };
  if (!body.rows) return badRequest('rows are required');
  return NextResponse.json(validateChartOfAccountImportRows(body.rows));
}
