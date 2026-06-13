import { NextRequest } from 'next/server';

import {
  getSystemSettingsResponse,
  handleSettingsError,
  requireSettingsAccess,
  upsertSystemSettingsResponse,
} from '@/app/api/settings/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    return await getSystemSettingsResponse(auth.ctx.organizationId);
  } catch (error) {
    return handleSettingsError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as { settings?: Array<Record<string, unknown>> };
    return await upsertSystemSettingsResponse({
      settings: body.settings ?? [],
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
