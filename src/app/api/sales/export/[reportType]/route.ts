import { NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildSalesReportCsv } from '@/lib/sales';

async function fetchReport(request: Request, reportType: string) {
  const url = new URL(request.url);
  const origin = url.origin || 'http://localhost:3000';
  const target = `${origin}/api/sales/reports/${reportType}${url.search}`;
  const response = await fetch(target, {
    headers: { cookie: request.headers.get('cookie') ?? '' },
  });
  if (!response.ok) throw new Error(`Unable to export ${reportType} report.`);
  return response.json() as Promise<Array<Record<string, unknown>>>;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportType: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'sales.read', 'reports.read')) return forbidden();

  try {
    const { reportType } = await params;
    const rows = await fetchReport(request, reportType);
    const csv = buildSalesReportCsv(rows);
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        'Content-Disposition': `attachment; filename="sales-${reportType}-${dateStamp}.csv"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
