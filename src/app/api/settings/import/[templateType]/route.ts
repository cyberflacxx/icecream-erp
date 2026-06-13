import { NextRequest } from 'next/server';

import { badRequest } from '@/lib/api-auth';
import { settingsService } from '@/lib/settings-server';
import { handleSettingsError, importTemplateResponse, requireSettingsAccess } from '@/app/api/settings/_helpers';

async function fetchExistingCodes(table: string, organizationId: string, column = 'code') {
  const { data, error } = await settingsService().from(table).select(column).eq('organization_id', organizationId);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => String(row[column] ?? ''));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ templateType: string }> },
) {
  const auth = await requireSettingsAccess('write', request);
  if ('error' in auth) return auth.error;

  try {
    const { templateType } = await context.params;
    const body = (await request.json()) as {
      fileName?: string;
      rows?: Array<Record<string, string | number | boolean | null | undefined>>;
    };

    switch (templateType) {
      case 'units_of_measure':
        return await importTemplateResponse({
          body,
          existingCodes: await fetchExistingCodes('units_of_measure', auth.ctx.organizationId),
          mapper: (row, meta) => ({
            abbreviation: String(row.abbreviation ?? row.code ?? ''),
            code: String(row.code ?? row.abbreviation ?? ''),
            is_active: row.is_active !== false,
            is_base_unit: String(row.is_base_unit ?? '').toLowerCase() === 'true' || row.is_base_unit === true,
            name: String(row.name ?? ''),
            organization_id: meta.organizationId,
            unit_type: String(row.unit_type ?? 'GENERAL'),
          }),
          moduleName: 'settings',
          table: 'units_of_measure',
          templateType,
          organizationId: auth.ctx.organizationId,
          userId: auth.ctx.userId,
        });
      case 'item_categories':
        return await importTemplateResponse({
          body,
          existingCodes: await fetchExistingCodes('item_categories', auth.ctx.organizationId),
          mapper: (row, meta) => ({
            code: String(row.code ?? row.name ?? ''),
            description: row.description ? String(row.description) : null,
            is_active: row.is_active !== false,
            name: String(row.name ?? ''),
            organization_id: meta.organizationId,
            stock_category: String(row.stock_category ?? row.name ?? ''),
          }),
          moduleName: 'settings',
          table: 'item_categories',
          templateType,
          organizationId: auth.ctx.organizationId,
          userId: auth.ctx.userId,
        });
      case 'payment_methods':
        return await importTemplateResponse({
          body,
          existingCodes: await fetchExistingCodes('settings_payment_methods', auth.ctx.organizationId),
          mapper: (row, meta) => ({
            code: String(row.code ?? row.name ?? ''),
            created_by: meta.userId,
            description: row.description ? String(row.description) : null,
            is_active: row.is_active !== false,
            name: String(row.name ?? ''),
            organization_id: meta.organizationId,
            updated_by: meta.userId,
          }),
          moduleName: 'finance',
          table: 'settings_payment_methods',
          templateType,
          organizationId: auth.ctx.organizationId,
          userId: auth.ctx.userId,
        });
      case 'tax_codes':
        return await importTemplateResponse({
          body,
          existingCodes: await fetchExistingCodes('tax_rates', auth.ctx.organizationId),
          mapper: (row, meta) => ({
            applies_to_purchase: String(row.applies_to_purchase ?? 'true').toLowerCase() !== 'false',
            applies_to_sales: String(row.applies_to_sales ?? 'true').toLowerCase() !== 'false',
            code: String(row.code ?? ''),
            is_active: row.is_active !== false,
            name: String(row.name ?? ''),
            organization_id: meta.organizationId,
            rate: Number(row.rate ?? 0),
          }),
          moduleName: 'finance',
          nonNegativeColumns: ['rate'],
          table: 'tax_rates',
          templateType,
          organizationId: auth.ctx.organizationId,
          userId: auth.ctx.userId,
        });
      case 'number_series':
        return await importTemplateResponse({
          body,
          existingCodes: await fetchExistingCodes('number_series', auth.ctx.organizationId, 'series_type'),
          mapper: (row, meta) => ({
            is_active: row.is_active !== false,
            last_number: Number(row.last_number ?? 0),
            organization_id: meta.organizationId,
            padding: Number(row.padding ?? 4),
            prefix: String(row.prefix ?? ''),
            reset_frequency: String(row.reset_frequency ?? 'NEVER'),
            series_type: String(row.code ?? row.series_type ?? ''),
          }),
          moduleName: 'settings',
          nonNegativeColumns: ['last_number', 'padding'],
          requiredColumns: ['code', 'prefix'],
          table: 'number_series',
          templateType,
          organizationId: auth.ctx.organizationId,
          userId: auth.ctx.userId,
        });
      default:
        return badRequest(`Unsupported import template: ${templateType}`);
    }
  } catch (error) {
    return handleSettingsError(error);
  }
}
