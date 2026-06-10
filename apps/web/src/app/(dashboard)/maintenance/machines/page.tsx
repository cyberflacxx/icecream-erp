/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, Plus, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';

const machines = [
  { id: 'MCH-001', name: 'Freezer Line A', type: 'Continuous Freezer', location: 'Production Floor 1', lastService: '01 Jun 2026', nextService: '01 Jul 2026', status: 'OPERATIONAL', health: 92 },
  { id: 'MCH-002', name: 'Freezer Line B', type: 'Continuous Freezer', location: 'Production Floor 1', lastService: '15 May 2026', nextService: '15 Jun 2026', status: 'MAINTENANCE_DUE', health: 68 },
  { id: 'MCH-003', name: 'Pasteuriser Unit', type: 'HTST Pasteuriser', location: 'Processing Room', lastService: '28 May 2026', nextService: '28 Jun 2026', status: 'OPERATIONAL', health: 88 },
  { id: 'MCH-004', name: 'Homogeniser #1', type: 'High-Pressure Homogeniser', location: 'Processing Room', lastService: '20 Apr 2026', nextService: '20 Jul 2026', status: 'OPERATIONAL', health: 95 },
  { id: 'MCH-005', name: 'Stick Bar Moulder', type: 'Ice Cream Moulder', location: 'Moulding Bay', lastService: '10 May 2026', nextService: '10 Jun 2026', status: 'BREAKDOWN', health: 12 },
  { id: 'MCH-006', name: 'Hardening Tunnel', type: 'IQF Tunnel Freezer', location: 'Hardening Area', lastService: '05 Jun 2026', nextService: '05 Jul 2026', status: 'OPERATIONAL', health: 90 },
  { id: 'MCH-007', name: 'Cone Roller', type: 'Wafer Cone Machine', location: 'Cone Line', lastService: '25 May 2026', nextService: '25 Jun 2026', status: 'OPERATIONAL', health: 85 },
  { id: 'MCH-008', name: 'Cold Store Compressor', type: 'Refrigeration Unit', location: 'Cold Store', lastService: '01 May 2026', nextService: '01 Aug 2026', status: 'OPERATIONAL', health: 97 },
];

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  OPERATIONAL: { label: 'Operational', color: 'bg-emerald-500/15 text-emerald-400', icon: '●' },
  MAINTENANCE_DUE: { label: 'Service Due', color: 'bg-amber-500/15 text-amber-400', icon: '●' },
  UNDER_MAINTENANCE: { label: 'In Service', color: 'bg-blue-500/15 text-blue-400', icon: '●' },
  BREAKDOWN: { label: 'Breakdown', color: 'bg-red-500/15 text-red-400', icon: '●' },
};

function HealthBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-white/50">{value}%</span>
    </div>
  );
}

export default function MachinesPage() {
  const breakdowns = machines.filter((m) => m.status === 'BREAKDOWN').length;
  const dueSoon = machines.filter((m) => m.status === 'MAINTENANCE_DUE').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Machine Register"
        description="Track all production equipment, health scores and service schedules."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/maintenance" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <button className="inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-deepOrange">
              <Plus className="h-4 w-4" />
              Add Machine
            </button>
          </div>
        }
      />

      {/* Alerts */}
      {(breakdowns > 0 || dueSoon > 0) && (
        <div className="space-y-3">
          {breakdowns > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/8 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{breakdowns} machine(s) in breakdown — production capacity is reduced. Log a repair job immediately.</p>
            </div>
          )}
          {dueSoon > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4">
              <Wrench className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
              <p className="text-sm text-amber-300">{dueSoon} machine(s) due for preventive maintenance. Schedule service before next production run.</p>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Machines', value: machines.length, color: 'text-white' },
          { label: 'Operational', value: machines.filter((m) => m.status === 'OPERATIONAL').length, color: 'text-emerald-400' },
          { label: 'Service Due', value: dueSoon, color: 'text-amber-400' },
          { label: 'Breakdown', value: breakdowns, color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/8 bg-white/3 p-4">
            <p className="text-xs text-white/40">{s.label}</p>
            <p className={`mt-1.5 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Machine</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Type</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Location</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Last Service</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Next Service</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Health</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Status</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => {
              const cfg = statusConfig[m.status] ?? { label: m.status, color: 'bg-white/8 text-white/40' };
              return (
                <tr key={m.id} className="border-b border-white/5 transition hover:bg-white/4 last:border-0">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-white">{m.name}</p>
                    <p className="text-[11px] font-mono text-white/30">{m.id}</p>
                  </td>
                  <td className="px-5 py-3.5 text-white/50 text-xs">{m.type}</td>
                  <td className="px-5 py-3.5 text-white/40 text-xs">{m.location}</td>
                  <td className="px-5 py-3.5 text-white/40 text-xs">{m.lastService}</td>
                  <td className={`px-5 py-3.5 text-xs font-medium ${m.status === 'MAINTENANCE_DUE' ? 'text-amber-400' : 'text-white/50'}`}>
                    {m.nextService}
                  </td>
                  <td className="px-5 py-3.5">
                    <HealthBar value={m.health} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button aria-label="View machine" className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/8 hover:text-white">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
