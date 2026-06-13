import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { listReportExportHistory } from '@/lib/reporting-server';

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read')) return forbidden();

  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') ?? 'mine';

  try {
    const history = await listReportExportHistory(scope === 'all' && can(ctx, 'view_audit_logs') ? undefined : ctx.userId);
    return NextResponse.json(history);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load export history.');
  }
}
