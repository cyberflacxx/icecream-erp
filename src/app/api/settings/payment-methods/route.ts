import { NextRequest } from 'next/server';

import {
  createSimpleMasterDataResponse,
  handleSettingsError,
  listOrganizationTable,
  requireSettingsAccess,
} from '@/app/api/settings/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    return await listOrganizationTable(
      'settings_payment_methods',
      auth.ctx.organizationId,
      'id, code, name, description, is_active, created_at',
    );
  } catch (error) {
    return handleSettingsError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    return await createSimpleMasterDataResponse({
      action: 'PAYMENT_METHOD_CREATED',
      body: (await request.json()) as { code?: string; description?: string; isActive?: boolean; name: string },
      entityType: 'payment_method',
      organizationId: auth.ctx.organizationId,
      table: 'settings_payment_methods',
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
