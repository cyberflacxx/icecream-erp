'use client';

import {
  AlertTriangle,
  BarChart3,
  DollarSign,
  Package,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const costStats = [
  { label: 'Cost Per Cone', value: '$0.47', change: '−3.2% vs budget', up: true, icon: Zap, color: 'text-orange border-orange/20 bg-orange/10' },
  { label: 'Batch Cost Today', value: '$1,840', change: '6 batches', up: null, icon: Package, color: 'text-violet-400 border-violet-400/20 bg-violet-400/10' },
  { label: 'Material Variance', value: '+$124', change: 'Over standard', up: false, icon: TrendingUp, color: 'text-red-400 border-red-400/20 bg-red-400/10' },
  { label: 'Labour Cost', value: '$340', change: 'Today · both shifts', up: null, icon: DollarSign, color: 'text-blue-400 border-blue-400/20 bg-blue-400/10' },
];

const batchCosts = [
  { batch: 'BATCH-041', product: 'Vanilla Cone', output: 480, costPerUnit: 0.44, total: 211, variance: -12, status: 'UNDER' },
  { batch: 'BATCH-040', product: 'Choc Cone', output: 320, costPerUnit: 0.52, total: 166, variance: +24, status: 'OVER' },
  { batch: 'BATCH-039', product: 'Vanilla Cone', output: 440, costPerUnit: 0.45, total: 198, variance: -8, status: 'UNDER' },
  { batch: 'BATCH-038', product: 'Mint Cone', output: 280, costPerUnit: 0.49, total: 137, variance: +6, status: 'OVER' },
  { batch: 'BATCH-037', product: 'Vanilla Cone', output: 500, costPerUnit: 0.43, total: 215, variance: -18, status: 'UNDER' },
];

const costBreakdown = [
  { category: 'Raw Materials', standard: 0.29, actual: 0.31, color: '#f97316' },
  { category: 'Packaging', standard: 0.085, actual: 0.082, color: '#fbbf24' },
  { category: 'Direct Labour', standard: 0.056, actual: 0.058, color: '#60a5fa' },
  { category: 'Overhead', standard: 0.038, actual: 0.038, color: '#a78bfa' },
];

const weeklyTrend = [
  { day: 'Mon', cost: 0.45, budget: 0.48 },
  { day: 'Tue', cost: 0.47, budget: 0.48 },
  { day: 'Wed', cost: 0.43, budget: 0.48 },
  { day: 'Thu', cost: 0.49, budget: 0.48 },
  { day: 'Fri', cost: 0.46, budget: 0.48 },
  { day: 'Sat', cost: 0.47, budget: 0.48 },
  { day: 'Sun', cost: 0.44, budget: 0.48 },
];

export default function CostAccountingPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Cost Accounting"
        description="Production cost analysis, cost-per-cone tracking, material variance, and overhead allocation per batch."
        status="partial"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {costStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-2xl border p-5 ${stat.color}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-white/50">{stat.label}</p>
                  <p className="mt-1.5 font-display text-2xl font-bold text-white">{stat.value}</p>
                  <p className={`mt-1 flex items-center gap-1 text-xs ${stat.up === true ? 'text-emerald-400' : stat.up === false ? 'text-red-400' : 'text-white/40'}`}>
                    {stat.up === true && <TrendingDown className="h-3 w-3" />}
                    {stat.up === false && <TrendingUp className="h-3 w-3" />}
                    {stat.change}
                  </p>
                </div>
                <div className="rounded-xl border border-current/20 bg-current/10 p-2">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cost per cone trend */}
        <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange" />
            <h3 className="font-display font-semibold text-white">Cost Per Cone — 7 Day Trend</h3>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#1a0700', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '12px', color: '#fff' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((v: number) => [`$${v}`, '']) as any}
                />
                <Bar dataKey="budget" fill="rgba(255,255,255,0.06)" radius={[4, 4, 0, 0]} name="Budget" />
                <Bar dataKey="cost" fill="#f97316" radius={[4, 4, 0, 0]} name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-orange" />Actual</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-white/10" />Budget ($0.48)</span>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
          <h3 className="mb-4 font-display font-semibold text-white">Cost Breakdown Per Cone</h3>
          <div className="space-y-4">
            {costBreakdown.map((item) => (
              <div key={item.category}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-white/70">{item.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-white/40">std: ${item.standard.toFixed(3)}</span>
                    <span className={`font-semibold ${item.actual > item.standard ? 'text-red-400' : 'text-emerald-400'}`}>
                      act: ${item.actual.toFixed(3)}
                    </span>
                  </div>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full opacity-30" style={{ width: `${(item.standard / 0.48) * 100}%`, backgroundColor: item.color }} />
                  <div className="absolute top-0 h-full rounded-full" style={{ width: `${(item.actual / 0.48) * 100}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4">
            <span className="text-sm text-white/50">Total per cone</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/40">std: $0.469</span>
              <span className="font-display font-bold text-orange">act: $0.470</span>
            </div>
          </div>
        </div>
      </div>

      {/* Batch cost table */}
      <div className="rounded-2xl border border-white/8 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="font-display font-semibold text-white">Batch Cost Analysis</h3>
          <span className="text-xs text-white/40">Last 5 batches</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs text-white/30">
                <th className="px-5 py-3 font-medium">Batch</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium text-right">Output</th>
                <th className="px-5 py-3 font-medium text-right">$/Unit</th>
                <th className="px-5 py-3 font-medium text-right">Total Cost</th>
                <th className="px-5 py-3 font-medium text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {batchCosts.map((row) => (
                <tr key={row.batch} className="transition hover:bg-white/5">
                  <td className="px-5 py-4 font-semibold text-white">{row.batch}</td>
                  <td className="px-5 py-4 text-white/60">{row.product}</td>
                  <td className="px-5 py-4 text-right text-white">{row.output.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right text-white">${row.costPerUnit.toFixed(2)}</td>
                  <td className="px-5 py-4 text-right text-white">${row.total}</td>
                  <td className="px-5 py-4 text-right">
                    <span className={`flex items-center justify-end gap-1 font-semibold ${row.variance < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {row.variance < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                      {row.variance > 0 ? '+' : ''}{row.variance}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Variance alert */}
      {batchCosts.some((b) => b.variance > 0) && (
        <div className="flex items-start gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-300">Material Variance Detected</p>
            <p className="mt-1 text-sm text-amber-400/70">
              2 batches exceeded standard material cost. Review raw material consumption records for BATCH-040 (Choc Cone) and BATCH-038 (Mint Cone). Consider investigating wastage or measurement issues.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
