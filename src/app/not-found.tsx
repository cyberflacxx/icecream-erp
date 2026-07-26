'use client';

import Link from 'next/link';
import { Compass, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="section-shell flex min-h-screen items-center justify-center py-10">
      <section className="surface-card-lg w-full max-w-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)]">
          <Compass className="h-7 w-7" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--app-subtle)]">
          Absolute Ice Cream ERP
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[color:var(--app-text)]">
          This page could not be found
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--app-muted)]">
          The page you requested does not exist or may have moved to a different module.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild type="button">
            <Link href="/login">Go to Login</Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/dashboard">Open Dashboard</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </section>
    </main>
  );
}
