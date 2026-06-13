export const SETTINGS_IMPORT_TEMPLATES = [
  'suppliers',
  'customers',
  'employees',
  'inventory-items',
  'products',
  'product-variants',
  'raw-materials',
  'packaging-materials',
  'warehouses',
  'branches',
  'recipes',
  'product-prices',
  'opening-stock-balances',
  'chart-of-accounts',
  'budgets',
  'fixed-assets',
  'qc-templates',
  'shift-schedules',
] as const;

export const SETTINGS_EXPORT_TYPES = [
  'suppliers',
  'customers',
  'employees',
  'products',
  'inventory-items',
  'warehouses',
  'branches',
  'recipes',
  'prices',
  'stock-balances',
  'chart-of-accounts',
  'budgets',
  'fixed-assets',
  'qc-templates',
  'audit-logs',
] as const;

export const DEFAULT_STOCK_CATEGORIES = [
  'Raw Materials',
  'Work-in-Progress',
  'Finished Goods',
  'Packaging Materials',
  'Non-Consumables',
] as const;

export const DEFAULT_FLAVOURS = ['Strawberry', 'Chocolate', 'Banana', 'Mint'] as const;
export const DEFAULT_CHOCOLATE_TYPES = ['White Chocolate', 'Dark Chocolate', 'Caramel'] as const;
export const DEFAULT_PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'EcoCash', 'Swipe', 'Credit'] as const;

type Primitive = string | number | boolean | null | undefined;

export interface SettingsImportError {
  row: number;
  field: string;
  message: string;
}

export interface SettingsImportValidationResult {
  errors: SettingsImportError[];
  rows: Array<Record<string, Primitive>>;
}

export function normalizeCode(value: Primitive) {
  return String(value ?? '').trim().toUpperCase();
}

export function normalizeName(value: Primitive) {
  return String(value ?? '').trim();
}

export function toPositiveNumber(value: Primitive, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function validateCodeAndName(input: {
  code?: Primitive;
  codeLabel?: string;
  name?: Primitive;
  nameLabel?: string;
}) {
  const code = normalizeCode(input.code);
  const name = normalizeName(input.name);
  if (!code) return `${input.codeLabel ?? 'code'} is required.`;
  if (!name) return `${input.nameLabel ?? 'name'} is required.`;
  return null;
}

export function validateUnitConversionFactor(value: Primitive) {
  const factor = toPositiveNumber(value);
  if (factor <= 0) return 'conversion factor must be greater than zero.';
  return null;
}

export function validateTaxRate(value: Primitive) {
  const rate = toPositiveNumber(value);
  if (rate < 0) return 'tax rate must not be negative.';
  return null;
}

export function validateNumberSequenceNextNumber(value: Primitive) {
  const nextNumber = Math.trunc(toPositiveNumber(value));
  if (nextNumber <= 0) return 'next number must be greater than zero.';
  return null;
}

export function validateShiftWindow(startTime: Primitive, endTime: Primitive) {
  const start = String(startTime ?? '').trim();
  const end = String(endTime ?? '').trim();
  if (!start || !end) return 'shift start time and end time are required.';
  if (start === end) return 'shift end time must not equal shift start time.';
  return null;
}

export function buildDocumentNumber(prefix: string, nextNumber: number, padding = 4) {
  return `${prefix}${String(nextNumber).padStart(padding, '0')}`;
}

export function validateImportRows(
  rows: Array<Record<string, Primitive>>,
  options: {
    existingCodes?: string[];
    requiredColumns: string[];
    validForeignKeys?: Record<string, string[]>;
    nonNegativeColumns?: string[];
  },
): SettingsImportValidationResult {
  const errors: SettingsImportError[] = [];
  const seenCodes = new Set((options.existingCodes ?? []).map((value) => normalizeCode(value)));
  const validForeignKeys = Object.fromEntries(
    Object.entries(options.validForeignKeys ?? {}).map(([key, values]) => [key, new Set(values.map((value) => normalizeCode(value)))]),
  );

  const normalizedRows = rows.map((row, index) => {
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
    ) as Record<string, Primitive>;

    for (const column of options.requiredColumns) {
      if (!normalizeName(normalized[column])) {
        errors.push({ row: index + 2, field: column, message: `${column} is required.` });
      }
    }

    const rowCode = normalizeCode(normalized.code ?? normalized.item_code ?? normalized.product_code ?? normalized.branch_code ?? normalized.warehouse_code);
    if (rowCode) {
      if (seenCodes.has(rowCode)) {
        errors.push({ row: index + 2, field: 'code', message: `Duplicate code: ${rowCode}.` });
      }
      seenCodes.add(rowCode);
    }

    for (const column of options.nonNegativeColumns ?? []) {
      const value = normalized[column];
      if (value !== undefined && value !== null && value !== '') {
        const parsed = toPositiveNumber(value, Number.NaN);
        if (!Number.isFinite(parsed) || parsed < 0) {
          errors.push({ row: index + 2, field: column, message: `${column} must not be negative.` });
        }
      }
    }

    for (const [field, allowed] of Object.entries(validForeignKeys)) {
      const value = normalizeCode(normalized[field]);
      if (value && !allowed.has(value)) {
        errors.push({ row: index + 2, field, message: `Invalid ${field}: ${value}.` });
      }
    }

    return normalized;
  });

  return { errors, rows: normalizedRows };
}

export function getSettingsTemplateColumns(templateType: string) {
  switch (templateType) {
    case 'products':
      return ['product_code', 'product_name', 'unit_code', 'stock_category', 'item_type'];
    case 'inventory-items':
    case 'raw-materials':
    case 'packaging-materials':
      return ['item_code', 'item_name', 'unit_code', 'category_code', 'item_type'];
    case 'warehouses':
      return ['warehouse_code', 'warehouse_name', 'warehouse_type'];
    case 'branches':
      return ['branch_code', 'branch_name'];
    case 'employees':
      return ['employee_code', 'full_name', 'department', 'job_role'];
    default:
      return ['code', 'name'];
  }
}
