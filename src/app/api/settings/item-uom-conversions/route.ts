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
      'item_uom_conversions',
      auth.ctx.organizationId,
      'id, item_id, from_uom_id, to_uom_id, conversion_factor, notes, is_active, created_at, updated_at',
    );
  } catch (error) {
    return handleSettingsError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      conversionFactor: number;
      fromUnitId: string;
      isActive?: boolean;
      itemId: string;
      notes?: string;
      toUnitId: string;
    };

    return await createUnitConversionResponse({
      body,
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
