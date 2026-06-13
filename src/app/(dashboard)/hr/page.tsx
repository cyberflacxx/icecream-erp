'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Calendar, Clock, DollarSign, Loader2, Target, Users } from 'lucide-react';

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

  useEffect(() => {
    fetch('/api/hr/dashboard', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => setData(payload))
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
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-white/8 bg-white/5">
          <Loader2 className="h-5 w-5 animate-spin text-white/60" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/8 bg-white/5 p-5">
            <p className="text-xs text-white/40">{stat.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-white">{stat.value}</p>
            <p className="mt-1 text-xs text-white/35">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="group rounded-2xl border border-white/8 bg-white/5 p-5 transition hover:bg-white/10">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange/10 text-orange">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-1 group-hover:text-white" />
              </div>
              <p className="mt-4 font-semibold text-white">{item.label}</p>
              <p className="mt-1 text-sm text-white/45">{item.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
