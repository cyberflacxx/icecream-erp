import { NextRequest } from 'next/server';

import { badRequest } from '@/lib/api-auth';
import { settingsService } from '@/lib/settings-server';
import { exportSettingsDataResponse, handleSettingsError, requireSettingsAccess } from '@/app/api/settings/_helpers';

async function getExportRows(dataType: string, organizationId: string) {
  const service = settingsService();

  switch (dataType) {
    case 'units_of_measure': {
      const { data, error } = await service
        .from('units_of_measure')
        .select('code, name, abbreviation, unit_type, is_base_unit, is_active')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
    case 'item_categories': {
      const { data, error } = await service
        .from('item_categories')
        .select('code, name, description, stock_category, is_active')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
    case 'products': {
      const { data, error } = await service
        .from('items')
        .select('code, name, description, item_type, unit_cost, selling_price, reorder_level, reorder_quantity')
        .eq('organization_id', organizationId)
        .eq('item_type', 'FINISHED_GOOD')
        .is('deleted_at', null)
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
    case 'raw_materials': {
      const { data, error } = await service
        .from('items')
        .select('code, name, description, item_type, unit_cost, reorder_level, reorder_quantity')
        .eq('organization_id', organizationId)
        .eq('item_type', 'RAW_MATERIAL')
        .is('deleted_at', null)
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
    case 'payment_methods': {
      const { data, error } = await service
        .from('settings_payment_methods')
        .select('code, name, description, is_active')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
    case 'tax_codes': {
      const { data, error } = await service
        .from('tax_rates')
        .select('code, name, rate, applies_to_sales, applies_to_purchase, is_active')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('code', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
    default:
      return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dataType: string }> },
) {
  const auth = await requireSettingsAccess('read', request);
  if ('error' in auth) return auth.error;

  try {
    const { dataType } = await context.params;
    const rows = await getExportRows(dataType, auth.ctx.organizationId);
    if (!rows) return badRequest(`Unsupported export type: ${dataType}`);

    return await exportSettingsDataResponse({
      dataType,
      fileName: `${dataType}-${new Date().toISOString().slice(0, 10)}.csv`,
      organizationId: auth.ctx.organizationId,
      rows: rows as Array<Record<string, unknown>>,
      userId: auth.ctx.userId,
    });
  } catch (error) {
    return handleSettingsError(error);
  }
}
