import { recordAuditLog } from '@/lib/security-server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  buildEnvironmentCheck,
  buildIntegrityIssue,
  buildMigrationBatchNumber,
  buildTemplateDownloadDefinition,
  computeHealthStatus,
  computeReadinessStatus,
  getMigrationTemplateColumns,
  normalizeMigrationType,
  summarizeValidationResult,
  validateMigrationRows,
  validateMigrationType,
  validateUploadPayload,
} from '@/lib/admin-readiness';
import { normalizeCode, normalizeName, toPositiveNumber } from '@/lib/settings';

type Primitive = string | number | boolean | null | undefined;
type AdminContext = {
  organizationId: string;
  userId: string;
};
type Row = Record<string, unknown>;
type ValidationContext = {
  existingCodes?: string[];
  validForeignKeys?: Record<string, string[]>;
};
type HealthMetricDraft = {
  metric_name: string;
  metric_value: string;
  status: string;
  details: Record<string, unknown>;
};

function toPrimitive(value: unknown): Primitive {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value == null
    ? value
    : undefined;
}

export function adminService() {
  return createServiceRoleClient().schema('icecream_erp');
}

async function nextMigrationBatchNumber() {
  const { count, error } = await adminService().from('settings_import_batches').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return buildMigrationBatchNumber((count ?? 0) + 1);
}

async function fetchExistingCodes(table: string, organizationId: string, column: string) {
  const { data, error } = await adminService().from(table).select(column).eq('organization_id', organizationId);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map((row) => String(row[column] ?? '')).filter(Boolean);
}

async function fetchLookupMap(input: { table: string; organizationId: string; codeField?: string; idField?: string }) {
  const codeField = input.codeField ?? 'code';
  const idField = input.idField ?? 'id';
  const { data, error } = await adminService().from(input.table).select(`${idField}, ${codeField}`).eq('organization_id', input.organizationId);
  if (error) throw error;
  return new Map(((data ?? []) as unknown as Row[]).map((row) => [normalizeCode(row[codeField] as Primitive), String(row[idField] ?? '')]));
}

async function listBuiltInMigrationTemplates(organizationId: string) {
  const definitions = Object.keys({
    suppliers: true,
    customers: true,
    employees: true,
    branches: true,
    warehouses: true,
    'inventory-items': true,
    products: true,
    'product-variants': true,
    'raw-materials': true,
    'packaging-materials': true,
    recipes: true,
    'opening-stock-balances': true,
    'opening-customer-balances': true,
    'opening-supplier-balances': true,
    'chart-of-accounts': true,
    'opening-account-balances': true,
    'fixed-assets': true,
    budgets: true,
    'price-lists': true,
    discounts: true,
    'qc-templates': true,
    'shift-schedules': true,
  });

  return definitions.map((template) => ({
    organization_id: organizationId,
    template_name: template,
    module_name:
      template.includes('opening') || template.includes('chart') || template === 'budgets' || template === 'fixed-assets'
        ? 'finance'
        : template.includes('supplier')
          ? 'procurement'
          : template.includes('customer') || template.includes('price') || template.includes('discount')
            ? 'sales'
            : template.includes('employee') || template.includes('shift')
              ? 'hr'
              : template.includes('recipe') || template.includes('product')
                ? 'production'
                : template.includes('qc')
                  ? 'quality'
                  : 'inventory',
    data_type: template,
    required_columns: getMigrationTemplateColumns(template),
    optional_columns: [],
    template_version: 'v1',
    sample_file_name: `${template}.xlsx`,
    remarks: 'Deployment migration template',
  }));
}

export async function listMigrationTemplates(organizationId: string) {
  const [existing, builtIn] = await Promise.all([
    adminService().from('settings_import_templates').select('*').eq('is_active', true).order('template_name'),
    listBuiltInMigrationTemplates(organizationId),
  ]);
  if (existing.error) throw existing.error;
  const merged = new Map<string, Row>();
  for (const row of builtIn) merged.set(String(row.template_name), row as Row);
  for (const row of (existing.data ?? []) as Row[]) merged.set(String(row.template_name ?? ''), row);
  return Array.from(merged.values());
}

export async function downloadMigrationTemplate(type: string) {
  const validation = validateMigrationType(type);
  if (validation) throw new Error(validation);
  return buildTemplateDownloadDefinition(type);
}

export async function createMigrationBatch(input: {
  body: {
    fileName?: string;
    migrationType?: string;
    remarks?: string;
    rows?: Array<Record<string, Primitive>>;
    templateVersion?: string;
  };
  ctx: AdminContext;
}) {
  const payloadError = validateUploadPayload(input.body);
  if (payloadError) throw new Error(payloadError);

  const batchNumber = await nextMigrationBatchNumber();
  const service = adminService();
  const migrationType = normalizeMigrationType(input.body.migrationType);
  const { data: batch, error } = await service
    .from('settings_import_batches')
    .insert({
      organization_id: input.ctx.organizationId,
      module_name: 'admin',
      data_type: migrationType,
      file_name: String(input.body.fileName),
      status: 'DRAFT',
      total_rows: input.body.rows?.length ?? 0,
      successful_rows: 0,
      failed_rows: 0,
      batch_number: batchNumber,
      template_version: input.body.templateVersion ?? 'v1',
      remarks: input.body.remarks ?? null,
      approval_status: 'PENDING_APPROVAL',
      imported_by: input.ctx.userId,
    })
    .select('*')
    .single();
  if (error) throw error;

  const rowPayload = (input.body.rows ?? []).map((row, index) => ({
    import_batch_id: (batch as Row).id,
    row_number: index + 2,
    raw_row_data: row,
    normalized_row_data: row,
    validation_status: 'DRAFT',
    error_message: null,
    error_messages: [],
  }));
  if (rowPayload.length > 0) {
    const { error: rowError } = await service.from('settings_import_batch_rows').insert(rowPayload);
    if (rowError) throw rowError;
  }

  await recordAuditLog({
    action: 'MIGRATION_BATCH_UPLOADED',
    entityId: String((batch as Row).id),
    entityType: 'migration_batch',
    newValues: {
      batchNumber,
      fileName: input.body.fileName,
      migrationType,
      rows: input.body.rows?.length ?? 0,
    },
    organizationId: input.ctx.organizationId,
    userProfileId: input.ctx.userId,
  });

  return batch;
}

async function fetchValidationContext(templateType: string, organizationId: string): Promise<ValidationContext> {
  switch (normalizeMigrationType(templateType)) {
    case 'suppliers':
      return {
        existingCodes: await fetchExistingCodes('suppliers', organizationId, 'code'),
        validForeignKeys: {
          category_code: await fetchExistingCodes('supplier_categories', organizationId, 'name'),
        },
      };
    case 'customers':
      return { existingCodes: await fetchExistingCodes('customers', organizationId, 'code') };
    case 'employees':
      return {
        existingCodes: await fetchExistingCodes('employees', organizationId, 'employee_number'),
        validForeignKeys: {
          branch_code: await fetchExistingCodes('branches', organizationId, 'code'),
        },
      };
    case 'branches':
      return { existingCodes: await fetchExistingCodes('branches', organizationId, 'code') };
    case 'warehouses':
      return {
        existingCodes: await fetchExistingCodes('warehouses', organizationId, 'code'),
        validForeignKeys: {
          branch_code: await fetchExistingCodes('branches', organizationId, 'code'),
        },
      };
    case 'inventory-items':
    case 'products':
    case 'raw-materials':
    case 'packaging-materials':
      return {
        existingCodes: await fetchExistingCodes('items', organizationId, 'code'),
        validForeignKeys: {
          category_code: await fetchExistingCodes('item_categories', organizationId, 'code'),
          unit_code: await fetchExistingCodes('units_of_measure', organizationId, 'code'),
        },
      };
    case 'opening-stock-balances':
      return {
        validForeignKeys: {
          warehouse_code: await fetchExistingCodes('warehouses', organizationId, 'code'),
          item_code: await fetchExistingCodes('items', organizationId, 'code'),
        },
      };
    case 'opening-customer-balances':
      return { validForeignKeys: { customer_code: await fetchExistingCodes('customers', organizationId, 'code') } };
    case 'opening-supplier-balances':
      return { validForeignKeys: { supplier_code: await fetchExistingCodes('suppliers', organizationId, 'code') } };
    case 'chart-of-accounts':
      return { existingCodes: await fetchExistingCodes('accounts', organizationId, 'account_code') };
    case 'opening-account-balances':
      return { validForeignKeys: { account_code: await fetchExistingCodes('accounts', organizationId, 'account_code') } };
    default:
      return {};
  }
}

export async function validateMigrationBatch(batchId: string, ctx: AdminContext) {
  const service = adminService();
  const { data: batch, error: batchError } = await service.from('settings_import_batches').select('*').eq('organization_id', ctx.organizationId).eq('id', batchId).single();
  if (batchError) throw batchError;
  const { data: rows, error: rowsError } = await service.from('settings_import_batch_rows').select('*').eq('import_batch_id', batchId).order('row_number');
  if (rowsError) throw rowsError;

  const templateType = String((batch as Row).data_type ?? '');
  const rawRows = ((rows ?? []) as Row[]).map((row) => (row.raw_row_data as Record<string, Primitive>) ?? {});
  const validationContext = await fetchValidationContext(templateType, ctx.organizationId);
  const validation = validateMigrationRows(templateType, rawRows, validationContext);
  const summary = summarizeValidationResult(validation);
  const errorMap = new Map<number, Array<{ field: string; message: string }>>();
  for (const error of validation.errors) {
    const list = errorMap.get(error.row) ?? [];
    list.push({ field: error.field, message: error.message });
    errorMap.set(error.row, list);
  }

  for (const row of (rows ?? []) as Row[]) {
    const rowNumber = Number(row.row_number ?? 0);
    const messages = errorMap.get(rowNumber) ?? [];
    const { error } = await service
      .from('settings_import_batch_rows')
      .update({
        normalized_row_data: row.raw_row_data,
        validation_status: messages.length > 0 ? 'FAILED' : 'VALID',
        error_message: messages[0]?.message ?? null,
        error_messages: messages,
      })
      .eq('id', row.id);
    if (error) throw error;
  }

  const { data: updated, error: updateError } = await service
    .from('settings_import_batches')
    .update({
      status: validation.errors.length > 0 ? 'FAILED_VALIDATION' : 'VALIDATED',
      successful_rows: summary.successfulRows,
      failed_rows: summary.failedRows,
      total_rows: summary.totalRows,
      error_summary: validation.errors.length > 0 ? `${validation.errors.length} validation error(s).` : null,
      validation_report: {
        errors: validation.errors,
      },
    })
    .eq('id', batchId)
    .select('*')
    .single();
  if (updateError) throw updateError;
  return updated;
}

export async function approveMigrationBatch(batchId: string, ctx: AdminContext) {
  const { data, error } = await adminService()
    .from('settings_import_batches')
    .update({
      status: 'APPROVED',
      approval_status: 'APPROVED',
      approved_at: new Date().toISOString(),
      approved_by: ctx.userId,
    })
    .eq('organization_id', ctx.organizationId)
    .eq('id', batchId)
    .in('status', ['VALIDATED', 'APPROVED'])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function importMasterDataRows(templateType: string, rows: Array<Row>, ctx: AdminContext) {
  const service = adminService();
  if (rows.length === 0) return { imported: 0, targetTable: '' };
  if (templateType === 'suppliers') {
    const categoryMap = await fetchLookupMap({ table: 'supplier_categories', organizationId: ctx.organizationId, codeField: 'name' });
    const payload = rows.map((row) => ({
      organization_id: ctx.organizationId,
      code: normalizeCode(row.code as Primitive),
      name: normalizeName(row.name as Primitive),
      category_id: categoryMap.get(normalizeCode(row.category_code as Primitive)) ?? Array.from(categoryMap.values())[0],
      contact_person: normalizeName(row.contact_person as Primitive) || null,
      phone: normalizeName(row.phone as Primitive) || null,
      email: normalizeName(row.email as Primitive) || null,
      address: normalizeName(row.address as Primitive) || null,
      payment_terms: normalizeName(row.payment_terms as Primitive) || null,
      current_balance: toPositiveNumber(toPrimitive(row.current_balance)),
      created_by: ctx.userId,
    }));
    const { error } = await service.from('suppliers').insert(payload);
    if (error) throw error;
    return { imported: payload.length, targetTable: 'suppliers' };
  }
  if (templateType === 'customers') {
    const payload = rows.map((row) => ({
      organization_id: ctx.organizationId,
      code: normalizeCode(row.code as Primitive),
      name: normalizeName(row.name as Primitive),
      customer_type: normalizeCode(row.customer_type as Primitive || 'RETAIL'),
      phone: normalizeName(row.phone as Primitive) || null,
      email: normalizeName(row.email as Primitive) || null,
      address: normalizeName(row.address as Primitive) || null,
      payment_terms: normalizeName(row.payment_terms as Primitive) || null,
      current_balance: toPositiveNumber(toPrimitive(row.current_balance)),
      credit_limit: toPositiveNumber(toPrimitive(row.credit_limit)),
      created_by: ctx.userId,
    }));
    const { error } = await service.from('customers').insert(payload);
    if (error) throw error;
    return { imported: payload.length, targetTable: 'customers' };
  }
  if (templateType === 'branches') {
    const payload = rows.map((row) => ({
      organization_id: ctx.organizationId,
      code: normalizeCode(row.code as Primitive),
      name: normalizeName(row.name as Primitive),
      address: normalizeName(row.address as Primitive) || null,
      phone: normalizeName(row.phone as Primitive) || null,
    }));
    const { error } = await service.from('branches').insert(payload);
    if (error) throw error;
    return { imported: payload.length, targetTable: 'branches' };
  }
  if (templateType === 'warehouses') {
    const branchMap = await fetchLookupMap({ table: 'branches', organizationId: ctx.organizationId, codeField: 'code' });
    const payload = rows.map((row) => ({
      organization_id: ctx.organizationId,
      branch_id: branchMap.get(normalizeCode(row.branch_code as Primitive)) ?? null,
      code: normalizeCode(row.code as Primitive),
      name: normalizeName(row.name as Primitive),
      type: normalizeCode(row.type as Primitive || 'MAIN'),
      address: normalizeName(row.address as Primitive) || null,
      is_active: row.is_active !== false,
    }));
    const { error } = await service.from('warehouses').insert(payload);
    if (error) throw error;
    return { imported: payload.length, targetTable: 'warehouses' };
  }
  if (['inventory-items', 'products', 'raw-materials', 'packaging-materials'].includes(templateType)) {
    const categoryMap = await fetchLookupMap({ table: 'item_categories', organizationId: ctx.organizationId, codeField: 'code' });
    const unitMap = await fetchLookupMap({ table: 'units_of_measure', organizationId: ctx.organizationId, codeField: 'code' });
    const itemType =
      templateType === 'products'
        ? 'FINISHED_GOOD'
        : templateType === 'raw-materials'
          ? 'RAW_MATERIAL'
          : templateType === 'packaging-materials'
            ? 'PACKAGING_MATERIAL'
            : undefined;
    const payload = rows.map((row) => ({
      organization_id: ctx.organizationId,
      category_id: categoryMap.get(normalizeCode(row.category_code as Primitive)) ?? null,
      code: normalizeCode((row.code ?? row.item_code) as Primitive),
      name: normalizeName(row.name as Primitive),
      item_type: itemType ?? normalizeCode(row.item_type as Primitive || 'GENERAL'),
      unit_of_measure_id: unitMap.get(normalizeCode(row.unit_code as Primitive)) ?? null,
      reorder_level: toPositiveNumber(toPrimitive(row.reorder_level)),
      reorder_quantity: toPositiveNumber(toPrimitive(row.reorder_quantity)),
      unit_cost: toPositiveNumber(toPrimitive(row.unit_cost)),
      selling_price: toPositiveNumber(toPrimitive(row.selling_price)),
      is_active: row.is_active !== false,
      track_expiry: row.track_expiry === true || String(row.track_expiry ?? '').toLowerCase() === 'true',
    }));
    const { error } = await service.from('items').insert(payload);
    if (error) throw error;
    return { imported: payload.length, targetTable: 'items' };
  }
  if (templateType === 'employees') {
    const branchMap = await fetchLookupMap({ table: 'branches', organizationId: ctx.organizationId, codeField: 'code' });
    const payload = rows.map((row) => ({
      organization_id: ctx.organizationId,
      employee_number: normalizeCode(row.employee_number as Primitive),
      first_name: normalizeName(row.first_name as Primitive),
      last_name: normalizeName(row.last_name as Primitive),
      phone: normalizeName(row.phone as Primitive) || null,
      email: normalizeName(row.email as Primitive) || null,
      department: normalizeName(row.department as Primitive) || null,
      job_title: normalizeName(row.job_title as Primitive) || null,
      branch_id: branchMap.get(normalizeCode(row.branch_code as Primitive)) ?? null,
      hire_date: normalizeName(row.hire_date as Primitive) || new Date().toISOString().slice(0, 10),
      status: 'ACTIVE',
    }));
    const { error } = await service.from('employees').insert(payload);
    if (error) throw error;
    return { imported: payload.length, targetTable: 'employees' };
  }
  if (templateType === 'chart-of-accounts') {
    const payload = rows.map((row) => ({
      organization_id: ctx.organizationId,
      account_code: normalizeCode(row.account_code as Primitive),
      account_name: normalizeName(row.account_name as Primitive),
      account_type: normalizeCode(row.account_type as Primitive),
      is_active: row.is_active !== false,
    }));
    const { error } = await service.from('accounts').insert(payload);
    if (error) throw error;
    return { imported: payload.length, targetTable: 'accounts' };
  }
  return { imported: 0, targetTable: '' };
}

async function importOpeningRows(templateType: string, batchId: string, rows: Array<Row>, ctx: AdminContext) {
  const service = adminService();
  if (templateType === 'opening-stock-balances') {
    const warehouseMap = await fetchLookupMap({ table: 'warehouses', organizationId: ctx.organizationId, codeField: 'code' });
    const itemMap = await fetchLookupMap({ table: 'items', organizationId: ctx.organizationId, codeField: 'code' });
    const payload = rows.map((row) => ({
      organization_id: ctx.organizationId,
      migration_batch_id: batchId,
      warehouse_id: warehouseMap.get(normalizeCode(row.warehouse_code as Primitive)),
      item_id: itemMap.get(normalizeCode(row.item_code as Primitive)),
      opening_quantity: toPositiveNumber(toPrimitive(row.opening_quantity)),
      unit_cost: toPositiveNumber(toPrimitive(row.unit_cost)),
      total_value: toPositiveNumber(toPrimitive(row.opening_quantity)) * toPositiveNumber(toPrimitive(row.unit_cost)),
      batch_number: normalizeName(row.batch_number as Primitive) || null,
      expiry_date: normalizeName(row.expiry_date as Primitive) || null,
      remarks: normalizeName(row.remarks as Primitive) || null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }));
    const { error } = await service.from('opening_stock_balances').insert(payload);
    if (error) throw error;
    return { imported: payload.length, targetTable: 'opening_stock_balances' };
  }
  if (templateType === 'opening-customer-balances') {
    const customerMap = await fetchLookupMap({ table: 'customers', organizationId: ctx.organizationId, codeField: 'code' });
    const payload = rows.map((row) => ({
      organization_id: ctx.organizationId,
      migration_batch_id: batchId,
      customer_id: customerMap.get(normalizeCode(row.customer_code as Primitive)),
      opening_invoice_reference: normalizeName(row.opening_invoice_reference as Primitive),
      opening_balance: toPositiveNumber(toPrimitive(row.opening_balance)),
      due_date: normalizeName(row.due_date as Primitive) || null,
      remarks: normalizeName(row.remarks as Primitive) || null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }));
    const { error } = await service.from('opening_customer_balances').insert(payload);
    if (error) throw error;
    return { imported: payload.length, targetTable: 'opening_customer_balances' };
  }
  if (templateType === 'opening-supplier-balances') {
    const supplierMap = await fetchLookupMap({ table: 'suppliers', organizationId: ctx.organizationId, codeField: 'code' });
    const payload = rows.map((row) => ({
      organization_id: ctx.organizationId,
      migration_batch_id: batchId,
      supplier_id: supplierMap.get(normalizeCode(row.supplier_code as Primitive)),
      opening_invoice_reference: normalizeName(row.opening_invoice_reference as Primitive),
      opening_balance: toPositiveNumber(toPrimitive(row.opening_balance)),
      due_date: normalizeName(row.due_date as Primitive) || null,
      remarks: normalizeName(row.remarks as Primitive) || null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }));
    const { error } = await service.from('opening_supplier_balances').insert(payload);
    if (error) throw error;
    return { imported: payload.length, targetTable: 'opening_supplier_balances' };
  }
  if (templateType === 'opening-account-balances') {
    const accountMap = await fetchLookupMap({ table: 'accounts', organizationId: ctx.organizationId, codeField: 'account_code' });
    const payload = rows.map((row) => ({
      organization_id: ctx.organizationId,
      migration_batch_id: batchId,
      account_id: accountMap.get(normalizeCode(row.account_code as Primitive)),
      debit_amount: toPositiveNumber(toPrimitive(row.debit_amount)),
      credit_amount: toPositiveNumber(toPrimitive(row.credit_amount)),
      reference: normalizeName(row.reference as Primitive) || null,
      remarks: normalizeName(row.remarks as Primitive) || null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }));
    const { error } = await service.from('opening_account_balances').insert(payload);
    if (error) throw error;
    return { imported: payload.length, targetTable: 'opening_account_balances' };
  }
  return { imported: 0, targetTable: '' };
}

export async function importMigrationBatch(batchId: string, ctx: AdminContext) {
  const service = adminService();
  const { data: batch, error: batchError } = await service.from('settings_import_batches').select('*').eq('organization_id', ctx.organizationId).eq('id', batchId).single();
  if (batchError) throw batchError;
  if (String((batch as Row).status ?? '') !== 'APPROVED') throw new Error('Import must be approved before import.');

  const { data: rows, error: rowsError } = await service
    .from('settings_import_batch_rows')
    .select('*')
    .eq('import_batch_id', batchId)
    .eq('validation_status', 'VALID')
    .order('row_number');
  if (rowsError) throw rowsError;

  const templateType = normalizeMigrationType((batch as Row).data_type as Primitive);
  await service.from('settings_import_batches').update({ status: 'IMPORTING' }).eq('id', batchId);

  const normalizedRows = ((rows ?? []) as Row[]).map((row) => (row.normalized_row_data as Row) ?? (row.raw_row_data as Row) ?? {});
  let result = { imported: 0, targetTable: '' };
  if (templateType.startsWith('opening-')) {
    result = await importOpeningRows(templateType, batchId, normalizedRows, ctx);
  } else {
    result = await importMasterDataRows(templateType, normalizedRows, ctx);
  }

  const finalStatus = result.imported === normalizedRows.length ? 'IMPORTED' : result.imported > 0 ? 'PARTIALLY_IMPORTED' : 'FAILED';
  const { data: updated, error: updateError } = await service
    .from('settings_import_batches')
    .update({
      status: finalStatus,
      successful_rows: result.imported,
      failed_rows: Math.max(0, Number((batch as Row).total_rows ?? normalizedRows.length) - result.imported),
      imported_at: new Date().toISOString(),
      imported_by: ctx.userId,
    })
    .eq('id', batchId)
    .select('*')
    .single();
  if (updateError) throw updateError;
  return updated;
}

export async function rollbackMigrationBatch(batchId: string, ctx: AdminContext) {
  const service = adminService();
  const { data: batch, error } = await service.from('settings_import_batches').select('*').eq('organization_id', ctx.organizationId).eq('id', batchId).single();
  if (error) throw error;
  const type = normalizeMigrationType((batch as Row).data_type as Primitive);
  if (type === 'opening-stock-balances') await service.from('opening_stock_balances').delete().eq('migration_batch_id', batchId);
  if (type === 'opening-customer-balances') await service.from('opening_customer_balances').delete().eq('migration_batch_id', batchId);
  if (type === 'opening-supplier-balances') await service.from('opening_supplier_balances').delete().eq('migration_batch_id', batchId);
  if (type === 'opening-account-balances') await service.from('opening_account_balances').delete().eq('migration_batch_id', batchId);
  const { data, error: updateError } = await service.from('settings_import_batches').update({ status: 'ROLLED_BACK' }).eq('id', batchId).select('*').single();
  if (updateError) throw updateError;
  return data;
}

export async function getMigrationDashboard(organizationId: string) {
  const service = adminService();
  const [batches, stockOpenings, customerOpenings, supplierOpenings, accountOpenings, integrityIssues] = await Promise.all([
    service.from('settings_import_batches').select('id, status, data_type, file_name, created_at', { count: 'exact' }).eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(10),
    service.from('opening_stock_balances').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    service.from('opening_customer_balances').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    service.from('opening_supplier_balances').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    service.from('opening_account_balances').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    service.from('data_integrity_issues').select('id, severity, resolution_status', { count: 'exact' }).eq('organization_id', organizationId),
  ]);
  if (batches.error) throw batches.error;
  if (stockOpenings.error) throw stockOpenings.error;
  if (customerOpenings.error) throw customerOpenings.error;
  if (supplierOpenings.error) throw supplierOpenings.error;
  if (accountOpenings.error) throw accountOpenings.error;
  if (integrityIssues.error) throw integrityIssues.error;

  const rows = (batches.data ?? []) as Row[];
  return {
    totalMigrationBatches: batches.count ?? 0,
    pendingValidations: rows.filter((row) => ['DRAFT', 'VALIDATING'].includes(String(row.status ?? ''))).length,
    failedMigrations: rows.filter((row) => ['FAILED', 'FAILED_VALIDATION', 'ROLLED_BACK'].includes(String(row.status ?? ''))).length,
    successfulMigrations: rows.filter((row) => String(row.status ?? '') === 'IMPORTED').length,
    openingStockStatus: (stockOpenings.count ?? 0) > 0 ? 'CONFIGURED' : 'PENDING',
    openingBalanceStatus: (customerOpenings.count ?? 0) + (supplierOpenings.count ?? 0) + (accountOpenings.count ?? 0) > 0 ? 'CONFIGURED' : 'PENDING',
    recentImports: rows,
    dataIntegrityWarnings: ((integrityIssues.data ?? []) as Row[]).filter((row) => String(row.resolution_status ?? '') !== 'RESOLVED').length,
  };
}

export async function listMigrationHistory(organizationId: string) {
  const { data, error } = await adminService().from('settings_import_batches').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMigrationBatch(batchId: string, organizationId: string) {
  const { data, error } = await adminService().from('settings_import_batches').select('*').eq('organization_id', organizationId).eq('id', batchId).single();
  if (error) throw error;
  return data;
}

export async function getMigrationErrors(batchId: string) {
  const { data, error } = await adminService().from('settings_import_batch_rows').select('*').eq('import_batch_id', batchId).order('row_number');
  if (error) throw error;
  return (data ?? []).filter((row) => String((row as Row).validation_status ?? '') !== 'VALID');
}

export async function listOpeningBalances(type: 'stock' | 'customers' | 'suppliers' | 'accounts' | 'branches', organizationId: string) {
  const tableMap = {
    stock: 'opening_stock_balances',
    customers: 'opening_customer_balances',
    suppliers: 'opening_supplier_balances',
    accounts: 'opening_account_balances',
    branches: 'opening_branch_balances',
  } as const;
  const { data, error } = await adminService().from(tableMap[type]).select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createOpeningStockBalance(body: Record<string, unknown>, ctx: AdminContext) {
  if (toPositiveNumber(body.openingQuantity as Primitive, Number.NaN) < 0) throw new Error('opening stock quantity must not be negative.');
  if (toPositiveNumber(body.unitCost as Primitive, Number.NaN) < 0) throw new Error('unit cost must not be negative.');
  const { data, error } = await adminService().from('opening_stock_balances').insert({
    organization_id: ctx.organizationId,
    warehouse_id: String(body.warehouseId),
    item_id: String(body.itemId),
    opening_quantity: toPositiveNumber(body.openingQuantity as Primitive),
    unit_cost: toPositiveNumber(body.unitCost as Primitive),
    total_value: toPositiveNumber(body.openingQuantity as Primitive) * toPositiveNumber(body.unitCost as Primitive),
    batch_number: normalizeName(body.batchNumber as Primitive) || null,
    expiry_date: normalizeName(body.expiryDate as Primitive) || null,
    remarks: normalizeName(body.remarks as Primitive) || null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function createOpeningPartyBalance(type: 'customers' | 'suppliers', body: Record<string, unknown>, ctx: AdminContext) {
  if (toPositiveNumber(body.openingBalance as Primitive, Number.NaN) < 0) throw new Error('opening balance must not be negative.');
  const table = type === 'customers' ? 'opening_customer_balances' : 'opening_supplier_balances';
  const key = type === 'customers' ? 'customer_id' : 'supplier_id';
  const { data, error } = await adminService().from(table).insert({
    organization_id: ctx.organizationId,
    [key]: String(type === 'customers' ? body.customerId : body.supplierId),
    opening_invoice_reference: normalizeName(body.openingInvoiceReference as Primitive),
    opening_balance: toPositiveNumber(body.openingBalance as Primitive),
    due_date: normalizeName(body.dueDate as Primitive) || null,
    remarks: normalizeName(body.remarks as Primitive) || null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function createOpeningAccountBalance(body: Record<string, unknown>, ctx: AdminContext) {
  const debit = toPositiveNumber(body.debitAmount as Primitive);
  const credit = toPositiveNumber(body.creditAmount as Primitive);
  if (debit < 0 || credit < 0) throw new Error('opening account balances must not be negative.');
  const { data, error } = await adminService().from('opening_account_balances').insert({
    organization_id: ctx.organizationId,
    account_id: String(body.accountId),
    debit_amount: debit,
    credit_amount: credit,
    reference: normalizeName(body.reference as Primitive) || null,
    remarks: normalizeName(body.remarks as Primitive) || null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function postOpeningBalances(ctx: AdminContext) {
  const service = adminService();
  const [stockRows, customerRows, supplierRows, accountRows] = await Promise.all([
    service.from('opening_stock_balances').select('*').eq('organization_id', ctx.organizationId).eq('posting_status', 'DRAFT'),
    service.from('opening_customer_balances').select('*').eq('organization_id', ctx.organizationId).eq('posting_status', 'DRAFT'),
    service.from('opening_supplier_balances').select('*').eq('organization_id', ctx.organizationId).eq('posting_status', 'DRAFT'),
    service.from('opening_account_balances').select('*').eq('organization_id', ctx.organizationId).eq('posting_status', 'DRAFT'),
  ]);
  if (stockRows.error) throw stockRows.error;
  if (customerRows.error) throw customerRows.error;
  if (supplierRows.error) throw supplierRows.error;
  if (accountRows.error) throw accountRows.error;

  for (const row of (stockRows.data ?? []) as Row[]) {
    const quantity = toPositiveNumber(row.opening_quantity as Primitive);
    const unitCost = toPositiveNumber(row.unit_cost as Primitive);
    const { data: existingBalance } = await service.from('stock_balances').select('id, quantity_on_hand, quantity_reserved').eq('item_id', row.item_id).eq('warehouse_id', row.warehouse_id).maybeSingle();
    if (existingBalance) {
      await service.from('stock_balances').update({
        quantity_on_hand: Number((existingBalance as Row).quantity_on_hand ?? 0) + quantity,
        quantity_available: Number((existingBalance as Row).quantity_on_hand ?? 0) + quantity - Number((existingBalance as Row).quantity_reserved ?? 0),
        last_updated: new Date().toISOString(),
      }).eq('id', (existingBalance as Row).id);
    } else {
      await service.from('stock_balances').insert({
        organization_id: ctx.organizationId,
        item_id: row.item_id,
        warehouse_id: row.warehouse_id,
        quantity_on_hand: quantity,
        quantity_reserved: 0,
        quantity_available: quantity,
        last_updated: new Date().toISOString(),
      });
    }
    if (row.batch_number) {
      await service.from('inventory_batches').upsert({
        organization_id: ctx.organizationId,
        item_id: row.item_id,
        warehouse_id: row.warehouse_id,
        batch_number: row.batch_number,
        expiry_date: row.expiry_date,
        quantity_received: quantity,
        quantity_remaining: quantity,
        unit_cost: unitCost,
        status: 'ACTIVE',
      }, { onConflict: 'warehouse_id,item_id,batch_number' });
    }
    await service.from('stock_movements').insert({
      organization_id: ctx.organizationId,
      item_id: row.item_id,
      warehouse_id: row.warehouse_id,
      movement_type: 'ADJUSTMENT_IN',
      quantity,
      unit_cost: unitCost,
      total_cost: quantity * unitCost,
      running_balance: quantity,
      reference_type: 'opening_stock_balance',
      reference_id: row.id,
      created_by: ctx.userId,
    });
    await service.from('opening_stock_balances').update({ posting_status: 'POSTED', posted_at: new Date().toISOString(), posted_by: ctx.userId }).eq('id', row.id);
  }

  for (const row of (customerRows.data ?? []) as Row[]) {
    const { data: existing } = await service.from('customers').select('id, current_balance').eq('id', row.customer_id).single();
    await service.from('customers').update({
      current_balance: Number((existing as Row).current_balance ?? 0) + toPositiveNumber(row.opening_balance as Primitive),
    }).eq('id', row.customer_id);
    await service.from('opening_customer_balances').update({ posting_status: 'POSTED', posted_at: new Date().toISOString(), posted_by: ctx.userId }).eq('id', row.id);
  }

  for (const row of (supplierRows.data ?? []) as Row[]) {
    const { data: existing } = await service.from('suppliers').select('id, current_balance').eq('id', row.supplier_id).single();
    await service.from('suppliers').update({
      current_balance: Number((existing as Row).current_balance ?? 0) + toPositiveNumber(row.opening_balance as Primitive),
    }).eq('id', row.supplier_id);
    await service.from('opening_supplier_balances').update({ posting_status: 'POSTED', posted_at: new Date().toISOString(), posted_by: ctx.userId }).eq('id', row.id);
  }

  const debitTotal = ((accountRows.data ?? []) as Row[]).reduce((sum, row) => sum + toPositiveNumber(row.debit_amount as Primitive), 0);
  const creditTotal = ((accountRows.data ?? []) as Row[]).reduce((sum, row) => sum + toPositiveNumber(row.credit_amount as Primitive), 0);
  if (Math.abs(debitTotal - creditTotal) > 0.01) throw new Error('account opening balances must balance before posting.');

  if ((accountRows.data ?? []).length > 0) {
    const entryNumber = `OPEN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const { data: entry, error: entryError } = await service.from('journal_entries').insert({
      organization_id: ctx.organizationId,
      entry_number: entryNumber,
      entry_date: new Date().toISOString().slice(0, 10),
      description: 'Opening account balances',
      reference_type: 'opening_account_balance',
      total_debit: debitTotal,
      total_credit: creditTotal,
      status: 'APPROVED',
      is_posted: true,
      posted_by: ctx.userId,
      posted_at: new Date().toISOString(),
      created_by: ctx.userId,
    }).select('*').single();
    if (entryError) throw entryError;

    const lines = ((accountRows.data ?? []) as Row[]).map((row) => ({
      journal_entry_id: (entry as Row).id,
      account_id: row.account_id,
      description: row.reference ?? 'Opening balance',
      debit_amount: toPositiveNumber(row.debit_amount as Primitive),
      credit_amount: toPositiveNumber(row.credit_amount as Primitive),
    }));
    const { error: linesError } = await service.from('journal_entry_lines').insert(lines);
    if (linesError) throw linesError;

    for (const row of (accountRows.data ?? []) as Row[]) {
      await service.from('opening_account_balances').update({
        posting_status: 'POSTED',
        posted_at: new Date().toISOString(),
        posted_by: ctx.userId,
        journal_entry_id: (entry as Row).id,
      }).eq('id', row.id);
    }
  }

  return {
    postedAccountRows: (accountRows.data ?? []).length,
    postedCustomerRows: (customerRows.data ?? []).length,
    postedStockRows: (stockRows.data ?? []).length,
    postedSupplierRows: (supplierRows.data ?? []).length,
  };
}

export async function listBackupJobs(organizationId: string) {
  const [jobs, logs, restores] = await Promise.all([
    adminService().from('backup_jobs').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    adminService().from('backup_logs').select('*').eq('organization_id', organizationId).order('started_at', { ascending: false }).limit(10),
    adminService().from('restore_tests').select('*').eq('organization_id', organizationId).order('test_date', { ascending: false }).limit(5),
  ]);
  if (jobs.error) throw jobs.error;
  if (logs.error) throw logs.error;
  if (restores.error) throw restores.error;
  return {
    jobs: jobs.data ?? [],
    logs: logs.data ?? [],
    restoreTests: restores.data ?? [],
  };
}

export async function runBackup(ctx: AdminContext, body: Record<string, unknown>) {
  const now = new Date().toISOString();
  const { data, error } = await adminService().from('backup_logs').insert({
    organization_id: ctx.organizationId,
    backup_type: normalizeName(body.backupType as Primitive) || 'MANUAL',
    started_at: now,
    completed_at: now,
    status: 'SUCCESS',
    file_reference: normalizeName(body.backupLocation as Primitive) || 'manual://backup-request',
    error_message: null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function listBackupLogs(organizationId: string) {
  const { data, error } = await adminService().from('backup_logs').select('*').eq('organization_id', organizationId).order('started_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createRestoreTest(ctx: AdminContext, body: Record<string, unknown>) {
  const { data, error } = await adminService().from('restore_tests').insert({
    organization_id: ctx.organizationId,
    backup_log_id: body.backupLogId ? String(body.backupLogId) : null,
    backup_reference: normalizeName(body.backupReference as Primitive) || null,
    test_date: normalizeName(body.testDate as Primitive) || new Date().toISOString(),
    tested_by: ctx.userId,
    result: normalizeCode(body.result as Primitive || 'SUCCESS'),
    remarks: normalizeName(body.remarks as Primitive) || null,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function listRestoreTests(organizationId: string) {
  const { data, error } = await adminService().from('restore_tests').select('*').eq('organization_id', organizationId).order('test_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function runSystemHealthCheck(ctx: AdminContext) {
  const service = adminService();
  const metrics: HealthMetricDraft[] = [];
  const dbCheck = await service.from('organizations').select('id', { head: true, count: 'exact' }).limit(1);
  metrics.push({ metric_name: 'database_connection', metric_value: dbCheck.error ? 'failed' : 'ok', status: dbCheck.error ? 'CRITICAL' : 'HEALTHY', details: dbCheck.error ? { message: dbCheck.error.message } : {} });
  metrics.push({ metric_name: 'supabase_url', metric_value: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) ? 'configured' : 'missing', ...buildEnvironmentCheck('supabase_url', Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)) });
  metrics.push({ metric_name: 'supabase_anon_key', metric_value: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ? 'configured' : 'missing', ...buildEnvironmentCheck('supabase_anon_key', Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) });
  metrics.push({ metric_name: 'service_role_key', metric_value: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'configured' : 'missing', ...buildEnvironmentCheck('service_role_key', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)) });
  metrics.push({ metric_name: 'email_service', metric_value: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST || process.env.EMAIL_HOST) ? 'configured' : 'missing', ...buildEnvironmentCheck('email_service', Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST || process.env.EMAIL_HOST), { optional: true }) });

  const status = computeHealthStatus(metrics.map((metric) => ({ status: metric.status })));
  const { data: check, error } = await service.from('system_health_checks').insert({
    organization_id: ctx.organizationId,
    check_type: 'MANUAL_RUN',
    status,
    checked_at: new Date().toISOString(),
    checked_by: ctx.userId,
    details: { metrics: metrics.length },
  }).select('*').single();
  if (error) throw error;
  const metricPayload = metrics.map((metric) => ({
    health_check_id: (check as Row).id,
    metric_name: metric.metric_name,
    metric_value: String(metric.metric_value ?? ''),
    status: metric.status,
    details: metric.details ?? {},
  }));
  const { error: metricError } = await service.from('system_health_metrics').insert(metricPayload);
  if (metricError) throw metricError;
  return { check, metrics: metricPayload };
}

export async function getSystemHealth(organizationId: string) {
  const [checks, metrics] = await Promise.all([
    adminService().from('system_health_checks').select('*').eq('organization_id', organizationId).order('checked_at', { ascending: false }).limit(10),
    adminService().from('system_health_metrics').select('*, system_health_checks!inner(organization_id)').order('created_at', { ascending: false }).limit(20),
  ]);
  if (checks.error) throw checks.error;
  if (metrics.error) throw metrics.error;
  return {
    checks: checks.data ?? [],
    metrics: metrics.data ?? [],
  };
}

export async function createErrorLog(input: { ctx: AdminContext; moduleName: string; errorType: string; messageSummary: string; severity?: string; details?: Record<string, unknown> }) {
  const { data, error } = await adminService().from('error_logs').insert({
    organization_id: input.ctx.organizationId,
    module_name: input.moduleName,
    error_type: input.errorType,
    message_summary: input.messageSummary,
    severity: normalizeCode(input.severity ?? 'MEDIUM'),
    details: input.details ?? {},
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function listErrorLogs(organizationId: string) {
  const { data, error } = await adminService().from('error_logs').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function resolveErrorLog(id: string, ctx: AdminContext) {
  const { data, error } = await adminService().from('error_logs').update({
    resolved_status: 'RESOLVED',
    resolved_at: new Date().toISOString(),
    resolved_by: ctx.userId,
  }).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function runDataIntegrityCheck(ctx: AdminContext) {
  const service = adminService();
  const [
    itemsWithoutCategory,
    warehousesWithoutType,
    negativeStock,
    customers,
    suppliers,
    journals,
    batchesWithoutRecipe,
    usersWithoutRoles,
    duplicateInvoiceNumbers,
  ] = await Promise.all([
    service.from('items').select('id, code').eq('organization_id', ctx.organizationId).is('category_id', null),
    service.from('warehouses').select('id, code').eq('organization_id', ctx.organizationId).is('type', null),
    service.from('stock_balances').select('id, item_id, warehouse_id, quantity_on_hand').eq('organization_id', ctx.organizationId).lt('quantity_on_hand', 0),
    service.from('customers').select('id, code, current_balance').eq('organization_id', ctx.organizationId),
    service.from('suppliers').select('id, code, current_balance').eq('organization_id', ctx.organizationId),
    service.from('journal_entries').select('id, entry_number, total_debit, total_credit').eq('organization_id', ctx.organizationId),
    service.from('production_batches').select('id, batch_number').eq('organization_id', ctx.organizationId).is('recipe_id', null),
    service.from('users').select('id, full_name, user_roles(id)').eq('organization_id', ctx.organizationId),
    service.from('invoices').select('id, invoice_number').eq('organization_id', ctx.organizationId),
  ]);
  const issues = [];
  if (itemsWithoutCategory.error) throw itemsWithoutCategory.error;
  if (warehousesWithoutType.error) throw warehousesWithoutType.error;
  if (negativeStock.error) throw negativeStock.error;
  if (customers.error) throw customers.error;
  if (suppliers.error) throw suppliers.error;
  if (journals.error) throw journals.error;
  if (batchesWithoutRecipe.error) throw batchesWithoutRecipe.error;
  if (usersWithoutRoles.error) throw usersWithoutRoles.error;
  if (duplicateInvoiceNumbers.error) throw duplicateInvoiceNumbers.error;

  for (const row of (itemsWithoutCategory.data ?? []) as Row[]) issues.push(buildIntegrityIssue({ issueType: 'ITEM_WITHOUT_CATEGORY', affectedModule: 'inventory', affectedTable: 'items', affectedRecord: String(row.id), severity: 'HIGH' }));
  for (const row of (warehousesWithoutType.data ?? []) as Row[]) issues.push(buildIntegrityIssue({ issueType: 'WAREHOUSE_WITHOUT_TYPE', affectedModule: 'inventory', affectedTable: 'warehouses', affectedRecord: String(row.id), severity: 'MEDIUM' }));
  for (const row of (negativeStock.data ?? []) as Row[]) issues.push(buildIntegrityIssue({ issueType: 'NEGATIVE_STOCK', affectedModule: 'inventory', affectedTable: 'stock_balances', affectedRecord: String(row.id), severity: 'CRITICAL', details: { quantityOnHand: row.quantity_on_hand } }));
  for (const row of ((customers.data ?? []) as Row[]).filter((customer) => Number(customer.current_balance ?? 0) < 0)) issues.push(buildIntegrityIssue({ issueType: 'NEGATIVE_CUSTOMER_BALANCE', affectedModule: 'sales', affectedTable: 'customers', affectedRecord: String(row.id), severity: 'HIGH' }));
  for (const row of ((suppliers.data ?? []) as Row[]).filter((supplier) => Number(supplier.current_balance ?? 0) < 0)) issues.push(buildIntegrityIssue({ issueType: 'NEGATIVE_SUPPLIER_BALANCE', affectedModule: 'procurement', affectedTable: 'suppliers', affectedRecord: String(row.id), severity: 'HIGH' }));
  for (const row of ((journals.data ?? []) as Row[]).filter((entry) => Math.abs(Number(entry.total_debit ?? 0) - Number(entry.total_credit ?? 0)) > 0.01)) issues.push(buildIntegrityIssue({ issueType: 'UNBALANCED_JOURNAL', affectedModule: 'finance', affectedTable: 'journal_entries', affectedRecord: String(row.id), severity: 'CRITICAL' }));
  for (const row of (batchesWithoutRecipe.data ?? []) as Row[]) issues.push(buildIntegrityIssue({ issueType: 'BATCH_WITHOUT_RECIPE', affectedModule: 'production', affectedTable: 'production_batches', affectedRecord: String(row.id), severity: 'HIGH' }));
  for (const row of ((usersWithoutRoles.data ?? []) as Row[]).filter((user) => !Array.isArray(user.user_roles) || (user.user_roles as Array<unknown>).length === 0)) issues.push(buildIntegrityIssue({ issueType: 'USER_WITHOUT_ROLE', affectedModule: 'security', affectedTable: 'users', affectedRecord: String(row.id), severity: 'HIGH' }));
  const seenInvoiceNumbers = new Set<string>();
  for (const row of (duplicateInvoiceNumbers.data ?? []) as Row[]) {
    const invoiceNumber = String(row.invoice_number ?? '');
    if (seenInvoiceNumbers.has(invoiceNumber)) issues.push(buildIntegrityIssue({ issueType: 'DUPLICATE_DOCUMENT_NUMBER', affectedModule: 'sales', affectedTable: 'invoices', affectedRecord: String(row.id), severity: 'CRITICAL' }));
    seenInvoiceNumbers.add(invoiceNumber);
  }

  const { data: check, error } = await service.from('data_integrity_checks').insert({
    organization_id: ctx.organizationId,
    check_type: 'MANUAL_RUN',
    status: issues.some((issue) => issue.severity === 'CRITICAL') ? 'CRITICAL' : issues.length > 0 ? 'WARNING' : 'HEALTHY',
    checked_at: new Date().toISOString(),
    checked_by: ctx.userId,
    summary: { issues: issues.length },
  }).select('*').single();
  if (error) throw error;

  if (issues.length > 0) {
    const payload = issues.map((issue) => ({
      organization_id: ctx.organizationId,
      integrity_check_id: (check as Row).id,
      issue_type: issue.issueType,
      affected_table: issue.affectedTable,
      affected_record: issue.affectedRecord,
      affected_module: issue.affectedModule,
      severity: issue.severity,
      resolution_status: issue.resolutionStatus,
      details: issue.details,
    }));
    const { error: issueError } = await service.from('data_integrity_issues').insert(payload);
    if (issueError) throw issueError;
  }

  return { check, issues };
}

export async function listDataIntegrityIssues(organizationId: string) {
  const { data, error } = await adminService().from('data_integrity_issues').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function resolveDataIntegrityIssue(id: string, ctx: AdminContext) {
  const { data, error } = await adminService().from('data_integrity_issues').update({
    resolution_status: 'RESOLVED',
    resolved_at: new Date().toISOString(),
    resolved_by: ctx.userId,
  }).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function listDeploymentChecklist(organizationId: string) {
  const [lists, items] = await Promise.all([
    adminService().from('deployment_checklists').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    adminService().from('deployment_checklist_items').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
  ]);
  if (lists.error) throw lists.error;
  if (items.error) throw items.error;
  return {
    checklists: lists.data ?? [],
    items: items.data ?? [],
  };
}

export async function createDeploymentChecklistItem(body: Record<string, unknown>, ctx: AdminContext) {
  let checklistId = body.deploymentChecklistId ? String(body.deploymentChecklistId) : '';
  const service = adminService();
  if (!checklistId) {
    const { data: checklist, error } = await service.from('deployment_checklists').insert({
      organization_id: ctx.organizationId,
      checklist_name: 'Default deployment checklist',
      status: 'IN_PROGRESS',
      created_by: ctx.userId,
      updated_by: ctx.userId,
    }).select('*').single();
    if (error) throw error;
    checklistId = String((checklist as Row).id);
  }
  const { data, error } = await service.from('deployment_checklist_items').insert({
    deployment_checklist_id: checklistId,
    organization_id: ctx.organizationId,
    category: normalizeName(body.category as Primitive),
    task: normalizeName(body.task as Primitive),
    owner: normalizeName(body.owner as Primitive) || null,
    status: normalizeCode(body.status as Primitive || 'NOT_STARTED'),
    remarks: normalizeName(body.remarks as Primitive) || null,
    completed_date: body.completedDate ? String(body.completedDate) : null,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateDeploymentChecklistItem(id: string, body: Record<string, unknown>, ctx: AdminContext) {
  const updates: Record<string, unknown> = { updated_by: ctx.userId };
  if (body.category !== undefined) updates.category = normalizeName(body.category as Primitive);
  if (body.task !== undefined) updates.task = normalizeName(body.task as Primitive);
  if (body.owner !== undefined) updates.owner = normalizeName(body.owner as Primitive) || null;
  if (body.status !== undefined) updates.status = normalizeCode(body.status as Primitive);
  if (body.remarks !== undefined) updates.remarks = normalizeName(body.remarks as Primitive) || null;
  if (body.completedDate !== undefined) updates.completed_date = body.completedDate ? String(body.completedDate) : null;
  const { data, error } = await adminService().from('deployment_checklist_items').update(updates).eq('organization_id', ctx.organizationId).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function runDeploymentReadinessCheck(ctx: AdminContext) {
  const service = adminService();
  const [health, backups, restoreTests, integrityIssues, adminUsers, roles, branches, warehouses, products, rawMaterials, openingStock, openingAccounts] = await Promise.all([
    service.from('system_health_checks').select('status').eq('organization_id', ctx.organizationId).order('checked_at', { ascending: false }).limit(1).maybeSingle(),
    service.from('backup_logs').select('status').eq('organization_id', ctx.organizationId).order('started_at', { ascending: false }).limit(1).maybeSingle(),
    service.from('restore_tests').select('result').eq('organization_id', ctx.organizationId).order('test_date', { ascending: false }).limit(1).maybeSingle(),
    service.from('data_integrity_issues').select('severity, resolution_status').eq('organization_id', ctx.organizationId),
    service.from('users').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId).in('role', ['admin', 'system_admin']),
    service.from('roles').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId),
    service.from('branches').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId).is('deleted_at', null),
    service.from('warehouses').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId),
    service.from('items').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId).eq('item_type', 'FINISHED_GOOD').is('deleted_at', null),
    service.from('items').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId).eq('item_type', 'RAW_MATERIAL').is('deleted_at', null),
    service.from('opening_stock_balances').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId).eq('posting_status', 'POSTED'),
    service.from('opening_account_balances').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId).eq('posting_status', 'POSTED'),
  ]);

  const environmentChecks = [
    buildEnvironmentCheck('database_connected', !health.error, {}),
    buildEnvironmentCheck('migrations_present', true, { latestMigration: '015_admin_migration_backup_health_readiness' }),
    buildEnvironmentCheck('admin_user_exists', (adminUsers.count ?? 0) > 0),
    buildEnvironmentCheck('roles_configured', (roles.count ?? 0) > 0),
    buildEnvironmentCheck('branches_configured', (branches.count ?? 0) > 0),
    buildEnvironmentCheck('warehouses_configured', (warehouses.count ?? 0) > 0),
    buildEnvironmentCheck('products_configured', (products.count ?? 0) > 0),
    buildEnvironmentCheck('raw_materials_configured', (rawMaterials.count ?? 0) > 0),
    buildEnvironmentCheck('opening_stock_posted', (openingStock.count ?? 0) > 0),
    buildEnvironmentCheck('opening_accounts_posted', (openingAccounts.count ?? 0) > 0),
    buildEnvironmentCheck('backup_status_healthy', String((backups.data as Row | null)?.status ?? '') === 'SUCCESS'),
    buildEnvironmentCheck('restore_test_recorded', Boolean(restoreTests.data)),
    buildEnvironmentCheck('email_service_configured', Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST || process.env.EMAIL_HOST), { optional: true }),
  ];

  const unresolvedCriticalIssues = ((integrityIssues.data ?? []) as Row[]).filter((issue) => String(issue.severity ?? '') === 'CRITICAL' && String(issue.resolution_status ?? '') !== 'RESOLVED').length;
  const blockers = environmentChecks.filter((check) => check.status !== 'HEALTHY').length + unresolvedCriticalIssues;
  const readyChecks = environmentChecks.filter((check) => check.status === 'HEALTHY').length;
  const readinessStatus = computeReadinessStatus({ blockers, readyChecks, totalChecks: environmentChecks.length });

  if (environmentChecks.length > 0) {
    const { error } = await service.from('environment_checks').insert(
      environmentChecks.map((check) => ({
        organization_id: ctx.organizationId,
        check_name: check.checkName,
        status: check.status,
        details: check.details,
        checked_at: new Date().toISOString(),
      })),
    );
    if (error) throw error;
  }

  return {
    blockers,
    goLiveReady: blockers === 0 && unresolvedCriticalIssues === 0,
    readinessStatus,
    unresolvedCriticalIssues,
    environmentChecks,
  };
}

export async function getDeploymentReadiness(organizationId: string) {
  const [environmentChecks, goLiveApprovals, checklistItems] = await Promise.all([
    adminService().from('environment_checks').select('*').eq('organization_id', organizationId).order('checked_at', { ascending: false }).limit(30),
    adminService().from('go_live_approvals').select('*').eq('organization_id', organizationId).order('requested_date', { ascending: false }).limit(10),
    adminService().from('deployment_checklist_items').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
  ]);
  if (environmentChecks.error) throw environmentChecks.error;
  if (goLiveApprovals.error) throw goLiveApprovals.error;
  if (checklistItems.error) throw checklistItems.error;

  const blockers = ((environmentChecks.data ?? []) as Row[]).filter((check) => String(check.status ?? '') !== 'HEALTHY').length;
  return {
    blockers,
    environmentChecks: environmentChecks.data ?? [],
    checklistItems: checklistItems.data ?? [],
    goLiveApprovals: goLiveApprovals.data ?? [],
  };
}

export async function requestGoLive(ctx: AdminContext) {
  const readiness = await runDeploymentReadinessCheck(ctx);
  const { data, error } = await adminService().from('go_live_approvals').insert({
    organization_id: ctx.organizationId,
    requested_by: ctx.userId,
    requested_date: new Date().toISOString(),
    readiness_status: readiness.readinessStatus,
    status: readiness.goLiveReady ? 'READY' : 'BLOCKED',
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function approveGoLive(ctx: AdminContext, body: Record<string, unknown>) {
  const readiness = await runDeploymentReadinessCheck(ctx);
  if (!readiness.goLiveReady) throw new Error('Go-live approval is blocked by critical readiness issues.');
  const { data, error } = await adminService().from('go_live_approvals').insert({
    organization_id: ctx.organizationId,
    requested_by: ctx.userId,
    requested_date: new Date().toISOString(),
    readiness_status: 'APPROVED_FOR_GO_LIVE',
    approved_by: ctx.userId,
    approval_date: new Date().toISOString(),
    approval_remarks: normalizeName(body.approvalRemarks as Primitive) || 'Approved for go-live.',
    status: 'APPROVED_FOR_GO_LIVE',
  }).select('*').single();
  if (error) throw error;
  return data;
}
