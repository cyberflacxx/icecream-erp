'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, IceCream, User } from 'lucide-react';

const STORAGE_KEY = 'aqi_onboarded';

const featureHighlights = [
  { step: '1', label: 'Dashboard', desc: 'Live KPIs across all 13 modules' },
  { step: '2', label: 'Production & Inventory', desc: 'Track batches, materials, and warehouse stock' },
  { step: '3', label: 'Finance & Sales', desc: 'Revenue, invoices, payroll, and cost accounting' },
  { step: '4', label: 'HR & Payroll', desc: 'Employees, attendance, and payroll summaries' },
  { step: '5', label: 'Alerts', desc: 'Low-stock and expiry alerts run automatically' },
] as const;

export function WelcomeModal({ firstName }: { firstName?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.55)] p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-[var(--app-shadow-lg)]">
        <div className="bg-gradient-to-r from-[#111b2d] to-[#1f3a63] px-6 py-5 text-white">
          <div className="mb-1 flex items-center gap-3">
            <IceCream className="h-6 w-6 text-blue-200" />
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-100">
              Absolute Ice Cream ERP
            </span>
          </div>
          <h2 className="text-xl font-bold">Welcome{firstName ? `, ${firstName}` : ''}!</h2>
          <p className="mt-1 text-sm text-white/70">
            Your account is ready. Here&apos;s what you can do.
          </p>
        </div>

        <div className="space-y-3 px-6 py-4">
          {featureHighlights.map(({ step, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--app-bg-subtle)] text-xs font-semibold text-[color:var(--app-accent-strong)]">
                {step}
              </div>
              <div>
                <div className="text-sm font-semibold text-[color:var(--app-text)]">{label}</div>
                <div className="text-xs text-[color:var(--app-muted)]">{desc}</div>
              </div>
              <CheckCircle2 className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            </div>
          ))}
        </div>

        <div className="mx-6 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-amber-800">Default Password Reminder</p>
          <p className="text-xs text-amber-700">
            Your initial password is your <strong>ID number</strong> in lowercase with no spaces or dashes.
            Please change it after your first login.
          </p>
        </div>

        <div className="flex flex-col gap-2 px-6 pb-6">
          <button
            onClick={() => {
              dismiss();
              router.push('/settings/users');
            }}
            className="flex w-full items-center justify-between rounded-lg bg-[color:var(--app-accent-strong)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--app-accent)]"
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Set up your profile
            </span>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={dismiss}
            className="w-full rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-2.5 text-sm font-semibold text-[color:var(--app-text)] transition-colors hover:bg-[color:var(--app-bg-subtle)]"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
