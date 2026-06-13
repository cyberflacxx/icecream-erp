import { NextRequest } from 'next/server';

import {
  createCategoryResponse,
  handleSettingsError,
  listOrganizationTable,
  requireSettingsAccess,
} from '@/app/api/settings/_helpers';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    return await listOrganizationTable(
      'item_categories',
      auth.ctx.organizationId,
      'id, code, name, description, stock_category, is_active, created_at, updated_at',
    );
  } catch (error) {
    return handleSettingsError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    return await createCategoryResponse({
      body: (await request.json()) as {
        code?: string;
        description?: string;
        isActive?: boolean;
        name: string;
        stockCategory?: string;
      },
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
