import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { getMigrationBatch } from '@/lib/admin-readiness-server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const auth = await requireAdminAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    const { batchId } = await params;
    return adminResponse(await getMigrationBatch(batchId, auth.ctx.organizationId));
  } catch (error) {
    return adminError(error);
  }
}
