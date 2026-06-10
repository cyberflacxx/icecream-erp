/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import Link from 'next/link';
import { ArrowLeft, Eye, Plus, UserCheck } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';

const employees = [
  { id: 'EMP-001', name: 'Tendai Moyo', dept: 'Production', role: 'Floor Supervisor', shift: 'Morning', status: 'ACTIVE', hired: '12 Jan 2023' },
  { id: 'EMP-002', name: 'Grace Mutasa', dept: 'Quality Control', role: 'QC Technician', shift: 'Morning', status: 'ACTIVE', hired: '05 Mar 2023' },
  { id: 'EMP-003', name: 'Brian Ndlovu', dept: 'Procurement', role: 'Stores Clerk', shift: 'Morning', status: 'ACTIVE', hired: '19 Jun 2022' },
  { id: 'EMP-004', name: 'Rudo Chikwanda', dept: 'Finance', role: 'Accounts Assistant', shift: 'Morning', status: 'ACTIVE', hired: '01 Aug 2021' },
  { id: 'EMP-005', name: 'Kudakwashe Banda', dept: 'Production', role: 'Machine Operator', shift: 'Night', status: 'ACTIVE', hired: '14 Nov 2023' },
  { id: 'EMP-006', name: 'Simba Chirinda', dept: 'Sales', role: 'Sales Rep', shift: 'Morning', status: 'ON_LEAVE', hired: '22 Feb 2022' },
  { id: 'EMP-007', name: 'Farai Mhuru', dept: 'Maintenance', role: 'Technician', shift: 'Rotating', status: 'ACTIVE', hired: '07 Jul 2024' },
  { id: 'EMP-008', name: 'Nomsa Dube', dept: 'HR', role: 'HR Officer', shift: 'Morning', status: 'ACTIVE', hired: '30 Apr 2021' },
];

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400',
  ON_LEAVE: 'bg-amber-500/15 text-amber-400',
  RESIGNED: 'bg-white/8 text-white/30',
  TERMINATED: 'bg-red-500/15 text-red-400',
};

const deptColors: Record<string, string> = {
  Production: 'text-violet-400',
  'Quality Control': 'text-lime-400',
  Procurement: 'text-blue-400',
  Finance: 'text-teal-400',
  Sales: 'text-yellow-400',
  Maintenance: 'text-cyan-400',
  HR: 'text-pink-400',
};

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Manage employee records, departments, roles and employment status."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/hr" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <button className="inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-deepOrange">
              <Plus className="h-4 w-4" />
              Add Employee
            </button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', value: '54', color: 'text-white' },
          { label: 'Active', value: '51', color: 'text-emerald-400' },
          { label: 'On Leave', value: '2', color: 'text-amber-400' },
          { label: 'New This Month', value: '1', color: 'text-orange' },
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
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">ID</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Name</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Department</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Role</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Shift</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Status</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium text-white/40">Hired</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-white/5 transition hover:bg-white/4 last:border-0">
                <td className="px-5 py-3.5 font-mono text-xs text-white/40">{emp.id}</td>
                <td className="px-5 py-3.5 font-medium text-white">{emp.name}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium ${deptColors[emp.dept] ?? 'text-white/60'}`}>{emp.dept}</span>
                </td>
                <td className="px-5 py-3.5 text-white/60">{emp.role}</td>
                <td className="px-5 py-3.5 text-white/40 text-xs">{emp.shift}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusColors[emp.status]}`}>{emp.status.replace('_', ' ')}</span>
                </td>
                <td className="px-5 py-3.5 text-white/40 text-xs">{emp.hired}</td>
                <td className="px-5 py-3.5 text-right">
                  <button aria-label="View employee" className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/8 hover:text-white">
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
