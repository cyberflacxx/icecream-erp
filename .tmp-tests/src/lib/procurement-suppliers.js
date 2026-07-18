"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupplierActive = isSupplierActive;
exports.getSafeSupplierErrorDetails = getSafeSupplierErrorDetails;
exports.mapSupplierOption = mapSupplierOption;
exports.filterSupplierOptions = filterSupplierOptions;
exports.listSupplierOptionRecords = listSupplierOptionRecords;
const postgrest_compat_1 = require("./postgrest-compat");
const REQUIRED_SUPPLIER_COLUMNS = ['id', 'name'];
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
];
function isTruthyBoolean(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'active';
    }
    return false;
}
function sanitizeString(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function statusAllowsSupplier(status) {
    const normalized = String(status ?? '').trim().toUpperCase();
    if (!normalized)
        return true;
    return normalized === 'ACTIVE';
}
function isSupplierActive(row) {
    if ('is_active' in row) {
        return isTruthyBoolean(row.is_active);
    }
    if ('status' in row) {
        return statusAllowsSupplier(row.status);
    }
    return true;
}
function detectMissingSupplierColumn(error, availableColumns) {
    return availableColumns.find((column) => (0, postgrest_compat_1.isMissingColumnError)(error, 'suppliers', column)) ?? null;
}
function getSafeSupplierErrorDetails(error, step) {
    const message = (0, postgrest_compat_1.getErrorMessage)(error) || 'Unknown supplier error';
    const detail = typeof error === 'object' && error !== null && 'details' in error
        ? sanitizeString(error.details)
        : null;
    const code = typeof error === 'object' && error !== null && 'code' in error
        ? sanitizeString(error.code) ?? 'UNKNOWN'
        : 'UNKNOWN';
    return {
        code,
        detail,
        message,
        step,
        table: 'suppliers',
    };
}
function mapSupplierOption(row) {
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
    };
}
function filterSupplierOptions(rows, input = {}) {
    const normalizedSearch = String(input.search ?? '').trim().toLowerCase();
    return rows
        .filter((row) => !input.activeOnly || statusAllowsSupplier(row.status))
        .filter((row) => {
        if (!normalizedSearch)
            return true;
        return [row.code, row.name, row.email, row.phone, row.contactPerson]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    })
        .sort((left, right) => left.name.localeCompare(right.name));
}
async function listSupplierOptionRecords(service, organizationId) {
    let columns = [...REQUIRED_SUPPLIER_COLUMNS, ...OPTIONAL_SUPPLIER_COLUMNS];
    let lastError = null;
    while (columns.length >= REQUIRED_SUPPLIER_COLUMNS.length) {
        const { data, error } = await service
            .from('suppliers')
            .select(columns.join(', '))
            .eq('organization_id', organizationId)
            .order('name', { ascending: true });
        if (!error) {
            return (data ?? [])
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
