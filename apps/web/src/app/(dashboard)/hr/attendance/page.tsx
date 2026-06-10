'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';

const today = '07 Jun 2026 — Morning Shift';

const records = [
  { name: 'Tendai Moyo', dept: 'Production', shift: 'Morning', in: '06:02', out: '14:00', hours: '7h 58m', ot: '0h', status: 'PRESENT' },
  { name: 'Grace Mutasa', dept: 'QC', shift: 'Morning', in: '06:00', out: '14:00', hours: '8h 00m', ot: '0h', status: 'PRESENT' },
  { name: 'Brian Ndlovu', dept: 'Procurement', shift: 'Morning', in: '06:15', out: '14:00', hours: '7h 45m', ot: '0h', status: 'LATE' },
  { name: 'Rudo Chikwanda', dept: 'Finance', shift: 'Morning', in: '07:58', out: '—', hours: 'Active', ot: '—', status: 'PRESENT' },
  { name: 'Kudakwashe Banda', dept: 'Production', shift: 'Night', in: '22:00', out: '06:00', hours: '8h 00m', ot: '2h', status: 'PRESENT' },
  { name: 'Simba Chirinda', dept: 'Sales', shift: 'Morning', in: '—', out: '—', hours: '—', ot: '—', status: 'ON_LEAVE' },
  { name: 'Farai Mhuru', dept: 'Maintenance', shift: 'Rotating', in: '06:00', out: '—', hours: 'Active', ot: '—', status: 'PRESENT' },
  { name: 'Nomsa Dube', dept: 'HR', shift: 'Morning', in: '07:59', out: '—', hours: 'Active', ot: '—', status: 'PRESENT' },
];

const statusColors: Record<string, string> = {
  PRESENT: 'bg-emerald-500/15 text-emerald-400',
  LATE: 'bg-amber-500/15 text-amber-400',
  ABSENT: 'bg-red-500/15 text-red-400',
  ON_LEAVE: 'bg-blue-500/15 text-blue-400',
  HALF_DAY: 'bg-violet-500/15 text-violet-400',
};

const shiftSummary = [
  { label: 'Morning', present: 28, total: 32, color: 'bg-orange' },
  { label: 'Afternoon', present: 12, total: 14, color: 'bg-violet-500' },
  { label: 'Night', present: 8, total: 8, color: 'bg-blue-500' },
];

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description={`Live attendance tracking — ${today}`}
        actions={
          <div className="flex items-center gap-3">
            <Link href="/hr" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/10">
              <Calendar className="h-4 w-4" />
              View History
            </button>
          </div>
        }
      />

      {/* Shift summary */}
      <div className="grid grid-cols-3 gap-4">
        {shiftSummary.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">{s.label} Shift</p>
              <span className="text-xs text-white/40">{s.present}/{s.total}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className={`h-full rounded-full ${s.color}`} style={{ width: `${(s.present / s.total) * 100}%` }} />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{s.present} <span className="text-sm font-normal text-white/40">present</span></p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/3">
        <div className="border-b border-white/8 px-5 py-3.5 flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange" />
          <span className="text-sm font-medium text-white">Today&apos;s Records</span>
          <span className="ml-auto rounded-full bg-orange/15 px-2 py-0.5 text-xs text-orange">Live</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Employee</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Shift</th>
              <th className="px-5 py-3.5 text-center text-xs font-medium text-white/40">Clock In</th>
              <th className="px-5 py-3.5 text-center text-xs font-medium text-white/40">Clock Out</th>
              <th className="px-5 py-3.5 text-center text-xs font-medium text-white/40">Hours</th>
              <th className="px-5 py-3.5 text-center text-xs font-medium text-white/40">OT</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.name} className="border-b border-white/5 transition hover:bg-white/4 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-white">{r.name}</p>
                  <p className="text-[11px] text-white/30">{r.dept}</p>
                </td>
                <td className="px-5 py-3.5 text-white/50 text-xs">{r.shift}</td>
                <td className="px-5 py-3.5 text-center font-mono text-xs text-white/70">{r.in}</td>
                <td className="px-5 py-3.5 text-center font-mono text-xs text-white/50">{r.out}</td>
                <td className="px-5 py-3.5 text-center text-xs text-white/60">{r.hours}</td>
                <td className="px-5 py-3.5 text-center text-xs text-emerald-400">{r.ot}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusColors[r.status]}`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
