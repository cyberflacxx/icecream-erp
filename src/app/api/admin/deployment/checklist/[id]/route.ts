import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { updateDeploymentChecklistItem } from '@/lib/admin-readiness-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    return adminResponse(await updateDeploymentChecklistItem(id, await request.json(), auth.ctx));
  } catch (error) {
    return adminError(error);
  }
}
