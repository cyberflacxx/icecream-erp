'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';

interface Column {
  key: string;
  label: string;
}

interface HrResourcePageProps {
  backHref?: string;
  columns: Column[];
  description: string;
  endpoint: string;
  title: string;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `${value.length} item(s)`;
    const record = value as Record<string, unknown>;
    if (record.name) return String(record.name);
    if (record.full_name) return String(record.full_name);
    if (record.first_name || record.last_name) return [record.first_name, record.last_name].filter(Boolean).join(' ');
    return JSON.stringify(value);
  }
  return String(value);
}

function flattenRows(payload: unknown) {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown[] }).data)) {
    return (payload as { data: Array<Record<string, unknown>> }).data;
  }
  return [];
}

export function HrResourcePage({ backHref = '/hr', columns, description, endpoint, title }: HrResourcePageProps) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(endpoint, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      })
      .then((payload) => {
        if (!mounted) return;
        setRows(flattenRows(payload));
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (!mounted) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load data.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [endpoint]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => formatCell(value).toLowerCase().includes(query)),
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        status="partial"
        actions={
          <Link href={backHref} className="inline-flex items-center gap-2 rounded-xl border border-brown/10 bg-white/80 px-3 py-2.5 text-sm text-brown/70 transition hover:bg-white hover:text-brown dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />

      <div className="dash-card flex items-center justify-between gap-3 p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${title.toLowerCase()}...`}
          className="w-full rounded-xl border border-border bg-cream px-4 py-2.5 text-sm text-brown outline-none placeholder:text-brown/35 dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30"
        />
        <div className="rounded-xl border border-brown/10 bg-white/70 px-3 py-2 text-xs text-brown/55 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
          {filteredRows.length} row(s)
        </div>
      </div>

      {loading ? (
        <div className="dash-card flex min-h-[220px] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-brown/60 dark:text-white/60" />
        </div>
      ) : error ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-6 text-center text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-200">
          <div className="space-y-3">
            <AlertCircle className="mx-auto h-6 w-6" />
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:border-white/8 dark:bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brown/10 bg-cream/70 dark:border-white/8 dark:bg-white/5">
                {columns.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-brown/45 dark:text-white/40">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="border-b border-brown/8 transition hover:bg-cream/55 last:border-0 dark:border-white/5 dark:hover:bg-white/5">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-brown/80 dark:text-white/80">
                      {formatCell(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-brown/45 dark:text-white/35">
                    No records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
