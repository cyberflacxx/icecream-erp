import { NextRequest } from 'next/server';

import {
  createNumberSeriesResponse,
  handleSettingsError,
  listOrganizationTable,
  requireSettingsAccess,
} from '@/app/api/settings/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    return await listOrganizationTable(
      'number_series',
      auth.ctx.organizationId,
      'id, series_type, prefix, last_number, padding, is_active, reset_frequency, created_at, updated_at',
    );
  } catch (error) {
    return handleSettingsError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    return await createNumberSeriesResponse({
      body: (await request.json()) as {
        isActive?: boolean;
        lastNumber?: number;
        padding?: number;
        prefix: string;
        resetFrequency?: string;
        seriesType: string;
      },
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
