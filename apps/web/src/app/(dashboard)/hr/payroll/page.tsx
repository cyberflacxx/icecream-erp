'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';

const payrollPeriod = 'May 2026';

const payrollRows = [
  { id: 'EMP-001', name: 'Tendai Moyo', dept: 'Production', basicSalary: '$650', overtime: '$85', allowances: '$50', deductions: '$65', netPay: '$720', status: 'PAID' },
  { id: 'EMP-002', name: 'Grace Mutasa', dept: 'Quality Control', basicSalary: '$580', overtime: '$0', allowances: '$50', deductions: '$58', netPay: '$572', status: 'PAID' },
  { id: 'EMP-003', name: 'Brian Ndlovu', dept: 'Procurement', basicSalary: '$520', overtime: '$30', allowances: '$50', deductions: '$55', netPay: '$545', status: 'PAID' },
  { id: 'EMP-004', name: 'Rudo Chikwanda', dept: 'Finance', basicSalary: '$700', overtime: '$0', allowances: '$75', deductions: '$70', netPay: '$705', status: 'PAID' },
  { id: 'EMP-005', name: 'Kudakwashe Banda', dept: 'Production', basicSalary: '$500', overtime: '$120', allowances: '$50', deductions: '$50', netPay: '$620', status: 'PENDING' },
  { id: 'EMP-006', name: 'Simba Chirinda', dept: 'Sales', basicSalary: '$600', overtime: '$0', allowances: '$100', deductions: '$60', netPay: '$640', status: 'ON_LEAVE' },
  { id: 'EMP-007', name: 'Farai Mhuru', dept: 'Maintenance', basicSalary: '$550', overtime: '$60', allowances: '$50', deductions: '$55', netPay: '$605', status: 'PENDING' },
  { id: 'EMP-008', name: 'Nomsa Dube', dept: 'HR', basicSalary: '$680', overtime: '$0', allowances: '$75', deductions: '$68', netPay: '$687', status: 'PAID' },
];

const statusColors: Record<string, string> = {
  PAID: 'bg-emerald-500/15 text-emerald-400',
  PENDING: 'bg-amber-500/15 text-amber-400',
  ON_LEAVE: 'bg-blue-500/15 text-blue-400',
  WITHHELD: 'bg-red-500/15 text-red-400',
};

export default function PayrollPage() {
  const totalNet = '$5,094';
  const totalPaid = 4;
  const totalPending = 2;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Payroll — ${payrollPeriod}`}
        description="Monthly payroll summary including overtime, allowances and statutory deductions."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/hr" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/10">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-deepOrange">
              <CheckCircle2 className="h-4 w-4" />
              Approve All
            </button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Net Pay', value: totalNet, color: 'text-orange', bg: 'bg-orange/8 border-orange/20' },
          { label: 'Processed', value: `${totalPaid} employees`, color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/20' },
          { label: 'Pending Approval', value: `${totalPending} employees`, color: 'text-amber-400', bg: 'bg-amber-500/8 border-amber-500/20' },
          { label: 'Total Deductions', value: '$481', color: 'text-red-400', bg: 'bg-red-500/8 border-red-500/20' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
            <p className="text-xs text-white/40">{s.label}</p>
            <p className={`mt-1.5 text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Employee</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Dept</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium text-white/40">Basic</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium text-white/40">OT</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium text-white/40">Allow.</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium text-white/40">Deduct.</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium text-white/40">Net Pay</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Status</th>
            </tr>
          </thead>
          <tbody>
            {payrollRows.map((row) => (
              <tr key={row.id} className="border-b border-white/5 transition hover:bg-white/4 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-white">{row.name}</p>
                  <p className="text-[11px] text-white/30">{row.id}</p>
                </td>
                <td className="px-5 py-3.5 text-white/50 text-xs">{row.dept}</td>
                <td className="px-5 py-3.5 text-right text-white/70">{row.basicSalary}</td>
                <td className="px-5 py-3.5 text-right text-emerald-400">{row.overtime}</td>
                <td className="px-5 py-3.5 text-right text-white/50">{row.allowances}</td>
                <td className="px-5 py-3.5 text-right text-red-400">{row.deductions}</td>
                <td className="px-5 py-3.5 text-right font-bold text-white">{row.netPay}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusColors[row.status]}`}>{row.status.replace('_', ' ')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
