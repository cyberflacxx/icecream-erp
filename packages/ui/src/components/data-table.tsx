import type { ReactNode } from 'react';

interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
  loading?: boolean;
  emptyState?: ReactNode;
}

export function DataTable<T extends object>({
  columns,
  data,
  pagination,
  loading = false,
  emptyState
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-2xl bg-cream dark:bg-darkBg" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:border-darkBorder dark:bg-darkCard">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border dark:divide-darkBorder">
          <thead className="bg-cream dark:bg-tableHeaderDark">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={
                    column.className ??
                    'px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-muted dark:text-darkMuted'
                  }
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-darkBorder">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-cream/40 dark:hover:bg-tableHoverDark">
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={column.className ?? 'px-5 py-4 text-sm text-brown dark:text-darkText'}
                  >
                    {column.render
                      ? column.render(row)
                      : String(row[column.key as keyof T] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination ? (
        <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm text-muted dark:border-darkBorder dark:text-darkMuted">
          <span>
            Page {pagination.page} of {Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}
          </span>
          <span>{pagination.total} total records</span>
        </div>
      ) : null}
    </div>
  );
}
