import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { validateMigrationBatch } from '@/lib/admin-readiness-server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const auth = await requireAdminAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    const { batchId } = await params;
    return adminResponse(await validateMigrationBatch(batchId, auth.ctx));
  } catch (error) {
    return adminError(error);
  }
}
