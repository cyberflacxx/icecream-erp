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
