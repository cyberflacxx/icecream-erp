import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { createOpeningPartyBalance, listOpeningBalances } from '@/lib/admin-readiness-server';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    return adminResponse(await listOpeningBalances('suppliers', auth.ctx.organizationId));
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    return adminResponse(await createOpeningPartyBalance('suppliers', await request.json(), auth.ctx), 201);
  } catch (error) {
    return adminError(error);
  }
}
