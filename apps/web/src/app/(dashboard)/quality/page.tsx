'use client';

import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Package,
  ThumbsDown,
  ThumbsUp,
  XCircle
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';

const qcStats = [
  { label: 'Checks Today', value: '12', sub: '4 batches · 8 GRNs', icon: FlaskConical, color: 'text-lime-400 border-lime-400/20 bg-lime-400/10' },
  { label: 'Passed', value: '10', sub: '83% pass rate', icon: ThumbsUp, color: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' },
  { label: 'Failed / Rejected', value: '2', sub: 'Quarantined', icon: ThumbsDown, color: 'text-red-400 border-red-400/20 bg-red-400/10' },
  { label: 'Pending Review', value: '3', sub: 'Awaiting sign-off', icon: AlertTriangle, color: 'text-amber-400 border-amber-400/20 bg-amber-400/10' },
];

const recentChecks = [
  { ref: 'BATCH-0041', type: 'Production Batch', item: 'Vanilla Cone', result: 'PASSED', temp: '−18°C', checked: 'J. Mukasa', time: '08:30' },
  { ref: 'GRN-0089', type: 'Goods Received', item: 'Ice Cream Mix 25kg', result: 'PASSED', temp: '−20°C', checked: 'J. Mukasa', time: '07:15' },
  { ref: 'GRN-0088', type: 'Goods Received', item: 'Chocolate Type B', result: 'FAILED', temp: '−16°C', checked: 'S. Chikwanda', time: '06:45' },
  { ref: 'BATCH-0040', type: 'Production Batch', item: 'Chocolate Cone', result: 'CONDITIONAL', temp: '−18°C', checked: 'J. Mukasa', time: 'Yesterday' },
  { ref: 'GRN-0087', type: 'Goods Received', item: 'Milk Powder 50kg', result: 'PASSED', temp: 'ambient', checked: 'S. Chikwanda', time: 'Yesterday' },
];

const resultConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  PASSED: { label: 'Passed', color: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle2 },
  FAILED: { label: 'Failed', color: 'bg-red-500/15 text-red-400', icon: XCircle },
  CONDITIONAL: { label: 'Conditional', color: 'bg-amber-500/15 text-amber-400', icon: AlertTriangle },
  PENDING: { label: 'Pending', color: 'bg-white/10 text-white/50', icon: AlertTriangle },
};

const checkPoints = [
  { stage: 'Incoming Goods (GRN)', checks: ['Temperature', 'Microbial test', 'Visual appearance', 'Certificate of analysis'] },
  { stage: 'Raw Material Issue', checks: ['Stock batch check', 'Expiry validation', 'Quantity verification'] },
  { stage: 'Production Batch', checks: ['Temperature log', 'pH level', 'Taste/appearance', 'Weight check per unit'] },
  { stage: 'Finished Goods', checks: ['Packaging integrity', 'Label accuracy', 'Cold chain temperature', 'Random sampling'] },
];

export default function QualityControlPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Quality Control"
        description="Inspection records, test results, and quality assurance at every stage of production and procurement."
        status="partial"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {qcStats.map((stat) => {
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

      {/* QC Checkpoints */}
      <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
        <h3 className="mb-5 font-display font-semibold text-white">QC Checkpoints by Stage</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {checkPoints.map((cp, i) => (
            <div key={cp.stage} className="rounded-xl border border-white/8 bg-white/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-500/20 text-xs font-bold text-lime-400">
                  {i + 1}
                </span>
                <p className="font-semibold text-white text-sm">{cp.stage}</p>
              </div>
              <ul className="space-y-1.5">
                {cp.checks.map((check) => (
                  <li key={check} className="flex items-center gap-2 text-xs text-white/50">
                    <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-lime-400" />
                    {check}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Recent QC checks */}
      <div className="rounded-2xl border border-white/8 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="font-display font-semibold text-white">Recent Quality Checks</h3>
          <span className="ice-badge bg-lime-500/15 text-lime-400">Today</span>
        </div>
        <div className="divide-y divide-white/5">
          {recentChecks.map((check) => {
            const cfg = resultConfig[check.result] ?? resultConfig.PENDING!;
            const ResultIcon = cfg.icon;
            return (
              <div key={check.ref} className="flex items-center justify-between px-5 py-4 transition hover:bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-500/10 text-lime-400">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{check.ref}</p>
                    <p className="text-xs text-white/40">{check.type} · {check.item}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-white/50">Temp: {check.temp}</p>
                    <p className="text-xs text-white/30">{check.checked} · {check.time}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>
                    <ResultIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quarantine notice */}
      <div className="flex items-start gap-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
        <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
        <div>
          <p className="font-semibold text-red-300">1 Batch in Quarantine</p>
          <p className="mt-1 text-sm text-red-400/70">
            GRN-0088 (Chocolate Type B) failed microbial testing. Stock has been quarantined and marked for return to supplier. Approval required before disposal or retest.
          </p>
        </div>
      </div>
    </div>
  );
}
