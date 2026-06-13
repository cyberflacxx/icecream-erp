import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { postOpeningBalances } from '@/lib/admin-readiness-server';

export async function POST(request: NextRequest) {
  const auth = await requireAdminAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    return adminResponse(await postOpeningBalances(auth.ctx));
  } catch (error) {
    return adminError(error);
  }
}
