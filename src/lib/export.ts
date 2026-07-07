/**
 * Excel export utilities using native CSV generation (no external dep needed).
 * For full .xlsx support, install: npm install xlsx
 */

type Row = Record<string, string | number | boolean | null | undefined>;

interface DownloadFromUrlOptions {
  filename?: string;
  init?: RequestInit;
}

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sanitizeDownloadFilename(filename: string, fallback = 'download'): string {
  const trimmed = filename.trim();
  const cleaned = trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ');
  return cleaned || fallback;
}

function fallbackFilenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    return sanitizeDownloadFilename(lastSegment ?? 'download');
  } catch {
    return 'download';
  }
}

export function getFilenameFromContentDisposition(
  contentDisposition: string | null | undefined,
  fallback = 'download',
): string {
  if (!contentDisposition) return sanitizeDownloadFilename(fallback);

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return sanitizeDownloadFilename(decodeURIComponent(utf8Match[1]));
    } catch {
      return sanitizeDownloadFilename(utf8Match[1], fallback);
    }
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return sanitizeDownloadFilename(quotedMatch[1], fallback);
  }

  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) {
    return sanitizeDownloadFilename(plainMatch[1].trim(), fallback);
  }

  return sanitizeDownloadFilename(fallback);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeDownloadFilename(filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function downloadFromUrl(url: string, options?: DownloadFromUrlOptions): Promise<string> {
  const response = await fetch(url, {
    credentials: 'include',
    ...options?.init,
  });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}.`);
  }

  const blob = await response.blob();
  const filename = getFilenameFromContentDisposition(
    response.headers.get('content-disposition'),
    options?.filename ?? fallbackFilenameFromUrl(url),
  );

  downloadBlob(blob, filename);
  return filename;
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
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export to JSON download (useful for data portability).
 */
export function exportToJson(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
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
