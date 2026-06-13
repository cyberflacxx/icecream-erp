import { NextRequest } from 'next/server';

import { handleSettingsError, requireSettingsAccess, seedDefaultsResponse } from '@/app/api/settings/_helpers';

export async function POST(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    return await seedDefaultsResponse({
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
