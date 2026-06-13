import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildBranchReportCsv } from '@/lib/branches';

const REPORT_ENDPOINTS: Record<string, string> = {
  'cash-up': '/api/branches/reports/cash-up',
  'credit-sales': '/api/branches/reports/credit-sales',
  'daily-sales': '/api/branches/reports/daily-sales',
  expenses: '/api/branches/reports/expenses',
  profitability: '/api/branches/reports/profitability',
  returns: '/api/branches/reports/returns',
  shift: '/api/branches/reports/shift',
  'stock-balance': '/api/branches/reports/stock-balance',
  'stock-movement': '/api/branches/reports/stock-movement',
  variance: '/api/branches/reports/variance',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportType: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read')) return forbidden();

  const { reportType } = await params;
  const endpoint = REPORT_ENDPOINTS[reportType];
  if (!endpoint) return NextResponse.json({ error: 'Unsupported report type' }, { status: 400 });

  try {
    const baseUrl = new URL(request.url).origin;
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: request.headers,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const rows = await response.json() as Array<Record<string, unknown>>;
    const csv = buildBranchReportCsv(rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Disposition': `attachment; filename="branch-${reportType}.csv"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
