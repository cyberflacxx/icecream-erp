import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { listDataIntegrityIssues } from '@/lib/admin-readiness-server';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    return adminResponse(await listDataIntegrityIssues(auth.ctx.organizationId));
  } catch (error) {
    return adminError(error);
  }
}
