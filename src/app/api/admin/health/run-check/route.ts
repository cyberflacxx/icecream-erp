import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { runSystemHealthCheck } from '@/lib/admin-readiness-server';

export async function POST(request: NextRequest) {
  const auth = await requireAdminAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    return adminResponse(await runSystemHealthCheck(auth.ctx), 201);
  } catch (error) {
    return adminError(error);
  }
}
