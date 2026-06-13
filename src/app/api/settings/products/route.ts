import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createItemResponse, handleSettingsError, requireSettingsAccess } from '@/app/api/settings/_helpers';
import { settingsService } from '@/lib/settings-server';

async function listItems(itemType: string, organizationId: string) {
  const { data, error } = await settingsService()
    .from('items')
    .select('id, code, name, description, item_type, unit_cost, selling_price, reorder_level, reorder_quantity, is_active, track_expiry, category:item_categories(name), unit:units_of_measure(name, abbreviation)')
    .eq('organization_id', organizationId)
    .eq('item_type', itemType)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function GET(request: NextRequest) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    return NextResponse.json(await listItems('FINISHED_GOOD', auth.ctx.organizationId));
  } catch (error) {
    return handleSettingsError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    return await createItemResponse({
      body: { ...((await request.json()) as Record<string, unknown>), itemType: 'FINISHED_GOOD' } as {
        categoryId: string;
        code: string;
        description?: string;
        isActive?: boolean;
        itemType: string;
        name: string;
        reorderLevel?: number;
        reorderQuantity?: number;
        sellingPrice?: number;
        trackExpiry?: boolean;
        unitCost?: number;
        unitOfMeasureId: string;
      },
      organizationId: auth.ctx.organizationId,
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
