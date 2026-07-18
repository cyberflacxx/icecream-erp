import type { ReactNode } from 'react';
import Image from 'next/image';
import { Factory, ShieldCheck, Sparkles } from 'lucide-react';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

const highlights = [
  'Role-based access for every department',
  'Branch-aware visibility for operational teams',
  'Real-time production, stock, and sales oversight'
];

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[var(--app-bg-canvas)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <section className="order-2 rounded-[32px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-6 shadow-[var(--app-shadow-md)] sm:p-8 lg:order-1 lg:p-9">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] px-4 py-2 text-sm font-semibold text-[color:var(--app-text)]">
            <Sparkles className="h-4 w-4 text-[color:var(--app-accent)]" />
            {eyebrow}
          </div>

          <div className="mt-6 flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-bg-canvas)]">
              <Image
                src="/branding/logo.png"
                alt="Absolute Ice Cream ERP"
                width={60}
                height={60}
                className="h-14 w-14 scale-110 object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-[color:var(--app-text)]">
                Absolute Ice Cream ERP
              </p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--app-muted)]">
                Built for manufacturing, distribution, and branch operations.
              </p>
            </div>
          </div>

          <h1 className="mt-8 max-w-xl text-3xl font-semibold tracking-tight text-[color:var(--app-text)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--app-muted)] sm:text-base">
            {description}
          </p>

          <div className="mt-8 space-y-3">
            {highlights.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-border-muted)] bg-[color:var(--app-bg-default)] px-4 py-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg-canvas)]">
                  <ShieldCheck className="h-4 w-4 text-[color:var(--app-accent)]" />
                </div>
                <span className="text-sm text-[color:var(--app-text)]">{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-4 rounded-2xl border border-[color:var(--app-border-muted)] bg-[color:var(--app-bg-default)] px-4 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--app-accent-strong)] text-white">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[color:var(--app-text)]">Secure staff access</p>
              <p className="text-xs text-[color:var(--app-muted)]">Theme-aware, role-aware, and branch-aware workspace entry.</p>
            </div>
          </div>
        </section>

        <section className="order-1 mx-auto w-full max-w-xl lg:order-2">
          {children}
        </section>
      </div>
    </main>
  );
}
