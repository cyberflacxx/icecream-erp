'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Settings,
  Wrench,
  XCircle,
} from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';

const maintenanceStats = [
  {
    label: 'Active Machines',
    value: '12',
    sub: 'All operational',
    icon: Settings,
    color:
      'text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900/30 dark:bg-emerald-950/20',
  },
  {
    label: 'Scheduled This Week',
    value: '3',
    sub: 'Preventive tasks',
    icon: Clock,
    color:
      'text-orange-700 border-orange-200 bg-orange-50 dark:text-orange-300 dark:border-orange-900/30 dark:bg-orange-950/20',
  },
  {
    label: 'Overdue',
    value: '1',
    sub: 'Requires attention',
    icon: AlertTriangle,
    color:
      'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-300 dark:border-amber-900/30 dark:bg-amber-950/20',
  },
  {
    label: 'Repair Cost MTD',
    value: '$840',
    sub: 'Parts + labour',
    icon: DollarSign,
    color: 'text-brown border-border bg-white dark:text-darkText dark:border-darkBorder dark:bg-darkCard',
  },
] as const;

const machines = [
  { id: 'MC-001', name: 'Ice Cream Freezer Line A', status: 'OPERATIONAL', nextService: '2026-06-15', lastService: '2026-05-15', downtime: '0h' },
  { id: 'MC-002', name: 'Cone Moulding Machine', status: 'OPERATIONAL', nextService: '2026-06-20', lastService: '2026-05-20', downtime: '0h' },
  { id: 'MC-003', name: 'Chocolate Coating Unit', status: 'BREAKDOWN', nextService: 'In repair', lastService: '2026-06-01', downtime: '4h' },
  { id: 'MC-004', name: 'Packaging Line', status: 'OPERATIONAL', nextService: '2026-07-01', lastService: '2026-06-01', downtime: '0h' },
  { id: 'MC-005', name: 'Cold Room Compressor 1', status: 'OPERATIONAL', nextService: '2026-06-10', lastService: '2026-05-10', downtime: '0h' },
  { id: 'MC-006', name: 'Cold Room Compressor 2', status: 'MAINTENANCE', nextService: 'Today', lastService: '2026-05-10', downtime: '2h' },
] as const;

const recentWork = [
  { id: 'MR-014', machine: 'Chocolate Coating Unit', type: 'BREAKDOWN', tech: 'M. Dube', date: 'Today', cost: '$280', status: 'IN_PROGRESS' },
  { id: 'MR-013', machine: 'Cone Moulding Machine', type: 'PREVENTIVE', tech: 'P. Chikwanda', date: 'June 4', cost: '$120', status: 'COMPLETED' },
  { id: 'MR-012', machine: 'Cold Room Compressor 2', type: 'INSPECTION', tech: 'M. Dube', date: 'June 3', cost: '$0', status: 'COMPLETED' },
  { id: 'MR-011', machine: 'Packaging Line', type: 'CORRECTIVE', tech: 'P. Chikwanda', date: 'May 30', cost: '$440', status: 'COMPLETED' },
] as const;

const statusMachine: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  OPERATIONAL: { color: 'text-emerald-500', icon: CheckCircle2 },
  MAINTENANCE: { color: 'text-amber-500', icon: Clock },
  BREAKDOWN: { color: 'text-red-500', icon: XCircle },
};

const typeColors: Record<string, string> = {
  PREVENTIVE: 'bg-orange-400/15 text-orange-600 dark:text-orange-300',
  CORRECTIVE: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  BREAKDOWN: 'bg-red-500/15 text-red-600 dark:text-red-300',
  INSPECTION: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
};

export default function MaintenancePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Maintenance Management"
        description="Machine registry, scheduled maintenance, breakdown records, repair costs, and downtime tracking."
        status="partial"
        actions={
          <Link
            href="/maintenance/machines"
            className="inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-deepOrange"
          >
            <Wrench className="h-4 w-4" />
            Manage Machines
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {maintenanceStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-2xl border p-5 ${stat.color}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-current/70">{stat.label}</p>
                  <p className="mt-1.5 font-display text-2xl font-bold text-current">{stat.value}</p>
                  <p className="mt-1 text-xs text-current/70">{stat.sub}</p>
                </div>
                <div className="rounded-xl border border-current/20 bg-current/10 p-2">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dash-card p-5">
        <h3 className="mb-4 font-display font-semibold text-brown dark:text-darkText">Machine Status</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((machine) => {
            const cfg = statusMachine[machine.status] ?? statusMachine.OPERATIONAL;
            const StatusIcon = cfg.icon;
            return (
              <div key={machine.id} className="dash-card-muted p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 flex-shrink-0 ${cfg.color}`} />
                    <p className="text-xs font-semibold text-brown/50 dark:text-darkMuted">{machine.id}</p>
                  </div>
                  <span
                    className={`ice-badge text-[10px] ${
                      machine.status === 'OPERATIONAL'
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : machine.status === 'BREAKDOWN'
                          ? 'bg-red-500/15 text-red-500'
                          : 'bg-amber-500/15 text-amber-500'
                    }`}
                  >
                    {machine.status}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-snug text-brown dark:text-darkText">{machine.name}</p>
                <div className="mt-2 flex gap-4 text-xs text-brown/40 dark:text-darkMuted">
                  <span>Next: {machine.nextService}</span>
                  {machine.downtime !== '0h' ? <span className="text-amber-500">Down: {machine.downtime}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
        <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
        <div>
          <p className="font-semibold text-red-700 dark:text-red-300">Active Breakdown: Chocolate Coating Unit (MC-003)</p>
          <p className="mt-1 text-sm text-red-700/70 dark:text-red-300/80">
            Machine reported down at 06:30 today. Technician M. Dube assigned. Estimated repair time: 3 hours. Production line is using a backup manual coating process while downtime impact is tracked.
          </p>
        </div>
      </div>

      <div className="dash-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-darkBorder">
          <h3 className="font-display font-semibold text-brown dark:text-darkText">Recent Maintenance Records</h3>
        </div>
        <div className="divide-y divide-border dark:divide-darkBorder">
          {recentWork.map((record) => (
            <div key={record.id} className="flex items-center justify-between px-5 py-4 transition hover:bg-cream/70 dark:hover:bg-white/5">
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-400/10 text-orange-500 dark:text-orange-300">
                  <Wrench className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-brown dark:text-darkText">{`${record.id} · ${record.machine}`}</p>
                  <p className="text-xs text-brown/40 dark:text-darkMuted">{`${record.tech} · ${record.date}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`ice-badge text-[10px] ${typeColors[record.type] ?? ''}`}>{record.type}</span>
                <span
                  className={`ice-badge text-[10px] ${
                    record.status === 'COMPLETED'
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-amber-500/15 text-amber-500'
                  }`}
                >
                  {record.status === 'COMPLETED' ? 'Done' : 'In Progress'}
                </span>
                <p className="hidden text-sm font-semibold text-brown dark:text-darkText sm:block">{record.cost}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
