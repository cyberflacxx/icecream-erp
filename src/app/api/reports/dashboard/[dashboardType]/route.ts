import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { DASHBOARD_ROUTES } from '@/lib/reporting';
import { recordReportRun } from '@/lib/reporting-server';

export async function GET(request: Request, { params }: { params: Promise<{ dashboardType: string }> }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read')) return forbidden();

  const { dashboardType } = await params;
  const target = DASHBOARD_ROUTES[dashboardType];
  if (!target) {
    return NextResponse.json({ error: 'Unsupported dashboard.' }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const response = await fetch(`${url.origin}${target}${url.search}`, {
      cache: 'no-store',
      headers: request.headers,
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }

    const payload = await response.json();
    await recordReportRun({
      category: 'dashboard',
      filters: Object.fromEntries(url.searchParams.entries()),
      reportType: dashboardType,
      status: 'READY',
      userProfileId: ctx.userId,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load dashboard.');
  }
}
