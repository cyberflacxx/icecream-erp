import { NextRequest, NextResponse } from 'next/server';

import { badRequest, can, forbidden, getAuthContext, serverError, unauthorized } from '@/lib/api-auth';
import {
  createMasterDataRecord,
  exportSettingsData,
  fetchSettingsDashboardMetrics,
  generateNextDocumentNumber,
  getCompanyProfile,
  getSettingsImportTemplates,
  importSettingsData,
  recordSettingsExportBatch,
  seedSettingsDefaults,
  updateCompanyProfile,
  upsertSystemSettings,
  writeSettingsAuditLog,
  settingsService,
} from '@/lib/settings-server';
import {
  getSettingsTemplateColumns,
  normalizeCode,
  normalizeName,
  toPositiveNumber,
  validateCodeAndName,
  validateNumberSequenceNextNumber,
  validateTaxRate,
  validateUnitConversionFactor,
} from '@/lib/settings';
import { isMissingTableColumnError } from '@/lib/inventory';
import { isMissingColumnError } from '@/lib/postgrest-compat';

function stripUnsupportedItemColumn(payload: Record<string, unknown>, error: unknown) {
  if (isMissingTableColumnError(error, 'items', 'reorder_quantity') || isMissingColumnError(error, 'items', 'reorder_quantity')) {
    const nextPayload: Record<string, unknown> = { ...payload, reorder_qty: payload['reorder_quantity'] };
    delete nextPayload['reorder_quantity'];
    return nextPayload;
  }

  if (isMissingTableColumnError(error, 'items', 'track_expiry') || isMissingColumnError(error, 'items', 'track_expiry')) {
    const nextPayload: Record<string, unknown> = { ...payload };
    delete nextPayload['track_expiry'];
    return nextPayload;
  }

  return null;
}

export async function requireSettingsAccess(permission: 'read' | 'write', request?: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return { error: unauthorized() } as const;
  if (!can(ctx, `settings.${permission}`)) return { error: forbidden() } as const;
  return { ctx } as const;
}

export function handleSettingsError(error: unknown) {
  return serverError(error instanceof Error ? error.message : 'Internal server error');
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function listOrganizationTable(table: string, organizationId: string, select = '*') {
  const { data, error } = await settingsService()
    .from(table)
    .select(select)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ok(data ?? []);
}

export async function createTableRecord(input: {
  action: string;
  entityType: string;
  payload: Record<string, unknown>;
  table: string;
  userId: string;
}) {
  const data = await createMasterDataRecord(input.table, input.payload);
  await writeSettingsAuditLog(input.action, String(data.id), input.userId, input.payload, input.entityType);
  return ok(data, 201);
}

export async function getDashboardResponse(organizationId: string) {
  return ok(await fetchSettingsDashboardMetrics(organizationId));
}

export async function getCompanyProfileResponse() {
  return ok(await getCompanyProfile());
}

export async function updateCompanyProfileResponse(input: {
  payload: Record<string, unknown>;
  userId: string;
}) {
  const data = await updateCompanyProfile(input.payload);
  await writeSettingsAuditLog('COMPANY_PROFILE_UPDATED', String(data.id), input.userId, input.payload, 'company_profile');
  return ok(data);
}

export async function getSystemSettingsResponse(organizationId: string) {
  const { data, error } = await settingsService()
    .from('system_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .order('module_name', { ascending: true })
    .order('setting_key', { ascending: true });
  if (error) throw error;
  return ok(data ?? []);
}

export async function upsertSystemSettingsResponse(input: {
  settings: Array<Record<string, unknown>>;
  userId: string;
}) {
  const data = await upsertSystemSettings(input.settings);
  await writeSettingsAuditLog('SYSTEM_SETTINGS_UPSERTED', 'system_settings', input.userId, { count: data.length }, 'system_setting');
  return ok(data);
}

export async function getImportTemplatesResponse() {
  return ok(await getSettingsImportTemplates());
}

export async function getImportHistoryResponse(organizationId: string) {
  return listOrganizationTable(
    'settings_import_batches',
    organizationId,
    'id, data_type, file_name, status, total_rows, successful_rows, failed_rows, imported_at, error_summary',
  );
}

export async function getExportHistoryResponse(organizationId: string) {
  return listOrganizationTable(
    'settings_export_batches',
    organizationId,
    'id, data_type, export_format, exported_at, file_name, status, filters',
  );
}

export async function seedDefaultsResponse(input: { organizationId: string; userId: string }) {
  const data = await seedSettingsDefaults(input);
  await writeSettingsAuditLog('SETTINGS_DEFAULTS_SEEDED', input.organizationId, input.userId, data, 'settings_seed');
  return ok(data, 201);
}

export async function createNumberSeriesResponse(input: {
  body: {
    isActive?: boolean;
    lastNumber?: number;
    padding?: number;
    prefix: string;
    resetFrequency?: string;
    seriesType: string;
  };
  organizationId: string;
  userId: string;
}) {
  if (!input.body.seriesType || !input.body.prefix) return badRequest('seriesType and prefix are required');
  const nextNumberError = validateNumberSequenceNextNumber(input.body.lastNumber ?? 0);
  if (nextNumberError) return badRequest(nextNumberError);

  return createTableRecord({
    action: 'NUMBER_SERIES_CREATED',
    entityType: 'number_series',
    payload: {
      is_active: input.body.isActive ?? true,
      last_number: Math.max(0, Math.trunc(Number(input.body.lastNumber ?? 0))),
      organization_id: input.organizationId,
      padding: Math.max(1, Math.trunc(Number(input.body.padding ?? 4))),
      prefix: normalizeCode(input.body.prefix),
      reset_frequency: input.body.resetFrequency ?? 'NEVER',
      series_type: normalizeCode(input.body.seriesType),
    },
    table: 'number_series',
    userId: input.userId,
  });
}

export async function createUnitResponse(input: {
  body: {
    abbreviation: string;
    code?: string;
    isActive?: boolean;
    isBaseUnit?: boolean;
    name: string;
    unitType?: string;
  };
  organizationId: string;
  userId: string;
}) {
  const validationError = validateCodeAndName({ code: input.body.code ?? input.body.abbreviation, name: input.body.name });
  if (validationError) return badRequest(validationError);

  return createTableRecord({
    action: 'UNIT_OF_MEASURE_CREATED',
    entityType: 'unit_of_measure',
    payload: {
      abbreviation: normalizeCode(input.body.abbreviation),
      code: normalizeCode(input.body.code ?? input.body.abbreviation),
      is_active: input.body.isActive ?? true,
      is_base_unit: input.body.isBaseUnit ?? false,
      name: normalizeName(input.body.name),
      organization_id: input.organizationId,
      unit_type: normalizeCode(input.body.unitType ?? 'GENERAL'),
    },
    table: 'units_of_measure',
    userId: input.userId,
  });
}

export async function createUnitConversionResponse(input: {
  body: {
    conversionFactor: number;
    fromUnitId: string;
    isActive?: boolean;
    notes?: string;
    toUnitId: string;
  };
  organizationId: string;
  userId: string;
}) {
  if (!input.body.fromUnitId || !input.body.toUnitId) return badRequest('fromUnitId and toUnitId are required');
  const conversionError = validateUnitConversionFactor(input.body.conversionFactor);
  if (conversionError) return badRequest(conversionError);

  return createTableRecord({
    action: 'UNIT_CONVERSION_CREATED',
    entityType: 'unit_conversion',
    payload: {
      conversion_factor: Number(input.body.conversionFactor),
      from_unit_id: input.body.fromUnitId,
      is_active: input.body.isActive ?? true,
      notes: input.body.notes ?? null,
      organization_id: input.organizationId,
      to_unit_id: input.body.toUnitId,
    },
    table: 'unit_conversions',
    userId: input.userId,
  });
}

export async function createCategoryResponse(input: {
  body: {
    code?: string;
    description?: string;
    isActive?: boolean;
    name: string;
    stockCategory?: string;
  };
  organizationId: string;
  userId: string;
}) {
  const validationError = validateCodeAndName({ code: input.body.code ?? input.body.name, name: input.body.name });
  if (validationError) return badRequest(validationError);

  return createTableRecord({
    action: 'ITEM_CATEGORY_CREATED',
    entityType: 'item_category',
    payload: {
      code: normalizeCode(input.body.code ?? input.body.name),
      description: input.body.description ?? null,
      is_active: input.body.isActive ?? true,
      name: normalizeName(input.body.name),
      organization_id: input.organizationId,
      stock_category: normalizeName(input.body.stockCategory ?? input.body.name),
    },
    table: 'item_categories',
    userId: input.userId,
  });
}

export async function createSimpleMasterDataResponse(input: {
  action: string;
  body: { code?: string; description?: string; isActive?: boolean; name: string };
  entityType: string;
  organizationId: string;
  table: string;
  userId: string;
}) {
  const validationError = validateCodeAndName({ code: input.body.code ?? input.body.name, name: input.body.name });
  if (validationError) return badRequest(validationError);

  return createTableRecord({
    action: input.action,
    entityType: input.entityType,
    payload: {
      code: normalizeCode(input.body.code ?? input.body.name),
      created_by: input.userId,
      description: input.body.description ?? null,
      is_active: input.body.isActive ?? true,
      name: normalizeName(input.body.name),
      organization_id: input.organizationId,
      updated_by: input.userId,
    },
    table: input.table,
    userId: input.userId,
  });
}

export async function createTaxCodeResponse(input: {
  body: {
    accountId?: string;
    appliesToPurchase?: boolean;
    appliesToSales?: boolean;
    code: string;
    isActive?: boolean;
    name: string;
    rate: number;
  };
  organizationId: string;
  userId: string;
}) {
  if (!input.body.code || !input.body.name) return badRequest('code and name are required');
  const validationError = validateTaxRate(input.body.rate);
  if (validationError) return badRequest(validationError);

  return createTableRecord({
    action: 'TAX_CODE_CREATED',
    entityType: 'tax_code',
    payload: {
      account_id: input.body.accountId ?? null,
      applies_to_purchase: input.body.appliesToPurchase ?? true,
      applies_to_sales: input.body.appliesToSales ?? true,
      code: normalizeCode(input.body.code),
      is_active: input.body.isActive ?? true,
      name: normalizeName(input.body.name),
      organization_id: input.organizationId,
      rate: Number(input.body.rate),
    },
    table: 'tax_rates',
    userId: input.userId,
  });
}

export async function createItemResponse(input: {
  body: {
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
  };
  organizationId: string;
  userId: string;
}) {
  const validationError = validateCodeAndName({ code: input.body.code, name: input.body.name });
  if (validationError) return badRequest(validationError);
  if (!input.body.categoryId || !input.body.unitOfMeasureId) return badRequest('categoryId and unitOfMeasureId are required');

  const payload: Record<string, unknown> = {
    category_id: input.body.categoryId,
    code: normalizeCode(input.body.code),
    description: input.body.description ?? null,
    is_active: input.body.isActive ?? true,
    item_type: normalizeCode(input.body.itemType),
    name: normalizeName(input.body.name),
    organization_id: input.organizationId,
    reorder_level: toPositiveNumber(input.body.reorderLevel),
    reorder_quantity: toPositiveNumber(input.body.reorderQuantity),
    selling_price: toPositiveNumber(input.body.sellingPrice),
    track_expiry: input.body.trackExpiry ?? false,
    type: normalizeCode(input.body.itemType),
    unit_cost: toPositiveNumber(input.body.unitCost),
    unit_of_measure_id: input.body.unitOfMeasureId,
  };

  try {
    return await createTableRecord({
      action: 'ITEM_CREATED',
      entityType: 'item',
      payload,
      table: 'items',
      userId: input.userId,
    });
  } catch (error) {
    let fallbackPayload = stripUnsupportedItemColumn(payload, error);
    if (!fallbackPayload) throw error;

    while (fallbackPayload) {
      try {
        return await createTableRecord({
          action: 'ITEM_CREATED',
          entityType: 'item',
          payload: fallbackPayload,
          table: 'items',
          userId: input.userId,
        });
      } catch (fallbackError) {
        const nextPayload = stripUnsupportedItemColumn(fallbackPayload, fallbackError);
        if (!nextPayload) throw fallbackError;
        fallbackPayload = nextPayload;
      }
    }

    throw error;
  }
}

export async function generateDocumentNumberResponse(input: {
  organizationId: string;
  seriesType: string;
}) {
  if (!input.seriesType) return badRequest('seriesType is required');
  return ok(await generateNextDocumentNumber(input));
}

export async function importTemplateResponse(input: {
  body: { fileName?: string; rows?: Array<Record<string, string | number | boolean | null | undefined>> };
  existingCodes?: string[];
  foreignKeys?: Record<string, string[]>;
  mapper: (
    row: Record<string, string | number | boolean | null | undefined>,
    context: { organizationId: string; userId: string },
  ) => Record<string, unknown>;
  moduleName: string;
  nonNegativeColumns?: string[];
  organizationId: string;
  requiredColumns?: string[];
  table: string;
  templateType: string;
  userId: string;
}) {
  const rows = input.body.rows ?? [];
  if (!Array.isArray(rows) || rows.length === 0) return badRequest('rows are required');

  const result = await importSettingsData({
    existingCodes: input.existingCodes,
    fileName: input.body.fileName ?? `${input.templateType}.csv`,
    foreignKeys: input.foreignKeys,
    mapper: (row) => input.mapper(row, { organizationId: input.organizationId, userId: input.userId }),
    moduleName: input.moduleName,
    nonNegativeColumns: input.nonNegativeColumns,
    organizationId: input.organizationId,
    requiredColumns: input.requiredColumns ?? getSettingsTemplateColumns(input.templateType),
    rows,
    table: input.table,
    templateType: input.templateType,
    userId: input.userId,
  });

  return ok(result, result.errors.length > 0 ? 400 : 201);
}

export async function exportSettingsDataResponse(input: {
  dataType: string;
  fileName: string;
  filters?: Record<string, unknown>;
  organizationId: string;
  rows: Array<Record<string, unknown>>;
  userId: string;
}) {
  return ok(
    await exportSettingsData({
      dataType: input.dataType,
      fileName: input.fileName,
      filters: input.filters,
      organizationId: input.organizationId,
      rows: input.rows,
      userId: input.userId,
    }),
  );
}

export async function recordManualExportResponse(input: {
  body: { dataType: string; fileName: string; filters?: Record<string, unknown>; format?: string };
  organizationId: string;
  userId: string;
}) {
  return ok(
    await recordSettingsExportBatch({
      dataType: input.body.dataType,
      fileName: input.body.fileName,
      filters: input.body.filters,
      format: input.body.format,
      organizationId: input.organizationId,
      status: 'EXPORTED',
      userId: input.userId,
    }),
    201,
  );
}
