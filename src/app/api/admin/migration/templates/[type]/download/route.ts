import { NextRequest } from 'next/server';

import { adminError, adminResponse, requireAdminAccess } from '@/app/api/admin/_helpers';
import { downloadMigrationTemplate } from '@/lib/admin-readiness-server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const auth = await requireAdminAccess('read', request);
  if ('error' in auth) return auth.error;
  try {
    const { type } = await params;
    return adminResponse(await downloadMigrationTemplate(type));
  } catch (error) {
    return adminError(error);
  }
}
