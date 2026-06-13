import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { handleSettingsError, requireSettingsAccess } from '@/app/api/settings/_helpers';
import { settingsService } from '@/lib/settings-server';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    const { data, error } = await settingsService()
      .from('warehouses')
      .select('id, code, name, warehouse_type, is_active, branch:branches(name), created_at')
      .eq('organization_id', auth.ctx.organizationId)
      .order('name', { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return handleSettingsError(error);
  }
}
