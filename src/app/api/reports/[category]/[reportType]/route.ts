import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { findReportDefinition, validateReportDateRange } from '@/lib/reporting';
import { recordReportRun } from '@/lib/reporting-server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ category: string; reportType: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read')) return forbidden();

  const { category, reportType } = await params;
  const definition = findReportDefinition(category, reportType);
  if (!definition) {
    return NextResponse.json({ error: 'Unsupported report type.' }, { status: 400 });
  }

  if (!can(ctx, definition.requiredPermission, 'reports.read')) {
    return forbidden();
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  try {
    validateReportDateRange(startDate, endDate);

    const queryPrefix = definition.path.includes('?') ? '&' : '?';
    const target = `${url.origin}${definition.path}${url.search ? `${queryPrefix}${url.search.slice(1)}` : ''}`;
    const response = await fetch(target, {
      cache: 'no-store',
      headers: request.headers,
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }

    const payload = await response.json();
    await recordReportRun({
      branchId: ctx.branchId,
      category,
      filters: Object.fromEntries(url.searchParams.entries()),
      reportType,
      status: 'READY',
      userProfileId: ctx.userId,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to load report.');
  }
}
