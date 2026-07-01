import { NextRequest } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, unauthorized } from '@/lib/api-auth';

export async function POST(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (!can(ctx, 'stores.grn.create', 'procurement.write', 'goods_received.create')) return forbidden();

  return badRequest('Direct stock receipt is disabled. Receive supplier stock through the GRN workflow instead.');
}
