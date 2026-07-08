import Link from 'next/link';
import { Compass } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="section-shell flex min-h-screen items-center justify-center py-10">
      <section className="surface-card-lg w-full max-w-xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent-strong)]">
          <Compass className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-[color:var(--app-text)]">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--app-muted)]">
          The page you requested does not exist or may have moved to a different module.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild type="button">
            <Link href="/dashboard">Open Dashboard</Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/">Go to Homepage</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
