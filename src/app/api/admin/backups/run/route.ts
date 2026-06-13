import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { runBackup } from '@/lib/admin-readiness-server';

export async function POST(request: NextRequest) {
  const auth = await requireAdminAccess('write', request);
  if ('error' in auth) return auth.error;
  try {
    return adminResponse(await runBackup(auth.ctx, await request.json()), 201);
  } catch (error) {
    return adminError(error);
  }
}
