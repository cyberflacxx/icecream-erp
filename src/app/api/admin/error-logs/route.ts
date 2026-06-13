import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { listErrorLogs } from '@/lib/admin-readiness-server';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    return adminResponse(await listErrorLogs(auth.ctx.organizationId));
  } catch (error) {
    return adminError(error);
  }
}
