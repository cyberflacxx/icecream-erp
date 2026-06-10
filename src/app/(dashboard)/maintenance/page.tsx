'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Settings,
  Wrench,
  XCircle
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';

const maintenanceStats = [
  { label: 'Active Machines', value: '12', sub: 'All operational', icon: Settings, color: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' },
  { label: 'Scheduled This Week', value: '3', sub: 'Preventive tasks', icon: Clock, color: 'text-blue-400 border-blue-400/20 bg-blue-400/10' },
  { label: 'Overdue', value: '1', sub: 'Requires attention', icon: AlertTriangle, color: 'text-amber-400 border-amber-400/20 bg-amber-400/10' },
  { label: 'Repair Cost MTD', value: '$840', sub: 'Parts + labour', icon: DollarSign, color: 'text-orange border-orange/20 bg-orange/10' },
];

const machines = [
  { id: 'MC-001', name: 'Ice Cream Freezer Line A', status: 'OPERATIONAL', nextService: '2026-06-15', lastService: '2026-05-15', downtime: '0h' },
  { id: 'MC-002', name: 'Cone Moulding Machine', status: 'OPERATIONAL', nextService: '2026-06-20', lastService: '2026-05-20', downtime: '0h' },
  { id: 'MC-003', name: 'Chocolate Coating Unit', status: 'BREAKDOWN', nextService: 'In repair', lastService: '2026-06-01', downtime: '4h' },
  { id: 'MC-004', name: 'Packaging Line', status: 'OPERATIONAL', nextService: '2026-07-01', lastService: '2026-06-01', downtime: '0h' },
  { id: 'MC-005', name: 'Cold Room Compressor 1', status: 'OPERATIONAL', nextService: '2026-06-10', lastService: '2026-05-10', downtime: '0h' },
  { id: 'MC-006', name: 'Cold Room Compressor 2', status: 'MAINTENANCE', nextService: 'Today', lastService: '2026-05-10', downtime: '2h' },
];

const recentWork = [
  { id: 'MR-014', machine: 'Chocolate Coating Unit', type: 'BREAKDOWN', tech: 'M. Dube', date: 'Today', cost: '$280', status: 'IN_PROGRESS' },
  { id: 'MR-013', machine: 'Cone Moulding Machine', type: 'PREVENTIVE', tech: 'P. Chikwanda', date: 'June 4', cost: '$120', status: 'COMPLETED' },
  { id: 'MR-012', machine: 'Cold Room Compressor 2', type: 'INSPECTION', tech: 'M. Dube', date: 'June 3', cost: '$0', status: 'COMPLETED' },
  { id: 'MR-011', machine: 'Packaging Line', type: 'CORRECTIVE', tech: 'P. Chikwanda', date: 'May 30', cost: '$440', status: 'COMPLETED' },
];

const statusMachine: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  OPERATIONAL: { color: 'text-emerald-400', icon: CheckCircle2 },
  MAINTENANCE: { color: 'text-amber-400', icon: Clock },
  BREAKDOWN: { color: 'text-red-400', icon: XCircle },
};

const typeColors: Record<string, string> = {
  PREVENTIVE: 'bg-blue-500/15 text-blue-400',
  CORRECTIVE: 'bg-amber-500/15 text-amber-400',
  BREAKDOWN: 'bg-red-500/15 text-red-400',
  INSPECTION: 'bg-emerald-500/15 text-emerald-400',
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
            href="/maintenance/machines/new"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
          >
            <Wrench className="h-4 w-4" />
            Log Maintenance
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {maintenanceStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-2xl border p-5 ${stat.color}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-white/50">{stat.label}</p>
                  <p className="mt-1.5 font-display text-2xl font-bold text-white">{stat.value}</p>
                  <p className="mt-1 text-xs text-white/40">{stat.sub}</p>
                </div>
                <div className="rounded-xl border border-current/20 bg-current/10 p-2">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Machine status grid */}
      <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
        <h3 className="mb-4 font-display font-semibold text-white">Machine Status</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((machine) => {
            const cfg = statusMachine[machine.status] ?? statusMachine.OPERATIONAL!;
            const StatusIcon = cfg.icon;
            return (
              <div key={machine.id} className="rounded-xl border border-white/8 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 flex-shrink-0 ${cfg.color}`} />
                    <p className="text-xs font-semibold text-white/50">{machine.id}</p>
                  </div>
                  <span className={`ice-badge text-[10px] ${machine.status === 'OPERATIONAL' ? 'bg-emerald-500/15 text-emerald-400' : machine.status === 'BREAKDOWN' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {machine.status}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-white leading-snug">{machine.name}</p>
                <div className="mt-2 flex gap-4 text-xs text-white/30">
                  <span>Next: {machine.nextService}</span>
                  {machine.downtime !== '0h' && <span className="text-amber-400">⬇ {machine.downtime}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Breakdown alert */}
      <div className="flex items-start gap-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
        <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
        <div>
          <p className="font-semibold text-red-300">Active Breakdown: Chocolate Coating Unit (MC-003)</p>
          <p className="mt-1 text-sm text-red-400/70">
            Machine reported down at 06:30 today. Technician M. Dube assigned. Estimated repair time: 3 hours. Production line using backup manual coating process. Downtime impact being tracked.
          </p>
        </div>
      </div>

      {/* Recent maintenance records */}
      <div className="rounded-2xl border border-white/8 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="font-display font-semibold text-white">Recent Maintenance Records</h3>
        </div>
        <div className="divide-y divide-white/5">
          {recentWork.map((record) => (
            <div key={record.id} className="flex items-center justify-between px-5 py-4 transition hover:bg-white/5">
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                  <Wrench className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-white">{record.id} · {record.machine}</p>
                  <p className="text-xs text-white/40">{record.tech} · {record.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`ice-badge text-[10px] ${typeColors[record.type] ?? ''}`}>{record.type}</span>
                <span className={`ice-badge text-[10px] ${record.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {record.status === 'COMPLETED' ? 'Done' : 'In Progress'}
                </span>
                <p className="hidden text-sm font-semibold text-white sm:block">{record.cost}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
