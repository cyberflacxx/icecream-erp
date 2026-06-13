import { NextRequest } from 'next/server';

import { getImportHistoryResponse, handleSettingsError, requireSettingsAccess } from '@/app/api/settings/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    return await getImportHistoryResponse(auth.ctx.organizationId);
  } catch (error) {
    return handleSettingsError(error);
  }
}
