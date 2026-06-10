/**
 * Excel export utilities using native CSV generation (no external dep needed).
 * For full .xlsx support, install: npm install xlsx
 */

type Row = Record<string, string | number | boolean | null | undefined>;

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export an array of objects to a CSV file download.
 */
export function exportToCsv(filename: string, rows: Row[], columns?: { key: string; header: string }[]): void {
  if (!rows.length) return;

  const keys = columns ? columns.map((c) => c.key) : Object.keys(rows[0] ?? {});
  const headers = columns ? columns.map((c) => c.header) : keys;

  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => keys.map((k) => escapeCsv(row[k])).join(',')),
  ];

  const csvContent = csvLines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export to JSON download (useful for data portability).
 */
export function exportToJson(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse a CSV file selected by the user and return rows as objects.
 */
export async function importFromCsv(file: File): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());
        if (lines.length < 2) return resolve([]);

        const headers = parseCsvLine(lines[0] ?? '');
        const rows = lines.slice(1).map((line) => {
          const values = parseCsvLine(line);
          return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Pre-built export templates for common ERP data.
 */
export const exportTemplates = {
  stockBalances: (data: Row[]) =>
    exportToCsv('stock-balances', data, [
      { key: 'item', header: 'Item Name' },
      { key: 'code', header: 'Item Code' },
      { key: 'type', header: 'Type' },
      { key: 'warehouse', header: 'Warehouse' },
      { key: 'quantity', header: 'Quantity' },
      { key: 'avgCost', header: 'Avg Cost' },
      { key: 'totalValue', header: 'Total Value' },
    ]),

  salesOrders: (data: Row[]) =>
    exportToCsv('sales-orders', data, [
      { key: 'orderNumber', header: 'Order #' },
      { key: 'customer', header: 'Customer' },
      { key: 'date', header: 'Date' },
      { key: 'total', header: 'Total Amount' },
      { key: 'status', header: 'Status' },
      { key: 'paymentMethod', header: 'Payment Method' },
    ]),

  productionBatches: (data: Row[]) =>
    exportToCsv('production-batches', data, [
      { key: 'batchNumber', header: 'Batch #' },
      { key: 'recipe', header: 'Recipe' },
      { key: 'shift', header: 'Shift' },
      { key: 'plannedQty', header: 'Planned Qty' },
      { key: 'actualQty', header: 'Actual Qty' },
      { key: 'yieldPercent', header: 'Yield %' },
      { key: 'costPerUnit', header: 'Cost/Unit' },
      { key: 'status', header: 'Status' },
    ]),

  payroll: (data: Row[]) =>
    exportToCsv('payroll', data, [
      { key: 'employeeNumber', header: 'Employee #' },
      { key: 'name', header: 'Name' },
      { key: 'department', header: 'Department' },
      { key: 'basicSalary', header: 'Basic' },
      { key: 'overtimePay', header: 'Overtime' },
      { key: 'allowances', header: 'Allowances' },
      { key: 'deductions', header: 'Deductions' },
      { key: 'taxDeduction', header: 'Tax' },
      { key: 'netPay', header: 'Net Pay' },
    ]),

  budgetVariance: (data: Row[]) =>
    exportToCsv('budget-variance', data, [
      { key: 'department', header: 'Department' },
      { key: 'budgetedAmount', header: 'Budget' },
      { key: 'actualAmount', header: 'Actual' },
      { key: 'variance', header: 'Variance' },
      { key: 'variancePct', header: 'Variance %' },
    ]),
};
