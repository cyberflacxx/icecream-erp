import { NextRequest, NextResponse } from 'next/server';
import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildFinanceReportCsv } from '@/lib/finance';

const REPORT_ENDPOINTS: Record<string, string> = {
  'damaged-goods': '/api/quality/reports/damaged-goods',
  'expired-goods': '/api/quality/reports/expired-goods',
  'financial-impact': '/api/quality/reports/financial-impact',
  market: '/api/quality/reports/market',
  production: '/api/quality/reports/production',
  'raw-materials': '/api/quality/reports/raw-materials',
  returns: '/api/quality/reports/returns',
  waste: '/api/quality/reports/waste',
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ reportType: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'quality.read')) return forbidden();
  const { reportType } = await params;
  const endpoint = REPORT_ENDPOINTS[reportType];
  if (!endpoint) return NextResponse.json({ error: 'Unsupported report type' }, { status: 400 });
  try {
    const baseUrl = new URL(request.url).origin;
    const response = await fetch(`${baseUrl}${endpoint}`, { headers: request.headers, cache: 'no-store' });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json() as Array<Record<string, unknown>> | Record<string, unknown>;
    const normalized = Array.isArray(rows) ? rows : [rows];
    return new NextResponse(buildFinanceReportCsv(normalized), {
      headers: {
        'Content-Disposition': `attachment; filename="quality-${reportType}.csv"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
