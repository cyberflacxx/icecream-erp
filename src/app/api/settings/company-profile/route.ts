import { NextRequest } from 'next/server';

import {
  getCompanyProfileResponse,
  handleSettingsError,
  requireSettingsAccess,
  updateCompanyProfileResponse,
} from '@/app/api/settings/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    return await getCompanyProfileResponse();
  } catch (error) {
    return handleSettingsError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    return await updateCompanyProfileResponse({
      payload: (await request.json()) as Record<string, unknown>,
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
