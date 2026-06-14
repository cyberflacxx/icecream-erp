'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Calendar, Clock, DollarSign, Loader2, Target, Users } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';

const quickLinks = [
  { href: '/hr/employees', label: 'Employees', desc: 'Employee master data', icon: Users },
  { href: '/hr/attendance', label: 'Attendance', desc: 'Shift attendance and approvals', icon: Calendar },
  { href: '/hr/shifts', label: 'Shifts', desc: 'Shift definitions and schedules', icon: Clock },
  { href: '/hr/productivity', label: 'Productivity', desc: 'Output per operator and shift', icon: Target },
  { href: '/hr/payroll', label: 'Payroll', desc: 'Payroll periods and summaries', icon: DollarSign },
];

export default function HRPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/hr/dashboard', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(payload.error ?? 'Failed to load HR dashboard.');
        }
        return response.json();
      })
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((fetchError: unknown) => {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load HR dashboard.');
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: 'Total Employees', value: Number(data?.totalEmployees ?? 0), sub: `${Number(data?.activeEmployees ?? 0)} active` },
    { label: 'Today Attendance', value: Number(data?.todayAttendance ?? 0), sub: `${Number(data?.absentEmployees ?? 0)} absent` },
    { label: 'Late Employees', value: Number(data?.lateEmployees ?? 0), sub: `${Number(data?.activeShifts ?? 0)} active shifts` },
    { label: 'Payroll Pending', value: Number(data?.payrollPendingApproval ?? 0), sub: `${Number(data?.overtimePendingApproval ?? 0)} overtime pending` },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="HR & Productivity"
        description="Employees, shifts, attendance, labour costing, productivity, overtime, and payroll-ready records."
        status="partial"
      />

      {loading ? (
        <div className="dash-card flex min-h-[180px] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-brown/60 dark:text-white/60" />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="dash-card p-5">
            <p className="text-xs text-brown/50 dark:text-white/40">{stat.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-brown dark:text-white">{stat.value}</p>
            <p className="mt-1 text-xs text-brown/45 dark:text-white/35">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="dash-card group rounded-2xl p-5 transition hover:border-orange/30 hover:bg-white/90 dark:hover:bg-white/10">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange/10 text-orange">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-brown/35 transition group-hover:translate-x-1 group-hover:text-brown dark:text-white/30 dark:group-hover:text-white" />
              </div>
              <p className="mt-4 font-semibold text-brown dark:text-white">{item.label}</p>
              <p className="mt-1 text-sm text-brown/55 dark:text-white/45">{item.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
