import { NextRequest } from 'next/server';

import {
  createUnitConversionResponse,
  handleSettingsError,
  listOrganizationTable,
  requireSettingsAccess,
} from '@/app/api/settings/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    return await listOrganizationTable(
      'unit_conversions',
      auth.ctx.organizationId,
      'id, from_unit_id, to_unit_id, conversion_factor, notes, is_active, created_at',
    );
  } catch (error) {
    return handleSettingsError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    return await createUnitConversionResponse({
      body: (await request.json()) as {
        conversionFactor: number;
        fromUnitId: string;
        isActive?: boolean;
        notes?: string;
        toUnitId: string;
      },
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
