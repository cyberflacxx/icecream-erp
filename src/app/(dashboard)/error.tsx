'use client';

import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    console.error('DashboardError boundary caught runtime error', {
      digest: error.digest ?? null,
      message: error.message,
      name: error.name,
      pathname,
      stack: error.stack ?? null,
    });
  }, [error, pathname]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center py-10">
      <section className="surface-card-lg w-full max-w-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-[color:var(--app-text)]">Dashboard page failed to load</h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--app-muted)]">
          This dashboard route hit a runtime error. Retry the page or return to the main dashboard.
        </p>
        <div className="mt-4 rounded-xl border border-[color:var(--app-border-muted)] bg-[color:var(--app-bg-subtle)] px-4 py-3 text-left text-xs text-[color:var(--app-muted)]">
          <p><span className="font-semibold text-[color:var(--app-text)]">Route:</span> {pathname || '/'}</p>
          <p className="mt-2"><span className="font-semibold text-[color:var(--app-text)]">Error ID:</span> {error.digest ?? 'runtime-error'}</p>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => reset()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry page
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
