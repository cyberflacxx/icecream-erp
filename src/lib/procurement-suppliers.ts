import { isMissingColumnError, getErrorMessage } from './postgrest-compat';

const REQUIRED_SUPPLIER_COLUMNS = ['id', 'name'] as const;
const OPTIONAL_SUPPLIER_COLUMNS = [
  'code',
  'contact_person',
  'email',
  'phone',
  'status',
  'payment_terms',
  'credit_limit',
  'category_id',
  'is_active',
  'deleted_at',
] as const;

export interface SupplierOptionRecord {
  code: string | null;
  contactPerson: string | null;
  creditLimit: number | null;
  email: string | null;
  id: string;
  name: string;
  paymentTerms: string | null;
  phone: string | null;
  status: string | null;
}

type SupabaseSchemaClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        order: (column: string, options?: { ascending?: boolean }) => Promise<{
          data: unknown[] | null;
          error: unknown;
        }>;
      };
    };
  };
};

function isTruthyBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'active';
  }
  return false;
}

function sanitizeString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function statusAllowsSupplier(status: unknown) {
  const normalized = String(status ?? '').trim().toUpperCase();
  if (!normalized) return true;
  return normalized === 'ACTIVE';
}

export function isSupplierActive(row: Record<string, unknown>) {
  if ('is_active' in row) {
    return isTruthyBoolean(row.is_active);
  }

  if ('status' in row) {
    return statusAllowsSupplier(row.status);
  }

  return true;
}

function detectMissingSupplierColumn(error: unknown, availableColumns: readonly string[]) {
  return availableColumns.find((column) => isMissingColumnError(error, 'suppliers', column)) ?? null;
}

export function getSafeSupplierErrorDetails(error: unknown, step: string) {
  const message = getErrorMessage(error) || 'Unknown supplier error';
  const detail =
    typeof error === 'object' && error !== null && 'details' in error
      ? sanitizeString((error as { details?: unknown }).details)
      : null;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? sanitizeString((error as { code?: unknown }).code) ?? 'UNKNOWN'
      : 'UNKNOWN';

  return {
    code,
    detail,
    message,
    step,
    table: 'suppliers',
  };
}

export function mapSupplierOption(row: Record<string, unknown>) {
  return {
    code: sanitizeString(row.code),
    contactPerson: sanitizeString(row.contact_person),
    creditLimit: row.credit_limit === null || row.credit_limit === undefined ? null : Number(row.credit_limit),
    email: sanitizeString(row.email),
    id: String(row.id),
    name: String(row.name),
    paymentTerms: sanitizeString(row.payment_terms),
    phone: sanitizeString(row.phone),
    status: sanitizeString(row.status),
  } satisfies SupplierOptionRecord;
}

export function filterSupplierOptions(
  rows: SupplierOptionRecord[],
  input: { activeOnly?: boolean; search?: string | null } = {},
) {
  const normalizedSearch = String(input.search ?? '').trim().toLowerCase();

  return rows
    .filter((row) => !input.activeOnly || statusAllowsSupplier(row.status))
    .filter((row) => {
      if (!normalizedSearch) return true;
      return [row.code, row.name, row.email, row.phone, row.contactPerson]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function listSupplierOptionRecords(
  service: SupabaseSchemaClient,
  organizationId: string,
) {
  let columns = [...REQUIRED_SUPPLIER_COLUMNS, ...OPTIONAL_SUPPLIER_COLUMNS];
  let lastError: unknown = null;

  while (columns.length >= REQUIRED_SUPPLIER_COLUMNS.length) {
    const { data, error } = await service
      .from('suppliers')
      .select(columns.join(', '))
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });

    if (!error) {
      return ((data ?? []) as Array<Record<string, unknown>>)
        .filter((row) => row?.id && row?.name)
        .filter((row) => !('deleted_at' in row) || row.deleted_at === null)
        .filter(isSupplierActive)
        .map(mapSupplierOption);
    }

    lastError = error;
    const missingColumn = detectMissingSupplierColumn(error, OPTIONAL_SUPPLIER_COLUMNS);
    if (!missingColumn) {
      throw error;
    }

    columns = columns.filter((column) => column !== missingColumn);
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to load suppliers.');
}
