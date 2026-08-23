import { NextRequest, NextResponse } from 'next/server';

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
    const response = await listOrganizationTable(
      'settings_payment_methods',
      auth.ctx.organizationId,
      'id, code, name, payment_type, posting_role, requires_reference, is_active, created_at',
    );
    const rows = await response.json() as Array<Record<string, unknown>>;

    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        description: [
          row.payment_type ? String(row.payment_type) : null,
          row.posting_role ? `Role ${String(row.posting_role)}` : null,
          row.requires_reference === true ? 'Reference required' : null,
        ].filter(Boolean).join(' | ') || null,
      })),
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
