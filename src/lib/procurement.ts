export type SupplierShortageReportRow = {
  ageInDays: number;
  expectedResolutionDate: string | null;
  itemName: string;
  orderedQuantity: number;
  poNumber: string;
  receivedQuantity: number;
  shortageQuantity: number;
  status: 'OPEN' | 'PARTIALLY_DELIVERED' | 'RESOLVED';
  supplierName: string;
};

export type InvoiceAgeingRow = {
  balance: number;
  dueDate: string | null;
  invoiceDate: string | null;
  invoiceNumber: string;
  overdueDays: number;
  paidAmount: number;
  status: string;
  supplierName: string;
  total: number;
};

export type CostVarianceRow = {
  invoiceNumber: string;
  invoiceUnitCost: number;
  itemName: string;
  poNumber: string;
  poUnitCost: number;
  priceVariance: number;
  quantity: number;
  supplierName: string;
};

export const SUPPLIER_IMPORT_TEMPLATE_HEADERS = [
  'Supplier Code',
  'Supplier Name',
  'Contact Person',
  'Email Address',
  'Telephone Number',
  'Physical Address',
  'VAT/Tax Number',
  'Payment Terms',
  'Credit Limit',
  'Currency',
  'Status',
] as const;

export type SupplierImportTemplateHeader = (typeof SUPPLIER_IMPORT_TEMPLATE_HEADERS)[number];

export interface SupplierImportRowInput {
  address: string | null;
  code: string;
  contactPerson: string | null;
  creditLimit: number;
  currency: string;
  email: string | null;
  name: string;
  paymentTerms: string | null;
  phone: string | null;
  rowNumber: number;
  status: 'ACTIVE' | 'INACTIVE';
  taxNumber: string | null;
}

export interface SupplierImportValidationResult {
  errors: Array<{ message: string; row: number }>;
  rows: SupplierImportRowInput[];
}

export function buildSupplierShortageRows(
  purchaseOrders: Array<Record<string, unknown>>,
): SupplierShortageReportRow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows: SupplierShortageReportRow[] = [];

  for (const order of purchaseOrders) {
    const supplier = firstObject(order.suppliers);
    const items = asArray(order.purchase_order_items);
    const expectedDate = order.expected_delivery_date ? new Date(String(order.expected_delivery_date)) : null;
    const ageInDays =
      expectedDate
        ? Math.max(0, Math.floor((today.getTime() - expectedDate.getTime()) / (24 * 60 * 60 * 1000)))
        : 0;

    for (const itemRow of items) {
      const item = firstObject(itemRow.items);
      const orderedQuantity = toNumber(itemRow.quantity_ordered);
      const receivedQuantity = toNumber(itemRow.quantity_received);
      const shortageQuantity = Math.max(0, orderedQuantity - receivedQuantity);

      if (shortageQuantity <= 0) continue;

      rows.push({
        ageInDays,
        expectedResolutionDate: order.expected_delivery_date ? String(order.expected_delivery_date) : null,
        itemName: String(item?.name ?? 'Unknown item'),
        orderedQuantity,
        poNumber: String(order.po_number ?? ''),
        receivedQuantity,
        shortageQuantity,
        status: receivedQuantity <= 0 ? 'OPEN' : 'PARTIALLY_DELIVERED',
        supplierName: String(supplier?.name ?? 'Unknown supplier'),
      });
    }
  }

  return rows.sort((a, b) => b.shortageQuantity - a.shortageQuantity);
}

export function buildInvoiceAgeingRows(
  invoices: Array<Record<string, unknown>>,
  paymentsByInvoiceId: Map<string, number>,
): InvoiceAgeingRow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return invoices.map((invoice) => {
    const supplier = firstObject(invoice.suppliers);
    const total = toNumber(invoice.invoice_total ?? invoice.total);
    const paidAmount = paymentsByInvoiceId.get(String(invoice.id)) ?? 0;
    const balance = Math.max(0, total - paidAmount);
    const dueDate = invoice.due_date ? new Date(String(invoice.due_date)) : null;
    const overdueDays =
      dueDate && balance > 0
        ? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)))
        : 0;

    return {
      balance,
      dueDate: invoice.due_date ? String(invoice.due_date) : null,
      invoiceDate: invoice.invoice_date ? String(invoice.invoice_date) : null,
      invoiceNumber: String(invoice.invoice_number ?? ''),
      overdueDays,
      paidAmount,
      status: String(invoice.status ?? 'PENDING'),
      supplierName: String(supplier?.name ?? 'Unknown supplier'),
      total,
    };
  });
}

export function buildCostVarianceRows(invoices: Array<Record<string, unknown>>): CostVarianceRow[] {
  const rows: CostVarianceRow[] = [];

  for (const invoice of invoices) {
    const supplier = firstObject(invoice.suppliers);
    const po = firstObject(invoice.purchase_orders);
    const items = asArray(invoice.supplier_invoice_items);

    for (const itemRow of items) {
      const item = firstObject(itemRow.items);
      const quantity = toNumber(itemRow.quantity_invoiced ?? itemRow.quantity);
      const poUnitCost = toNumber(itemRow.po_unit_cost ?? itemRow.unit_cost_reference);
      const invoiceUnitCost = toNumber(itemRow.unit_cost);

      rows.push({
        invoiceNumber: String(invoice.invoice_number ?? ''),
        invoiceUnitCost,
        itemName: String(item?.name ?? 'Unknown item'),
        poNumber: String(po?.po_number ?? ''),
        poUnitCost,
        priceVariance: invoiceUnitCost - poUnitCost,
        quantity,
        supplierName: String(supplier?.name ?? 'Unknown supplier'),
      });
    }
  }

  return rows;
}

export function validateSupplierCodeUniqueness(existingCodes: string[], nextCode: string) {
  return !existingCodes.map((code) => code.trim().toUpperCase()).includes(nextCode.trim().toUpperCase());
}

export function canPayInvoice(balance: number, attemptedPayment: number) {
  return attemptedPayment > 0 && attemptedPayment <= balance;
}

export function buildSupplierImportTemplateCsv() {
  const sampleRow = [
    'SUP-00001',
    'Example Supplier',
    'Patience Moyo',
    'supplier@example.com',
    '+263771234567',
    '12 Cold Chain Avenue, Harare',
    'VAT-001',
    '30 DAYS',
    '1500',
    'USD',
    'ACTIVE',
  ];

  return [SUPPLIER_IMPORT_TEMPLATE_HEADERS.join(','), sampleRow.join(',')].join('\n');
}

export function validateSupplierImportRows(
  inputRows: Array<Record<string, unknown>>,
  existingCodes: string[] = [],
): SupplierImportValidationResult {
  const seenCodes = new Set(existingCodes.map((code) => normalizeToken(code)));
  const rows: SupplierImportRowInput[] = [];
  const errors: Array<{ message: string; row: number }> = [];

  inputRows.forEach((row, index) => {
    const normalized = normalizeSupplierImportRow(row, index + 1);
    const codeToken = normalizeToken(normalized.code);

    if (!normalized.code) {
      errors.push({ message: 'Supplier Code is required.', row: normalized.rowNumber });
    }
    if (!normalized.name) {
      errors.push({ message: 'Supplier Name is required.', row: normalized.rowNumber });
    }
    if (!normalized.currency) {
      errors.push({ message: 'Currency is required.', row: normalized.rowNumber });
    }
    if (codeToken && seenCodes.has(codeToken)) {
      errors.push({ message: 'Duplicate supplier code detected.', row: normalized.rowNumber });
    }
    if (normalized.email && !isValidEmail(normalized.email)) {
      errors.push({ message: 'Email Address is invalid.', row: normalized.rowNumber });
    }
    if (normalized.creditLimit < 0) {
      errors.push({ message: 'Credit Limit cannot be negative.', row: normalized.rowNumber });
    }
    if (normalized.paymentTerms && !isValidSupplierPaymentTerms(normalized.paymentTerms)) {
      errors.push({ message: 'Payment Terms is invalid.', row: normalized.rowNumber });
    }

    if (errors.some((error) => error.row === normalized.rowNumber)) {
      return;
    }

    seenCodes.add(codeToken);
    rows.push(normalized);
  });

  return { errors, rows };
}

export function normalizeSupplierImportRow(
  row: Record<string, unknown>,
  rowNumber: number,
): SupplierImportRowInput {
  const code = readValue(row, ['Supplier Code', 'supplierCode', 'code']);
  const name = readValue(row, ['Supplier Name', 'supplierName', 'name']);
  const contactPerson = readValue(row, ['Contact Person', 'contactPerson']);
  const email = readValue(row, ['Email Address', 'emailAddress', 'email']);
  const phone = readValue(row, ['Telephone Number', 'telephoneNumber', 'phone']);
  const address = readValue(row, ['Physical Address', 'physicalAddress', 'address']);
  const taxNumber = readValue(row, ['VAT/Tax Number', 'vatOrTaxNumber', 'taxNumber']);
  const paymentTerms = normalizePaymentTerms(readValue(row, ['Payment Terms', 'paymentTerms']));
  const creditLimit = toNumber(readValue(row, ['Credit Limit', 'creditLimit']), 0);
  const currency = readValue(row, ['Currency', 'currency']).toUpperCase();
  const status = normalizeSupplierStatus(readValue(row, ['Status', 'accountStatus', 'status']));

  return {
    address: address || null,
    code,
    contactPerson: contactPerson || null,
    creditLimit,
    currency,
    email: email || null,
    name,
    paymentTerms,
    phone: phone || null,
    rowNumber,
    status,
    taxNumber: taxNumber || null,
  };
}

export function normalizeSupplierStatus(value: string) {
  return normalizeToken(value) === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
}

export function normalizePaymentTerms(value: string) {
  const normalized = normalizeToken(value).replace(/_/g, ' ');
  return normalized || null;
}

export function isValidSupplierPaymentTerms(value: string) {
  const normalized = normalizePaymentTerms(value);
  return normalized !== null && ['7 DAYS', '14 DAYS', '30 DAYS', 'COD', 'IMMEDIATE'].includes(normalized);
}

function toNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
}

function firstObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }

  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return null;
}

function readValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = row[key];
    if (raw === undefined || raw === null) continue;
    const text = String(raw).trim();
    if (text) return text;
  }

  return '';
}

function normalizeToken(value: string) {
  return String(value ?? '').trim().toUpperCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
