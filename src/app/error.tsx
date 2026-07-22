'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const currentUserQuery = useCurrentUser();
  const currentUserRole = currentUserQuery.data?.profile?.role ?? currentUserQuery.data?.roles?.[0]?.name ?? null;

  useEffect(() => {
    console.error('GlobalError boundary caught runtime error', {
      currentUserRole,
      digest: error.digest ?? null,
      message: error.message,
      name: error.name,
      pathname,
      stack: error.stack ?? null,
    });
  }, [currentUserRole, error, pathname]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--app-bg-canvas)]">
        <main className="section-shell flex min-h-screen items-center justify-center py-10">
          <section className="surface-card-lg w-full max-w-xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold text-[color:var(--app-text)]">
              Something went wrong
            </h1>
            <p className="mt-3 text-sm leading-6 text-[color:var(--app-muted)]">
              The page could not finish loading. Try the action again or return to the dashboard.
            </p>
            <p className="mt-4 rounded-xl border border-[color:var(--app-border-muted)] bg-[color:var(--app-bg-subtle)] px-4 py-3 text-left text-xs text-[color:var(--app-muted)]">
              {error.message || 'Unexpected application error.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button type="button" onClick={() => reset()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
