'use client';

import { type FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Repeat2 } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer } from '@/components/ui-library';

interface OptionRow {
  id: string;
  branch_id?: string | null;
  department?: string | null;
  name?: string;
  employee_number?: string;
  first_name?: string;
  last_name?: string;
  warehouse_id?: string | null;
}

interface TransferRow {
  id: string;
  employee?: OptionRow | null;
  employee_id?: string;
  effective_date?: string;
  from_branch_id?: string | null;
  from_department?: string | null;
  from_warehouse_id?: string | null;
  status?: string;
  to_branch_id?: string | null;
  to_department?: string | null;
  to_warehouse_id?: string | null;
}

const initialForm = {
  effectiveDate: new Date().toISOString().slice(0, 10),
  employeeId: '',
  notes: '',
  reason: '',
  toBranchId: '',
  toDepartment: '',
  toWarehouseId: '',
};

export default function EmployeeTransfersPage() {
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [employees, setEmployees] = useState<OptionRow[]>([]);
  const [branches, setBranches] = useState<OptionRow[]>([]);
  const [warehouses, setWarehouses] = useState<OptionRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void Promise.all([
      fetch('/api/hr/employee-transfers', { cache: 'no-store' }).then((response) => response.json()),
      fetch('/api/hr/employees?pageSize=100&status=ACTIVE', { cache: 'no-store' }).then((response) => response.json()),
      fetch('/api/branches', { cache: 'no-store' }).then((response) => response.json()),
      fetch('/api/inventory/warehouses?pageSize=100', { cache: 'no-store' }).then((response) => response.json()),
    ]).then(([transferPayload, employeePayload, branchPayload, warehousePayload]) => {
      setRows(Array.isArray(transferPayload) ? transferPayload : transferPayload.data ?? []);
      setEmployees(Array.isArray(employeePayload) ? employeePayload : employeePayload.data ?? []);
      setBranches(Array.isArray(branchPayload) ? branchPayload : branchPayload.data ?? []);
      setWarehouses(Array.isArray(warehousePayload) ? warehousePayload : warehousePayload.data ?? []);
    }).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load transfer data.');
    });
  }, [reloadKey]);

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/hr/employee-transfers', {
        body: JSON.stringify(form),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());
      setForm(initialForm);
      setDrawerOpen(false);
      setReloadKey((current) => current + 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create transfer.');
    } finally {
      setSaving(false);
    }
  }

  async function runTransferAction(transferId: string, action: 'approve' | 'complete') {
    setActingId(`${transferId}:${action}`);
    setError(null);
    try {
      const response = await fetch(`/api/hr/employee-transfers/${transferId}/${action}`, { method: 'POST' });
      if (!response.ok) throw new Error(await response.text());
      setReloadKey((current) => current + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Failed to ${action} transfer.`);
    } finally {
      setActingId(null);
    }
  }

  const selectedEmployee = employees.find((employee) => employee.id === form.employeeId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Transfers"
        description="Move an existing employee between branch, warehouse, or department assignments without creating a duplicate employee."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/hr"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
            </Button>
            <Button type="button" size="sm" onClick={() => setDrawerOpen(true)}>
              <Repeat2 className="mr-2 h-4 w-4" />New Transfer
            </Button>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{error}</div> : null}

      <DataTable
        data={rows}
        columns={[
          {
            key: 'employee_id',
            header: 'Employee',
            render: (row) => {
              const employee = row.employee;
              const label = employee
                ? [employee.employee_number, employee.first_name, employee.last_name].filter(Boolean).join(' - ')
                : row.employee_id;
              return label || '-';
            },
          },
          { key: 'from_branch_id', header: 'From Branch' },
          { key: 'to_branch_id', header: 'To Branch' },
          { key: 'from_department', header: 'From Department' },
          { key: 'to_department', header: 'To Department' },
          { key: 'effective_date', header: 'Effective Date' },
          { key: 'status', header: 'Status' },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const status = String(row.status ?? '').toUpperCase();
              return (
                <div className="flex flex-wrap gap-2">
                  {status === 'PENDING' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={actingId === `${row.id}:approve`}
                      onClick={() => runTransferAction(row.id, 'approve')}
                    >
                      {actingId === `${row.id}:approve` ? 'Approving...' : 'Approve'}
                    </Button>
                  ) : null}
                  {['PENDING', 'APPROVED'].includes(status) ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={actingId === `${row.id}:complete`}
                      onClick={() => runTransferAction(row.id, 'complete')}
                    >
                      {actingId === `${row.id}:complete` ? 'Completing...' : 'Complete'}
                    </Button>
                  ) : null}
                </div>
              );
            },
          },
        ]}
        emptyState={<EmptyState icon={<Repeat2 className="h-6 w-6" />} title="No employee transfers found" description="Create a transfer when an employee changes assignment." />}
      />

      <FormDrawer title="New Employee Transfer" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={submitTransfer}>
          <label className="space-y-2 text-sm text-muted">
            <span>Employee</span>
            <select required className="surface-input-soft" value={form.employeeId} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}>
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {[employee.employee_number, employee.first_name, employee.last_name].filter(Boolean).join(' - ')}
                </option>
              ))}
            </select>
          </label>
          {selectedEmployee ? (
            <div className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] px-3 py-2 text-xs text-muted">
              Current assignment: branch {selectedEmployee.branch_id ?? 'none'}, warehouse {selectedEmployee.warehouse_id ?? 'none'}, department {selectedEmployee.department ?? 'none'}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Destination Branch</span>
              <select className="surface-input-soft" value={form.toBranchId} onChange={(event) => setForm((current) => ({ ...current, toBranchId: event.target.value }))}>
                <option value="">No branch change</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name ?? branch.id}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Destination Warehouse</span>
              <select className="surface-input-soft" value={form.toWarehouseId} onChange={(event) => setForm((current) => ({ ...current, toWarehouseId: event.target.value }))}>
                <option value="">No warehouse change</option>
                {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name ?? warehouse.id}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Destination Department</span>
              <input className="surface-input-soft" value={form.toDepartment} onChange={(event) => setForm((current) => ({ ...current, toDepartment: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Effective Date</span>
              <input required type="date" className="surface-input-soft" value={form.effectiveDate} onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))} />
            </label>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Reason</span>
            <input className="surface-input-soft" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
          </label>
          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea className="surface-textarea-soft" rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Submit Transfer'}</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
