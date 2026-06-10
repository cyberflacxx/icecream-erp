'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Clock,
  DollarSign,
  Plus,
  TrendingUp,
  UserCheck,
  Users
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';

const hrStats = [
  { label: 'Total Employees', value: '48', change: '3 on leave', icon: Users, color: 'text-indigo-400 border-indigo-400/20 bg-indigo-400/10' },
  { label: 'Present Today', value: '43', change: '5 absent', icon: UserCheck, color: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' },
  { label: 'Overtime Hours', value: '126h', change: 'This month', icon: Clock, color: 'text-amber-400 border-amber-400/20 bg-amber-400/10' },
  { label: 'Payroll This Month', value: '$28,400', change: 'Pending approval', icon: DollarSign, color: 'text-orange border-orange/20 bg-orange/10' },
];

const departments = [
  { name: 'Production', headcount: 18, shift: 'Day & Night', color: 'bg-violet-500' },
  { name: 'Stores & Inventory', headcount: 6, shift: 'Day', color: 'bg-emerald-500' },
  { name: 'Sales & Distribution', headcount: 10, shift: 'Day', color: 'bg-blue-500' },
  { name: 'Finance & Admin', headcount: 8, shift: 'Day', color: 'bg-orange-500' },
  { name: 'Maintenance', headcount: 4, shift: 'On-call', color: 'bg-cyan-500' },
  { name: 'Management', headcount: 2, shift: 'Day', color: 'bg-pink-500' },
];

const recentPayroll = [
  { employee: 'John Mwangi', role: 'Production Operator', basic: '$620', net: '$580', status: 'APPROVED' },
  { employee: 'Sarah Chikwanda', role: 'Store Keeper', basic: '$580', net: '$544', status: 'PENDING' },
  { employee: 'David Sibanda', role: 'Sales Rep', basic: '$650', net: '$610', status: 'APPROVED' },
  { employee: 'Grace Moyo', role: 'Accountant', basic: '$800', net: '$748', status: 'PENDING' },
];

const quickLinks = [
  { href: '/hr/employees', icon: Users, label: 'Employees', desc: 'Staff records and profiles' },
  { href: '/hr/attendance', icon: Calendar, label: 'Attendance', desc: 'Daily clock-in / clock-out tracking' },
  { href: '/hr/payroll', icon: DollarSign, label: 'Payroll', desc: 'Process and approve payroll runs' },
];

export default function HRPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="HR & Payroll"
        description="Employee records, attendance, leave management, shift allocations, and payroll processing."
        status="partial"
        actions={
          <Link
            href="/hr/employees/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Employee
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {hrStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-2xl border p-5 ${stat.color}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-white/50">{stat.label}</p>
                  <p className="mt-1.5 font-display text-2xl font-bold text-white">{stat.value}</p>
                  <p className="mt-1 text-xs text-white/40">{stat.change}</p>
                </div>
                <div className="rounded-xl border border-current/20 bg-current/10 p-2">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 p-5 transition-all hover:border-indigo-500/30 hover:bg-white/10"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">{link.label}</p>
                  <p className="text-xs text-white/40">{link.desc}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-indigo-400" />
            </Link>
          );
        })}
      </div>

      {/* Departments */}
      <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
        <h3 className="mb-4 font-display font-semibold text-white">Headcount by Department</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <div key={dept.name} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3">
              <div className={`h-10 w-1 flex-shrink-0 rounded-full ${dept.color}`} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{dept.name}</p>
                <p className="text-xs text-white/40">{dept.shift}</p>
              </div>
              <span className="font-display text-lg font-bold text-white">{dept.headcount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shift breakdown */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-orange" />
            <h4 className="font-semibold text-white">Day Shift</h4>
          </div>
          <p className="font-display text-3xl font-bold text-white">26</p>
          <p className="mt-1 text-xs text-white/40">employees assigned · 06:00 – 18:00</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[54%] rounded-full bg-orange" />
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
            <h4 className="font-semibold text-white">Night Shift</h4>
          </div>
          <p className="font-display text-3xl font-bold text-white">17</p>
          <p className="mt-1 text-xs text-white/40">employees assigned · 18:00 – 06:00</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[35%] rounded-full bg-indigo-400" />
          </div>
        </div>
      </div>

      {/* Recent payroll */}
      <div className="rounded-2xl border border-white/8 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="font-display font-semibold text-white">Payroll — Current Period</h3>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-emerald-400">$28,400 total</span>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {recentPayroll.map((record) => (
            <div key={record.employee} className="flex items-center justify-between px-5 py-4 transition hover:bg-white/5">
              <div>
                <p className="font-semibold text-white">{record.employee}</p>
                <p className="text-xs text-white/40">{record.role}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  record.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                }`}>
                  {record.status}
                </span>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{record.net}</p>
                  <p className="text-xs text-white/30">net · basic {record.basic}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
