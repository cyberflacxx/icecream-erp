'use client';

import Link from 'next/link';
import { type FormEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Plus, Wrench } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { useAppAuth } from '@/hooks/useAppAuth';
import { apiFetch } from '@/lib/api';

type MaintenanceMachineRow = {
  branchName: string;
  breakdownCount: number;
  code: string;
  healthStatus: string;
  id: string;
  isActive: boolean;
  lastServiceCost: number;
  lastServiceDate: string | null;
  location: string;
  machineType: string;
  manufacturer: string;
  model: string;
  name: string;
  nextServiceDate: string | null;
  notes: string;
  operationalStatus: string;
  purchaseCost: number;
  purchaseDate: string | null;
  serialNumber: string;
  serviceInterval: number;
  serviceProvider: string;
  totalMaintenanceCost: number;
};

type MachinesResponse = {
  data: MaintenanceMachineRow[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

type BranchOption = {
  code?: string | null;
  id: string;
  name: string;
};

const healthOptions = [
  { label: 'Healthy', value: 'HEALTHY' },
  { label: 'Needs Service', value: 'NEEDS_SERVICE' },
  { label: 'Under Maintenance', value: 'UNDER_MAINTENANCE' },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'Retired', value: 'RETIRED' },
] as const;

const operationalOptions = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Broken Down', value: 'BROKEN_DOWN' },
  { label: 'Under Repair', value: 'UNDER_REPAIR' },
] as const;

const initialForm = {
  branchName: '',
  code: '',
  healthStatus: 'HEALTHY',
  lastServiceCost: '0',
  lastServiceDate: '',
  location: '',
  machineType: 'GENERAL',
  manufacturer: '',
  model: '',
  name: '',
  nextServiceDate: '',
  notes: '',
  operationalStatus: 'ACTIVE',
  purchaseCost: '0',
  purchaseDate: '',
  serialNumber: '',
  serviceInterval: '30',
  serviceProvider: '',
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency',
});

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString();
}

function healthTone(value: string) {
  switch (value) {
    case 'HEALTHY':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'NEEDS_SERVICE':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'UNDER_MAINTENANCE':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'CRITICAL':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function statusTone(value: string) {
  switch (value) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'BROKEN_DOWN':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'UNDER_REPAIR':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export default function MachinesPage() {
  const { getToken, isLoaded, isSignedIn, userId } = useAppAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(initialForm);

  const machinesQuery = useQuery<MachinesResponse>({
    queryKey: ['maintenance', 'machines', userId],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<MachinesResponse>('/api/maintenance/machines?limit=100', { token });
    },
    enabled: isLoaded && Boolean(isSignedIn),
  });
  const branchesQuery = useQuery<{ data: BranchOption[] }>({
    queryKey: ['maintenance', 'machine-branches'],
    queryFn: async () => apiFetch<{ data: BranchOption[] }>('/api/branches/public'),
    enabled: drawerOpen,
  });

  const machines = machinesQuery.data?.data ?? [];
  const summary = useMemo(
    () => ({
      active: machines.filter((machine) => machine.operationalStatus === 'ACTIVE').length,
      critical: machines.filter((machine) => machine.healthStatus === 'CRITICAL').length,
      due: machines.filter((machine) => machine.healthStatus === 'NEEDS_SERVICE').length,
      totalCost: machines.reduce((sum, machine) => sum + Number(machine.totalMaintenanceCost ?? 0), 0),
    }),
    [machines],
  );

  async function handleCreateMachine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!form.code.trim() || !form.name.trim() || !form.machineType.trim()) {
      setFormError('Machine code, name, and type are required.');
      return;
    }

    setIsCreating(true);
    try {
      const token = await getToken();
      await apiFetch('/api/maintenance/machines', {
        body: JSON.stringify({
          branchName: form.branchName || null,
          code: form.code.trim().toUpperCase(),
          healthStatus: form.healthStatus,
          lastServiceCost: Number(form.lastServiceCost || 0),
          lastServiceDate: form.lastServiceDate || null,
          location: form.location.trim() || null,
          machineType: form.machineType.trim(),
          manufacturer: form.manufacturer.trim() || null,
          model: form.model.trim() || null,
          name: form.name.trim(),
          nextServiceDate: form.nextServiceDate || null,
          notes: form.notes.trim() || null,
          operationalStatus: form.operationalStatus,
          purchaseCost: Number(form.purchaseCost || 0),
          purchaseDate: form.purchaseDate || null,
          serialNumber: form.serialNumber.trim() || null,
          serviceInterval: Number(form.serviceInterval || 0),
          serviceProvider: form.serviceProvider.trim() || null,
        }),
        method: 'POST',
        token,
      });
      setDrawerOpen(false);
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: ['maintenance', 'machines'] });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create machine.');
    } finally {
      setIsCreating(false);
    }
  }

  if (!isLoaded || (isSignedIn && machinesQuery.isPending && !machinesQuery.data)) {
    return <LoadingState />;
  }

  if (!isSignedIn) {
    return (
      <EmptyState
        icon={<Wrench className="h-6 w-6" />}
        title="Sign in required"
        description="Sign in to manage machines and service schedules."
      />
    );
  }

  if (machinesQuery.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Machine register unavailable"
        description={machinesQuery.error?.message ?? 'Failed to load machine register.'}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Machine Register"
        description="Add machines, review service history, track health status, and keep maintenance cost visible."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/maintenance" className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-muted transition hover:bg-cream">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <Button type="button" onClick={() => { setFormError(null); setDrawerOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Machine
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Total Machines</p>
          <p className="mt-2 text-3xl font-semibold text-brown">{machines.length}</p>
        </div>
        <div className="surface-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Active</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{summary.active}</p>
        </div>
        <div className="surface-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Needs Attention</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{summary.due + summary.critical}</p>
        </div>
        <div className="surface-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Maintenance Cost</p>
          <p className="mt-2 text-3xl font-semibold text-brown">{currencyFormatter.format(summary.totalCost)}</p>
        </div>
      </div>

      {machines.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title="No machines recorded yet."
          description="Add your first machine to start tracking service dates, health, and maintenance cost."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {machines.map((machine) => (
            <article
              key={machine.id}
              className="rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,232,0.84))] p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{machine.code}</p>
                  <h2 className="mt-1 text-xl font-semibold text-brown">{machine.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {machine.machineType}
                    {machine.location ? ` · ${machine.location}` : ''}
                    {machine.branchName ? ` · ${machine.branchName}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${healthTone(machine.healthStatus)}`}>
                    {machine.healthStatus.replaceAll('_', ' ')}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(machine.operationalStatus)}`}>
                    {machine.operationalStatus.replaceAll('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-border bg-white/90 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Last Service</p>
                  <p className="mt-1 text-sm font-semibold text-brown">{formatDate(machine.lastServiceDate)}</p>
                  <p className="mt-1 text-xs text-muted">Cost: {currencyFormatter.format(machine.lastServiceCost)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-white/90 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Next Service</p>
                  <p className="mt-1 text-sm font-semibold text-brown">{formatDate(machine.nextServiceDate)}</p>
                  <p className="mt-1 text-xs text-muted">Interval: {machine.serviceInterval || 0} days</p>
                </div>
                <div className="rounded-2xl border border-border bg-white/90 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Total Maintenance Cost</p>
                  <p className="mt-1 text-sm font-semibold text-brown">{currencyFormatter.format(machine.totalMaintenanceCost)}</p>
                  <p className="mt-1 text-xs text-muted">Breakdowns: {machine.breakdownCount}</p>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.16em]">Serial Number</dt>
                  <dd className="mt-1 text-brown">{machine.serialNumber || 'Not set'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.16em]">Manufacturer / Model</dt>
                  <dd className="mt-1 text-brown">
                    {[machine.manufacturer, machine.model].filter(Boolean).join(' / ') || 'Not set'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.16em]">Purchase</dt>
                  <dd className="mt-1 text-brown">
                    {formatDate(machine.purchaseDate)} · {currencyFormatter.format(machine.purchaseCost)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.16em]">Service Provider</dt>
                  <dd className="mt-1 text-brown">{machine.serviceProvider || 'Not set'}</dd>
                </div>
              </dl>

              {machine.notes ? (
                <div className="mt-4 rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm text-muted">
                  {machine.notes}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <FormDrawer title="Add Machine" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleCreateMachine}>
          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Machine Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Machine Code / Asset Number</span>
              <input
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Branch</span>
              <select
                value={form.branchName}
                onChange={(event) => setForm((current) => ({ ...current, branchName: event.target.value }))}
                className="surface-input-soft"
              >
                <option value="">Select branch</option>
                {(branchesQuery.data?.data ?? []).map((branch) => (
                  <option key={branch.id} value={branch.name}>
                    {branch.code ? `${branch.code} - ${branch.name}` : branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Location</span>
              <input
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Category / Type</span>
              <input
                value={form.machineType}
                onChange={(event) => setForm((current) => ({ ...current, machineType: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Serial Number</span>
              <input
                value={form.serialNumber}
                onChange={(event) => setForm((current) => ({ ...current, serialNumber: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Manufacturer</span>
              <input
                value={form.manufacturer}
                onChange={(event) => setForm((current) => ({ ...current, manufacturer: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Model</span>
              <input
                value={form.model}
                onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Purchase Date</span>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(event) => setForm((current) => ({ ...current, purchaseDate: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Purchase Cost</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={form.purchaseCost}
                onChange={(event) => setForm((current) => ({ ...current, purchaseCost: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Health Status</span>
              <select
                value={form.healthStatus}
                onChange={(event) => setForm((current) => ({ ...current, healthStatus: event.target.value }))}
                className="surface-input-soft"
              >
                {healthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Operational Status</span>
              <select
                value={form.operationalStatus}
                onChange={(event) => setForm((current) => ({ ...current, operationalStatus: event.target.value }))}
                className="surface-input-soft"
              >
                {operationalOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Last Service Date</span>
              <input
                type="date"
                value={form.lastServiceDate}
                onChange={(event) => setForm((current) => ({ ...current, lastServiceDate: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Next Service Date</span>
              <input
                type="date"
                value={form.nextServiceDate}
                onChange={(event) => setForm((current) => ({ ...current, nextServiceDate: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Service Interval (days)</span>
              <input
                min="0"
                step="1"
                type="number"
                value={form.serviceInterval}
                onChange={(event) => setForm((current) => ({ ...current, serviceInterval: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Technician / Service Provider</span>
              <input
                value={form.serviceProvider}
                onChange={(event) => setForm((current) => ({ ...current, serviceProvider: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted sm:col-span-2">
              <span>Last Service Cost</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={form.lastServiceCost}
                onChange={(event) => setForm((current) => ({ ...current, lastServiceCost: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Notes</span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="surface-textarea-soft"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Saving...' : 'Save Machine'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
