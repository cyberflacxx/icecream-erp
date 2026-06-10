'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, IceCream, Settings, User } from 'lucide-react';

const STORAGE_KEY = 'aqi_onboarded';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#1a0f08] border border-brown/15 dark:border-white/10 shadow-2xl overflow-hidden">

        {/* Header strip */}
        <div className="bg-gradient-to-r from-[#3B1F12] to-[#5c2e14] px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <IceCream className="h-6 w-6 text-orange-300" />
            <span className="text-xs font-semibold uppercase tracking-widest text-orange-200">Absolute Ice Cream ERP</span>
          </div>
          <h2 className="text-xl font-bold">
            Welcome{firstName ? `, ${firstName}` : ''}! 👋
          </h2>
          <p className="text-sm text-white/70 mt-1">Your account is ready. Here's what you can do.</p>
        </div>

        {/* Feature highlights */}
        <div className="px-6 py-4 space-y-3">
          {[
            { icon: '📊', label: 'Dashboard', desc: 'Live KPIs across all 13 modules' },
            { icon: '🏭', label: 'Production & Inventory', desc: 'Track batches, materials, and warehouse stock' },
            { icon: '💰', label: 'Finance & Sales', desc: 'Revenue, invoices, payroll, and cost accounting' },
            { icon: '👥', label: 'HR & Payroll', desc: 'Employees, attendance, and payroll summaries' },
            { icon: '🔔', label: 'Alerts', desc: 'Low-stock and expiry alerts run automatically' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="text-xl leading-none mt-0.5">{icon}</div>
              <div>
                <div className="text-sm font-semibold text-brown dark:text-orange-200">{label}</div>
                <div className="text-xs text-brown/60 dark:text-white/50">{desc}</div>
              </div>
              <CheckCircle2 className="ml-auto h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            </div>
          ))}
        </div>

        {/* Password reminder */}
        <div className="mx-6 mb-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/40 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">🔑 Default Password Reminder</p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Your initial password is your <strong>ID number</strong> in lowercase with no spaces or dashes.
            Please change it after your first login.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            onClick={() => { dismiss(); router.push('/settings/users'); }}
            className="flex items-center justify-between w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            <span className="flex items-center gap-2"><User className="h-4 w-4" /> Set up your profile</span>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={dismiss}
            className="w-full rounded-xl border border-brown/15 dark:border-white/10 bg-white dark:bg-white/5 text-brown dark:text-white/80 px-4 py-2.5 text-sm font-semibold hover:bg-brown/5 dark:hover:bg-white/10 transition-colors"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
