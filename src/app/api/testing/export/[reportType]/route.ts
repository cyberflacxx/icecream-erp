import { NextRequest, NextResponse } from 'next/server';

import { exportTestingReport } from '@/lib/testing-server';
import { requireTestingAccess, testingError } from '@/app/api/testing/_helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ reportType: string }> }) {
  const auth = await requireTestingAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    const { reportType } = await params;
    const csv = await exportTestingReport(auth.ctx, reportType);
    return new NextResponse(csv, {
      headers: {
        'Content-Disposition': `attachment; filename="testing-${reportType}.csv"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (error) {
    return testingError(error);
  }
}
