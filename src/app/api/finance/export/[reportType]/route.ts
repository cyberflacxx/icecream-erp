import { NextRequest, NextResponse } from 'next/server';

import { can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import { buildFinanceReportCsv } from '@/lib/finance';

const REPORT_ENDPOINTS: Record<string, string> = {
  'balance-sheet': '/api/finance/reports/balance-sheet',
  'branch-profitability': '/api/finance/reports/branch-profitability',
  'branch-costing': '/api/finance/reports/branch-costing',
  'budget-variance': '/api/finance/reports/budget-variance',
  'cash-flow': '/api/finance/reports/cash-flow',
  'cost-of-goods-sold': '/api/finance/reports/cost-of-goods-sold',
  'general-ledger': '/api/finance/reports/general-ledger',
  'inventory-valuation': '/api/finance/reports/inventory-valuation',
  payables: '/api/finance/reports/payables',
  'payables-ageing': '/api/finance/reports/payables-ageing',
  'profit-and-loss': '/api/finance/reports/profit-and-loss',
  'production-costing': '/api/finance/reports/production-costing',
  receivables: '/api/finance/reports/receivables',
  'receivables-ageing': '/api/finance/reports/receivables-ageing',
  tax: '/api/finance/reports/tax',
  'trial-balance': '/api/finance/reports/trial-balance',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportType: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'reports.read', 'finance.read')) return forbidden();

  const { reportType } = await params;
  const endpoint = REPORT_ENDPOINTS[reportType];
  if (!endpoint) return NextResponse.json({ error: 'Unsupported report type' }, { status: 400 });

  try {
    const baseUrl = new URL(request.url).origin;
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: request.headers,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(await response.text());

    const rows = await response.json() as Array<Record<string, unknown>>;
    const csv = buildFinanceReportCsv(rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Disposition': `attachment; filename="finance-${reportType}.csv"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Internal server error');
  }
}
