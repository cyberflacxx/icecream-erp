import { buildDocumentNumber, DEFAULT_CHOCOLATE_TYPES, DEFAULT_FLAVOURS, DEFAULT_PAYMENT_METHODS, DEFAULT_STOCK_CATEGORIES, getSettingsTemplateColumns, normalizeCode, normalizeName, SETTINGS_EXPORT_TYPES, SETTINGS_IMPORT_TEMPLATES, toPositiveNumber, validateImportRows } from '@/lib/settings';
import { createServiceRoleClient } from '@/lib/supabase/server';

export function settingsService() {
  return createServiceRoleClient().schema('icecream_erp');
}

export async function writeSettingsAuditLog(
  action: string,
  entityId: string,
  userProfileId: string,
  details: Record<string, unknown>,
  entityType = 'settings_record',
) {
  const service = settingsService();
  await service.from('audit_logs').insert({
    action,
    entity_id: entityId,
    entity_type: entityType,
    new_values: details,
    user_profile_id: userProfileId,
  });
}

export async function listMasterData(table: string, select = '*') {
  const service = settingsService();
  const { data, error } = await service.from(table).select(select).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMasterDataRecord(table: string, payload: Record<string, unknown>) {
  const service = settingsService();
  const { data, error } = await service.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateMasterDataRecord(table: string, id: string, payload: Record<string, unknown>) {
  const service = settingsService();
  const { data, error } = await service.from(table).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getCompanyProfile() {
  const service = settingsService();
  const { data, error } = await service
    .from('organizations')
    .select('id, name, address, phone, email, tax_number, logo_url, currency, financial_year_start')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateCompanyProfile(payload: Record<string, unknown>) {
  const service = settingsService();
  const { data: org, error: orgError } = await service.from('organizations').select('id').limit(1).maybeSingle();
  if (orgError) throw orgError;
  if (!org) throw new Error('Company profile not found.');
  const { data, error } = await service.from('organizations').update(payload).eq('id', org.id).select().single();
  if (error) throw error;
  return data;
}

export async function getSystemSettings() {
  const service = settingsService();
  const { data, error } = await service
    .from('system_settings')
    .select('*')
    .order('module_name', { ascending: true })
    .order('setting_key', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertSystemSettings(settings: Array<Record<string, unknown>>) {
  const service = settingsService();
  const { data, error } = await service
    .from('system_settings')
    .upsert(settings, { onConflict: 'setting_key' })
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function generateNextDocumentNumber(input: {
  organizationId: string;
  seriesType: string;
}) {
  const service = settingsService();
  const { data, error } = await service
    .from('number_series')
    .select('id, prefix, last_number, padding')
    .eq('organization_id', input.organizationId)
    .eq('series_type', input.seriesType)
    .eq('is_active', true)
    .single();
  if (error) throw error;

  const nextNumber = Number(data.last_number ?? 0) + 1;
  const documentNumber = buildDocumentNumber(String(data.prefix ?? ''), nextNumber, Number(data.padding ?? 4));
  const { error: updateError } = await service
    .from('number_series')
    .update({ last_number: nextNumber, updated_at: new Date().toISOString() })
    .eq('id', data.id);
  if (updateError) throw updateError;

  return {
    documentNumber,
    nextNumber,
    seriesId: data.id,
  };
}

export async function fetchSettingsDashboardMetrics(organizationId: string) {
  const service = settingsService();
  const [
    companyProfile,
    branches,
    warehouses,
    products,
    rawMaterials,
    users,
    importBatches,
    exportBatches,
    warnings,
  ] = await Promise.all([
    service.from('organizations').select('id, name, logo_url, currency').eq('id', organizationId).maybeSingle(),
    service.from('branches').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('deleted_at', null),
    service.from('warehouses').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    service.from('items').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('item_type', 'FINISHED_GOOD').is('deleted_at', null),
    service.from('items').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('item_type', 'RAW_MATERIAL').is('deleted_at', null),
    service.from('users').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    service.from('settings_import_batches').select('id, status', { count: 'exact' }).eq('organization_id', organizationId),
    service.from('settings_export_batches').select('id, status', { count: 'exact' }).eq('organization_id', organizationId),
    service.from('system_settings').select('setting_key, setting_value').eq('is_active', true),
  ]);

  if (companyProfile.error) throw companyProfile.error;
  if (branches.error) throw branches.error;
  if (warehouses.error) throw warehouses.error;
  if (products.error) throw products.error;
  if (rawMaterials.error) throw rawMaterials.error;
  if (users.error) throw users.error;
  if (importBatches.error) throw importBatches.error;
  if (exportBatches.error) throw exportBatches.error;
  if (warnings.error) throw warnings.error;

  const imports = importBatches.data ?? [];
  const exports = exportBatches.data ?? [];

  return {
    activeBranches: branches.count ?? 0,
    activeProducts: products.count ?? 0,
    activeRawMaterials: rawMaterials.count ?? 0,
    activeUsers: users.count ?? 0,
    activeWarehouses: warehouses.count ?? 0,
    companyProfileStatus: companyProfile.data?.name ? 'CONFIGURED' : 'PENDING',
    failedImports: imports.filter((row: Record<string, unknown>) => String(row.status ?? '') === 'FAILED').length,
    pendingImports: imports.filter((row: Record<string, unknown>) => ['VALIDATED', 'PENDING', 'UPLOADED'].includes(String(row.status ?? ''))).length,
    recentExports: exports.slice(0, 5),
    systemWarnings: warnings.data ?? [],
  };
}

export async function seedSettingsDefaults(input: { organizationId: string; userId: string }) {
  const service = settingsService();

  const [{ data: categories }, { data: units }, { data: sequences }] = await Promise.all([
    service.from('item_categories').select('id, name').eq('organization_id', input.organizationId),
    service.from('units_of_measure').select('id, name, abbreviation').eq('organization_id', input.organizationId),
    service.from('number_series').select('series_type').eq('organization_id', input.organizationId),
  ]);

  const categoryNames = new Set((categories ?? []).map((row: Record<string, unknown>) => normalizeName(row.name as string | null | undefined)));
  const unitByAbbr = new Map((units ?? []).map((row: Record<string, unknown>) => [normalizeCode(row.abbreviation as string | null | undefined), row]));
  const sequenceTypes = new Set((sequences ?? []).map((row: Record<string, unknown>) => normalizeCode(row.series_type as string | null | undefined)));

  if (DEFAULT_STOCK_CATEGORIES.some((name) => !categoryNames.has(name))) {
    const missing = DEFAULT_STOCK_CATEGORIES.filter((name) => !categoryNames.has(name)).map((name) => ({
      description: `${name} category`,
      name,
      organization_id: input.organizationId,
    }));
    if (missing.length > 0) {
      const { error } = await service.from('item_categories').insert(missing);
      if (error) throw error;
    }
  }

  const kgUnit = unitByAbbr.get('KG');
  const unitUnit = unitByAbbr.get('UNIT');
  const cartonUnit = unitByAbbr.get('CTN') ?? unitByAbbr.get('CARTON');
  const mlUnit = unitByAbbr.get('ML');

  const defaultItems = [
    { code: 'FG-CONE', name: 'Ice Cream Cones', item_type: 'FINISHED_GOOD', category_name: 'Finished Goods', unit: unitUnit?.id },
    { code: 'FG-2LTUB', name: '2L Ice Cream Tub', item_type: 'FINISHED_GOOD', category_name: 'Finished Goods', unit: unitUnit?.id },
    { code: 'FG-5LTUB', name: '5L Ice Cream Tub', item_type: 'FINISHED_GOOD', category_name: 'Finished Goods', unit: unitUnit?.id },
    { code: 'FG-125ML', name: '125ml Ice Cream Tub', item_type: 'FINISHED_GOOD', category_name: 'Finished Goods', unit: unitUnit?.id },
    { code: 'RM-MIX', name: 'Ice Cream Mix', item_type: 'RAW_MATERIAL', category_name: 'Raw Materials', unit: kgUnit?.id },
    { code: 'RM-PALM', name: 'Palm Oil', item_type: 'RAW_MATERIAL', category_name: 'Raw Materials', unit: kgUnit?.id },
    { code: 'RM-CONE', name: 'Coneshells', item_type: 'RAW_MATERIAL', category_name: 'Raw Materials', unit: unitUnit?.id },
    { code: 'RM-DARKLIQ', name: 'Dark Chocolate Liquid', item_type: 'RAW_MATERIAL', category_name: 'Raw Materials', unit: mlUnit?.id },
    { code: 'RM-DARKBAR', name: 'Dark Chocolate Bars', item_type: 'RAW_MATERIAL', category_name: 'Raw Materials', unit: kgUnit?.id },
    { code: 'RM-WHITE', name: 'White Chocolate', item_type: 'RAW_MATERIAL', category_name: 'Raw Materials', unit: kgUnit?.id },
    { code: 'RM-DARK', name: 'Dark Chocolate', item_type: 'RAW_MATERIAL', category_name: 'Raw Materials', unit: kgUnit?.id },
    { code: 'RM-CARAMEL', name: 'Caramel Chocolate', item_type: 'RAW_MATERIAL', category_name: 'Raw Materials', unit: kgUnit?.id },
    { code: 'RM-UHT', name: 'UHT', item_type: 'RAW_MATERIAL', category_name: 'Raw Materials', unit: mlUnit?.id },
    { code: 'RM-WATER', name: 'Water', item_type: 'RAW_MATERIAL', category_name: 'Raw Materials', unit: mlUnit?.id },
    { code: 'PK-CONEBAG', name: 'Cone Bags', item_type: 'PACKAGING_MATERIAL', category_name: 'Packaging Materials', unit: cartonUnit?.id ?? unitUnit?.id },
    { code: 'PK-TAPE', name: 'Sellotape', item_type: 'PACKAGING_MATERIAL', category_name: 'Packaging Materials', unit: unitUnit?.id },
  ];

  const categoryMap = new Map((await service.from('item_categories').select('id, name').eq('organization_id', input.organizationId)).data?.map((row: Record<string, unknown>) => [normalizeName(row.name as string | null | undefined), row]) ?? []);
  const existingItems = new Set((await service.from('items').select('code').eq('organization_id', input.organizationId).is('deleted_at', null)).data?.map((row: Record<string, unknown>) => normalizeCode(row.code as string | null | undefined)) ?? []);
  const itemPayload = defaultItems
    .filter((item) => !existingItems.has(normalizeCode(item.code)) && item.unit && categoryMap.get(item.category_name))
    .map((item) => ({
      category_id: String(categoryMap.get(item.category_name)?.id),
      code: item.code,
      is_active: true,
      item_type: item.item_type,
      name: item.name,
      organization_id: input.organizationId,
      unit_of_measure_id: item.unit,
    }));
  if (itemPayload.length > 0) {
    const { error } = await service.from('items').insert(itemPayload);
    if (error) throw error;
  }

  const simpleSeedTables = [
    {
      codePrefix: 'FLV',
      names: DEFAULT_FLAVOURS,
      table: 'settings_flavours',
    },
    {
      codePrefix: 'CHC',
      names: DEFAULT_CHOCOLATE_TYPES,
      table: 'settings_chocolate_types',
    },
    {
      codePrefix: 'PAY',
      names: DEFAULT_PAYMENT_METHODS,
      table: 'settings_payment_methods',
    },
  ] as const;

  for (const config of simpleSeedTables) {
    const { data: existingRows, error } = await service.from(config.table).select('name').eq('organization_id', input.organizationId);
    if (error) throw error;
    const existingNames = new Set((existingRows ?? []).map((row: Record<string, unknown>) => normalizeName(row.name as string | null | undefined)));
    const payload = config.names
      .filter((name) => !existingNames.has(name))
      .map((name, index) => ({
        code: `${config.codePrefix}-${String(index + 1).padStart(3, '0')}`,
        created_by: input.userId,
        is_active: true,
        name,
        organization_id: input.organizationId,
        updated_by: input.userId,
      }));
    if (payload.length > 0) {
      const { error: insertError } = await service.from(config.table).insert(payload);
      if (insertError) throw insertError;
    }
  }

  const defaultSystemSettings = [
    { description: 'Enable import center.', module_name: 'settings', setting_key: 'settings.import.enabled', setting_value: { enabled: true } },
    { description: 'Enable export center.', module_name: 'settings', setting_key: 'settings.export.enabled', setting_value: { enabled: true } },
    { description: 'Default stock category validation.', module_name: 'inventory', setting_key: 'inventory.stock-category.strict', setting_value: { enabled: true } },
  ];
  await service.from('system_settings').upsert(defaultSystemSettings.map((row) => ({
    ...row,
    created_by: input.userId,
    is_active: true,
    organization_id: input.organizationId,
    updated_by: input.userId,
  })), { onConflict: 'setting_key' });

  const defaultSequences = [
    ['PO', 'PO-'],
    ['PR', 'PR-'],
    ['GRN', 'GRN-'],
    ['BATCH', 'BATCH-'],
    ['INV', 'INV-'],
    ['SO', 'SO-'],
    ['PAY', 'PAY-'],
  ] as const;
  const sequencePayload = defaultSequences
    .filter(([seriesType]) => !sequenceTypes.has(seriesType))
    .map(([seriesType, prefix]) => ({
      is_active: true,
      last_number: 0,
      organization_id: input.organizationId,
      padding: 4,
      prefix,
      reset_frequency: 'NEVER',
      series_type: seriesType,
    }));
  if (sequencePayload.length > 0) {
    const { error } = await service.from('number_series').insert(sequencePayload);
    if (error) throw error;
  }

  return {
    createdItems: itemPayload.length,
    createdSequences: sequencePayload.length,
    seededChocolateTypes: DEFAULT_CHOCOLATE_TYPES.length,
    seededFlavours: DEFAULT_FLAVOURS.length,
    seededPaymentMethods: DEFAULT_PAYMENT_METHODS.length,
  };
}

export async function getSettingsImportTemplates() {
  const service = settingsService();
  const { data, error } = await service.from('settings_import_templates').select('*').eq('is_active', true).order('template_name');
  if (error) throw error;

  if ((data ?? []).length > 0) return data ?? [];

  return SETTINGS_IMPORT_TEMPLATES.map((template) => ({
    data_type: template,
    module_name: template.includes('qc') ? 'quality' : template.includes('budget') || template.includes('accounts') ? 'finance' : 'settings',
    optional_columns: [],
    required_columns: getSettingsTemplateColumns(template),
    template_name: template,
  }));
}

export async function recordSettingsImportBatch(input: {
  dataType: string;
  errorSummary?: string | null;
  fileName: string;
  moduleName: string;
  organizationId: string;
  rows: Array<Record<string, unknown>>;
  status: string;
  successfulRows: number;
  userId: string;
  validationErrors: Array<{ errorMessage: string; rawRowData: Record<string, unknown>; rowNumber: number; validationStatus: string }>;
}) {
  const service = settingsService();
  const { data: batch, error } = await service
    .from('settings_import_batches')
    .insert({
      data_type: input.dataType,
      error_summary: input.errorSummary ?? null,
      file_name: input.fileName,
      imported_at: new Date().toISOString(),
      imported_by: input.userId,
      module_name: input.moduleName,
      organization_id: input.organizationId,
      failed_rows: input.validationErrors.length,
      status: input.status,
      successful_rows: input.successfulRows,
      total_rows: input.rows.length,
    })
    .select()
    .single();
  if (error) throw error;

  if (input.validationErrors.length > 0) {
    const rowPayload = input.validationErrors.map((row) => ({
      error_message: row.errorMessage,
      import_batch_id: batch.id,
      raw_row_data: row.rawRowData,
      row_number: row.rowNumber,
      validation_status: row.validationStatus,
    }));
    const { error: rowError } = await service.from('settings_import_batch_rows').insert(rowPayload);
    if (rowError) throw rowError;
  }

  return batch;
}

export async function recordSettingsExportBatch(input: {
  dataType: string;
  fileName: string;
  filters?: Record<string, unknown>;
  format?: string;
  organizationId: string;
  status: string;
  userId: string;
}) {
  const service = settingsService();
  const { data, error } = await service
    .from('settings_export_batches')
    .insert({
      data_type: input.dataType,
      export_format: input.format ?? 'CSV',
      exported_at: new Date().toISOString(),
      exported_by: input.userId,
      file_name: input.fileName,
      filters: input.filters ?? {},
      organization_id: input.organizationId,
      status: input.status,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function importSettingsData(input: {
  existingCodes?: string[];
  fileName: string;
  foreignKeys?: Record<string, string[]>;
  mapper: (row: Record<string, string | number | boolean | null | undefined>) => Record<string, unknown>;
  moduleName: string;
  nonNegativeColumns?: string[];
  organizationId: string;
  requiredColumns: string[];
  rows: Array<Record<string, string | number | boolean | null | undefined>>;
  table: string;
  templateType: string;
  userId: string;
}) {
  const validation = validateImportRows(input.rows, {
    existingCodes: input.existingCodes,
    nonNegativeColumns: input.nonNegativeColumns,
    requiredColumns: input.requiredColumns,
    validForeignKeys: input.foreignKeys,
  });

  const errors = validation.errors.map((error) => ({
    errorMessage: error.message,
    rawRowData: input.rows[error.row - 2] ?? {},
    rowNumber: error.row,
    validationStatus: 'FAILED',
  }));

  if (validation.errors.length > 0) {
    await recordSettingsImportBatch({
      dataType: input.templateType,
      errorSummary: `${validation.errors.length} validation error(s).`,
      fileName: input.fileName,
      moduleName: input.moduleName,
      organizationId: input.organizationId,
      rows: input.rows,
      status: 'FAILED',
      successfulRows: 0,
      userId: input.userId,
      validationErrors: errors,
    });

    return { errors: validation.errors, inserted: 0, rows: [] };
  }

  const service = settingsService();
  const payload = validation.rows.map(input.mapper);
  const { data, error } = await service.from(input.table).insert(payload).select();
  if (error) throw error;

  await recordSettingsImportBatch({
    dataType: input.templateType,
    fileName: input.fileName,
    moduleName: input.moduleName,
    organizationId: input.organizationId,
    rows: input.rows,
    status: 'COMPLETED',
    successfulRows: payload.length,
    userId: input.userId,
    validationErrors: [],
  });

  return { errors: [], inserted: payload.length, rows: data ?? [] };
}

export async function exportSettingsData(input: {
  dataType: string;
  fileName: string;
  filters?: Record<string, unknown>;
  organizationId: string;
  rows: Array<Record<string, unknown>>;
  userId: string;
}) {
  if (!SETTINGS_EXPORT_TYPES.includes(input.dataType as (typeof SETTINGS_EXPORT_TYPES)[number])) {
    throw new Error('Invalid export type.');
  }

  await recordSettingsExportBatch({
    dataType: input.dataType,
    fileName: input.fileName,
    filters: input.filters,
    organizationId: input.organizationId,
    status: 'EXPORTED',
    userId: input.userId,
  });

  return input.rows;
}
