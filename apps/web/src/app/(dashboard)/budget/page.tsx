'use client';

import {
  BarChart3,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const budgetStats = [
  { label: 'Total Budget (Month)', value: '$48,200', sub: 'All departments', icon: DollarSign, color: 'text-blue-400 border-blue-400/20 bg-blue-400/10' },
  { label: 'Total Actual', value: '$41,380', sub: '86% utilised', icon: BarChart3, color: 'text-orange border-orange/20 bg-orange/10' },
  { label: 'Favourable Variance', value: '$6,820', sub: 'Under budget', icon: TrendingDown, color: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' },
  { label: 'Over Budget Depts', value: '1', sub: 'Maintenance', icon: TrendingUp, color: 'text-red-400 border-red-400/20 bg-red-400/10' },
];

const departments = [
  { name: 'Production', budget: 18000, actual: 16200, color: '#a78bfa' },
  { name: 'Procurement', budget: 12000, actual: 11400, color: '#60a5fa' },
  { name: 'Stores', budget: 3200, actual: 2940, color: '#34d399' },
  { name: 'Sales', budget: 6000, actual: 5800, color: '#fbbf24' },
  { name: 'Admin', budget: 4500, actual: 3800, color: '#f97316' },
  { name: 'Finance', budget: 2800, actual: 2400, color: '#22d3ee' },
  { name: 'Maintenance', budget: 1700, actual: 2040, color: '#f87171' },
];

export default function BudgetPage() {
  const chartData = departments.map((d) => ({
    name: d.name,
    budget: d.budget,
    actual: d.actual,
    variance: d.budget - d.actual,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Budgeting & Variance"
        description="Departmental budgets, actual spend tracking, and variance analysis for management reporting."
        status="partial"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {budgetStats.map((stat) => {
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

      {/* Chart */}
      <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
        <h3 className="mb-4 font-display font-semibold text-white">Budget vs Actual — By Department</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1a0700', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '12px', color: '#fff' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((v: number) => [`$${v.toLocaleString()}`, '']) as any}
              />
              <Bar dataKey="budget" fill="rgba(255,255,255,0.08)" radius={[4, 4, 0, 0]} name="Budget" />
              <Bar dataKey="actual" fill="#f97316" radius={[4, 4, 0, 0]} name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-orange" />Actual</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-white/10" />Budget</span>
        </div>
      </div>

      {/* Dept table */}
      <div className="rounded-2xl border border-white/8 bg-white/5">
        <div className="border-b border-white/8 px-5 py-4">
          <h3 className="font-display font-semibold text-white">Departmental Budget Summary — June 2026</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs text-white/30">
                <th className="px-5 py-3 font-medium">Department</th>
                <th className="px-5 py-3 font-medium text-right">Budget</th>
                <th className="px-5 py-3 font-medium text-right">Actual</th>
                <th className="px-5 py-3 font-medium text-right">Variance</th>
                <th className="px-5 py-3 font-medium text-right">Utilisation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {departments.map((dept) => {
                const variance = dept.budget - dept.actual;
                const utilisation = Math.round((dept.actual / dept.budget) * 100);
                const isOver = variance < 0;
                return (
                  <tr key={dept.name} className="transition hover:bg-white/5">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dept.color }} />
                        <span className="font-semibold text-white">{dept.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-white">${dept.budget.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right text-white">${dept.actual.toLocaleString()}</td>
                    <td className={`px-5 py-4 text-right font-semibold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>
                      <span className="flex items-center justify-end gap-1">
                        {isOver ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {isOver ? '-' : '+'} ${Math.abs(variance).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full ${isOver ? 'bg-red-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(utilisation, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs ${isOver ? 'text-red-400' : 'text-white/50'}`}>{utilisation}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-300">6 Departments Under Budget</p>
            <p className="mt-1 text-sm text-emerald-400/70">Production, Procurement, Stores, Sales, Admin, and Finance are all tracking below their monthly budget allocations.</p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
          <TrendingUp className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
          <div>
            <p className="font-semibold text-red-300">Maintenance Exceeds Budget by $340</p>
            <p className="mt-1 text-sm text-red-400/70">Unplanned repair cost for Chocolate Coating Unit breakdown contributed to the overspend. MD approval required for budget amendment.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
