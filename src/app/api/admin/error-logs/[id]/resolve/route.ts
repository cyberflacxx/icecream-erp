import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { resolveErrorLog } from '@/lib/admin-readiness-server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    return adminResponse(await resolveErrorLog(id, auth.ctx));
  } catch (error) {
    return adminError(error);
  }
}
