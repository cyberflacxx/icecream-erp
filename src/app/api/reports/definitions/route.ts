import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { listReportDefinitions } from '@/lib/reporting-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read')) return forbidden();

  const definitions = await listReportDefinitions();
  return NextResponse.json(definitions);
}
