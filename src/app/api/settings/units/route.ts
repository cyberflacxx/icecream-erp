import { NextRequest } from 'next/server';

import { createUnitResponse, handleSettingsError, listOrganizationTable, requireSettingsAccess } from '@/app/api/settings/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    return await listOrganizationTable(
      'units_of_measure',
      auth.ctx.organizationId,
      'id, code, name, abbreviation, unit_type, is_base_unit, is_active, created_at, updated_at',
    );
  } catch (error) {
    return handleSettingsError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    return await createUnitResponse({
      body: (await request.json()) as {
        abbreviation: string;
        code?: string;
        isActive?: boolean;
        isBaseUnit?: boolean;
        name: string;
        unitType?: string;
      },
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
