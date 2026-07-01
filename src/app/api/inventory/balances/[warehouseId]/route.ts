import { NextRequest } from 'next/server';

import { GET as getStockBalances } from '@/app/api/inventory/stock-balances/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ warehouseId: string }> },
) {
  const { warehouseId } = await params;
  const url = new URL(request.url);
  url.searchParams.set('warehouseId', warehouseId);

  return getStockBalances(new NextRequest(url, {
    headers: request.headers,
    method: request.method,
  }));
}
