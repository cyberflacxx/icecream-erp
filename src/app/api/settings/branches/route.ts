import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { handleSettingsError, requireSettingsAccess } from '@/app/api/settings/_helpers';
import { settingsService } from '@/lib/settings-server';

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    const { data, error } = await settingsService()
      .from('branches')
      .select('id, code, name, branch_type, city, country, is_active, created_at')
      .eq('organization_id', auth.ctx.organizationId)
      .is('deleted_at', null)
      .order('name', { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    return handleSettingsError(error);
  }
}
