import type { ReactNode } from 'react';
import { Factory, ShieldCheck, Sparkles } from 'lucide-react';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

const highlights = [
  'Role-based access for every department',
  'Branch-aware visibility for operational users',
  'Real-time stock, production, and sales oversight'
];

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="rounded-[32px] bg-brown p-8 text-white shadow-soft sm:p-10 lg:p-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-vanilla">
            <Sparkles className="h-4 w-4" />
            {eyebrow}
          </div>
          <h1 className="mt-8 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/70">{description}</p>

          <div className="mt-10 space-y-4">
            {highlights.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
              >
                <ShieldCheck className="h-5 w-5 text-vanilla" />
                <span className="text-sm text-white/85">{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-5">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-orange text-white">
              <Factory className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Absolute Ice Cream ERP</p>
              <p className="text-sm text-white/70">Built for Absolute Quality Icecream</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-xl">{children}</section>
      </div>
    </main>
  );
}
