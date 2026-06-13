import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { findReportDefinition, toReportCsv, validateReportDateRange } from '@/lib/reporting';
import { flattenRows, getReportLabel, recordReportExport, recordReportRun } from '@/lib/reporting-server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ category: string; reportType: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return unauthorized();
  if (!can(ctx, 'export', 'reports.read')) return forbidden();

  const { category, reportType } = await params;
  const definition = findReportDefinition(category, reportType);
  if (!definition) {
    return NextResponse.json({ error: 'Unsupported report type.' }, { status: 400 });
  }

  if (!can(ctx, definition.requiredPermission, 'export')) {
    return forbidden();
  }

  const url = new URL(request.url);
  try {
    validateReportDateRange(url.searchParams.get('startDate'), url.searchParams.get('endDate'));

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
    const rows = flattenRows(payload);
    const filters = Object.fromEntries(url.searchParams.entries());
    const generatedAt = new Date().toISOString();
    const fileName = `${category}-${reportType}-${generatedAt.slice(0, 10)}.csv`;
    const csv = toReportCsv({
      filters,
      generatedAt,
      generatedBy: ctx.workId,
      rows,
      title: getReportLabel(definition),
    });

    await Promise.all([
      recordReportRun({
        branchId: ctx.branchId,
        category,
        filters,
        format: 'CSV',
        reportType,
        status: 'EXPORTED',
        userProfileId: ctx.userId,
      }),
      recordReportExport({
        branchId: ctx.branchId,
        category,
        fileName,
        filters,
        format: 'CSV',
        organizationId: ctx.organizationId,
        reportType,
        userProfileId: ctx.userId,
      }),
    ]);

    return new NextResponse(csv, {
      headers: {
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to export report.');
  }
}
