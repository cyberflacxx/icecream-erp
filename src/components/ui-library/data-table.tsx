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
      <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-5 shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-lg bg-[color:var(--app-bg-subtle)]" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[color:var(--app-border-muted)]">
          <thead className="bg-[color:var(--app-bg-subtle)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={
                    column.className ??
                    'px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-subtle)]'
                  }
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--app-border-muted)]">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="transition hover:bg-[color:var(--app-bg-subtle)]/70">
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={column.className ?? 'px-5 py-4 align-top text-sm leading-6 text-[color:var(--app-text)]'}
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
        <div className="flex items-center justify-between border-t border-[color:var(--app-border-muted)] px-4 py-3 text-sm text-[color:var(--app-muted)]">
          <span>
            Page {pagination.page} of {Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}
          </span>
          <span>{pagination.total} total records</span>
        </div>
      ) : null}
    </div>
  );
}
