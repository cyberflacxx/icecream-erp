import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';
import { recordReportRun } from '@/lib/reporting-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'export', 'reports.read')) return forbidden();

  const url = new URL(request.url);
  const reportType = url.searchParams.get('reportType') ?? 'report';

  await recordReportRun({
    branchId: ctx.branchId,
    category: 'legacy',
    filters: Object.fromEntries(url.searchParams.entries()),
    format: 'PDF',
    reportType,
    status: 'SCHEDULED',
    userProfileId: ctx.userId,
  });

  return NextResponse.json({ message: 'PDF export queued. Generate through existing print support if PDF rendering is not configured.' });
}
