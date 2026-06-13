import { normalizeCode, normalizeName, toPositiveNumber, validateImportRows } from './settings';

type Primitive = string | number | boolean | null | undefined;

export const MIGRATION_STATUSES = [
  'DRAFT',
  'VALIDATING',
  'VALIDATED',
  'FAILED_VALIDATION',
  'PENDING_APPROVAL',
  'APPROVED',
  'IMPORTING',
  'IMPORTED',
  'PARTIALLY_IMPORTED',
  'FAILED',
  'ROLLED_BACK',
  'VOIDED',
] as const;

export const BACKUP_STATUSES = ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'RESTORE_TESTED'] as const;
export const HEALTH_STATUSES = ['HEALTHY', 'WARNING', 'CRITICAL', 'UNKNOWN'] as const;
export const READINESS_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'READY', 'BLOCKED', 'APPROVED_FOR_GO_LIVE'] as const;

export const MIGRATION_TEMPLATE_DEFINITIONS = {
  suppliers: ['code', 'name', 'category_code'],
  customers: ['code', 'name', 'customer_type'],
  employees: ['employee_number', 'first_name', 'last_name', 'hire_date'],
  branches: ['code', 'name'],
  warehouses: ['code', 'name', 'type'],
  'inventory-items': ['code', 'name', 'item_type', 'category_code', 'unit_code'],
  products: ['code', 'name', 'category_code', 'unit_code'],
  'product-variants': ['code', 'name', 'parent_code'],
  'raw-materials': ['code', 'name', 'category_code', 'unit_code'],
  'packaging-materials': ['code', 'name', 'category_code', 'unit_code'],
  recipes: ['recipe_code', 'recipe_name', 'finished_good_code', 'output_quantity', 'output_unit_code'],
  'opening-stock-balances': ['warehouse_code', 'item_code', 'opening_quantity', 'unit_cost'],
  'opening-customer-balances': ['customer_code', 'opening_invoice_reference', 'opening_balance'],
  'opening-supplier-balances': ['supplier_code', 'opening_invoice_reference', 'opening_balance'],
  'chart-of-accounts': ['account_code', 'account_name', 'account_type'],
  'opening-account-balances': ['account_code', 'debit_amount', 'credit_amount'],
  'fixed-assets': ['asset_code', 'asset_name', 'purchase_cost'],
  budgets: ['budget_code', 'budget_name', 'amount'],
  'price-lists': ['item_code', 'price'],
  discounts: ['discount_code', 'discount_name', 'rate'],
  'qc-templates': ['template_name', 'inspection_type'],
  'shift-schedules': ['shift_name', 'start_time', 'end_time'],
} as const;

export type MigrationTemplateType = keyof typeof MIGRATION_TEMPLATE_DEFINITIONS;

export function normalizeMigrationType(value: Primitive) {
  return normalizeName(value).toLowerCase().replace(/\s+/g, '-');
}

export function buildMigrationBatchNumber(sequence: number) {
  return `MIG-${String(sequence).padStart(5, '0')}`;
}

export function getMigrationTemplateColumns(type: string) {
  const columns = MIGRATION_TEMPLATE_DEFINITIONS[normalizeMigrationType(type) as MigrationTemplateType];
  return columns ? [...columns] : ['code', 'name'];
}

export function validateMigrationType(type: Primitive) {
  const normalized = normalizeMigrationType(type);
  if (!normalized) return 'migration type is required.';
  if (!(normalized in MIGRATION_TEMPLATE_DEFINITIONS)) return 'invalid migration type.';
  return null;
}

export function validateUploadPayload(input: { fileName?: Primitive; migrationType?: Primitive; rows?: Array<Record<string, Primitive>> }) {
  const typeError = validateMigrationType(input.migrationType);
  if (typeError) return typeError;
  if (!normalizeName(input.fileName)) return 'upload file is required.';
  if (!Array.isArray(input.rows) || input.rows.length === 0) return 'upload file must contain rows.';
  return null;
}

export function validateOpeningStockRow(row: Record<string, Primitive>) {
  if (!normalizeCode(row.warehouse_code)) return 'warehouse_code is required.';
  if (!normalizeCode(row.item_code)) return 'item_code is required.';
  if (toPositiveNumber(row.opening_quantity, Number.NaN) < 0) return 'opening quantity must not be negative.';
  if (toPositiveNumber(row.unit_cost, Number.NaN) < 0) return 'unit cost must not be negative.';
  return null;
}

export function validateOpeningBalanceRow(row: Record<string, Primitive>, codeField: string) {
  if (!normalizeCode(row[codeField])) return `${codeField} is required.`;
  if (toPositiveNumber(row.opening_balance, Number.NaN) < 0) return 'opening balance must not be negative.';
  return null;
}

export function validateOpeningAccountBalanceRows(rows: Array<Record<string, Primitive>>) {
  const invalid = rows.find((row) => !normalizeCode(row.account_code));
  if (invalid) return 'account_code is required.';
  const debit = rows.reduce((sum, row) => sum + toPositiveNumber(row.debit_amount), 0);
  const credit = rows.reduce((sum, row) => sum + toPositiveNumber(row.credit_amount), 0);
  if (Math.abs(debit - credit) > 0.01) return 'account opening balances must balance before posting.';
  return null;
}

export function validateMigrationRows(
  templateType: string,
  rows: Array<Record<string, Primitive>>,
  options: {
    existingCodes?: string[];
    validForeignKeys?: Record<string, string[]>;
  } = {},
) {
  const requiredColumns = getMigrationTemplateColumns(templateType);
  const validation = validateImportRows(rows, {
    existingCodes: options.existingCodes,
    nonNegativeColumns:
      templateType === 'opening-stock-balances'
        ? ['opening_quantity', 'unit_cost']
        : templateType === 'opening-account-balances'
          ? ['debit_amount', 'credit_amount']
          : ['opening_balance', 'price', 'amount', 'purchase_cost', 'rate'],
    requiredColumns,
    validForeignKeys: options.validForeignKeys,
  });

  if (normalizeMigrationType(templateType) === 'opening-stock-balances') {
    rows.forEach((row, index) => {
      const error = validateOpeningStockRow(row);
      if (error) validation.errors.push({ row: index + 2, field: 'opening_quantity', message: error });
    });
  }
  if (normalizeMigrationType(templateType) === 'opening-customer-balances') {
    rows.forEach((row, index) => {
      const error = validateOpeningBalanceRow(row, 'customer_code');
      if (error) validation.errors.push({ row: index + 2, field: 'opening_balance', message: error });
    });
  }
  if (normalizeMigrationType(templateType) === 'opening-supplier-balances') {
    rows.forEach((row, index) => {
      const error = validateOpeningBalanceRow(row, 'supplier_code');
      if (error) validation.errors.push({ row: index + 2, field: 'opening_balance', message: error });
    });
  }
  if (normalizeMigrationType(templateType) === 'opening-account-balances') {
    const headerError = validateOpeningAccountBalanceRows(rows);
    if (headerError) {
      validation.errors.push({ row: 1, field: 'debit_amount', message: headerError });
    }
  }

  return validation;
}

export function summarizeValidationResult(result: { errors: Array<{ field: string; message: string; row: number }>; rows: Array<Record<string, Primitive>> }) {
  return {
    failedRows: new Set(result.errors.map((error) => error.row)).size,
    successfulRows: Math.max(0, result.rows.length - new Set(result.errors.map((error) => error.row)).size),
    totalRows: result.rows.length,
  };
}

export function buildTemplateDownloadDefinition(type: string) {
  const columns = getMigrationTemplateColumns(type);
  return {
    templateType: normalizeMigrationType(type),
    columns,
    sampleRow: Object.fromEntries(columns.map((column) => [column, ''])),
  };
}

export function computeHealthStatus(metrics: Array<{ status: string }>) {
  const normalized = metrics.map((metric) => normalizeCode(metric.status));
  if (normalized.includes('CRITICAL')) return 'CRITICAL';
  if (normalized.includes('WARNING')) return 'WARNING';
  if (normalized.every((status) => status === 'HEALTHY')) return 'HEALTHY';
  return 'UNKNOWN';
}

export function computeReadinessStatus(input: { blockers: number; readyChecks: number; totalChecks: number }) {
  if (input.blockers > 0) return 'BLOCKED';
  if (input.totalChecks > 0 && input.readyChecks >= input.totalChecks) return 'READY';
  if (input.readyChecks > 0) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

export function buildIntegrityIssue(input: {
  affectedModule: string;
  affectedRecord?: string;
  affectedTable: string;
  details?: Record<string, unknown>;
  issueType: string;
  severity?: string;
}) {
  return {
    affectedModule: input.affectedModule,
    affectedRecord: input.affectedRecord ?? null,
    affectedTable: input.affectedTable,
    details: input.details ?? {},
    issueType: input.issueType,
    resolutionStatus: 'OPEN',
    severity: normalizeCode(input.severity ?? 'MEDIUM'),
  };
}

export function buildEnvironmentCheck(name: string, configured: boolean, details?: Record<string, unknown>) {
  return {
    checkName: name,
    details: details ?? {},
    status: configured ? 'HEALTHY' : 'WARNING',
  };
}
