'use client';

import { type FormEvent, useState } from 'react';
import { AlertCircle, Pencil, Power } from 'lucide-react';

import { PageHeader } from '@/components/dashboard/page-header';
import { FinanceNav } from '@/components/finance/finance-nav';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { useFinanceMutation, useFixedAssets } from '@/hooks/finance/useFinanceResources';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function FinanceFixedAssetsPage() {
  const query = useFixedAssets();
  const updateAsset = useFinanceMutation<Record<string, unknown>, { id: string; [key: string]: unknown }>(
    (variables) => `/api/finance/fixed-assets/${variables.id}`,
    { invalidateKey: 'fixed-assets', method: 'PATCH' },
  );
  const [editingAsset, setEditingAsset] = useState<Record<string, unknown> | null>(null);
  const [statusTarget, setStatusTarget] = useState<Record<string, unknown> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState({
    currentValue: '0',
    name: '',
    residualValue: '0',
    status: 'ACTIVE',
  });

  function openEditDrawer(asset: Record<string, unknown>) {
    setEditingAsset(asset);
    setAssetForm({
      currentValue: String(asset.current_value ?? asset.net_book_value ?? 0),
      name: String(asset.name ?? asset.asset_name ?? ''),
      residualValue: String(asset.residual_value ?? 0),
      status: String(asset.status ?? 'ACTIVE').toUpperCase(),
    });
    setFormError(null);
  }

  async function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAsset?.id) return;
    setFormError(null);
    try {
      await updateAsset.mutateAsync({
        id: String(editingAsset.id),
        currentValue: Number(assetForm.currentValue || 0),
        name: assetForm.name.trim(),
        residualValue: Number(assetForm.residualValue || 0),
        status: assetForm.status,
      });
      setEditingAsset(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save fixed asset.');
    }
  }

  async function toggleAssetStatus() {
    if (!statusTarget?.id) return;
    setFormError(null);
    try {
      const currentStatus = String(statusTarget.status ?? 'ACTIVE').toUpperCase();
      await updateAsset.mutateAsync({
        id: String(statusTarget.id),
        status: currentStatus === 'RETIRED' ? 'ACTIVE' : 'RETIRED',
      });
      setStatusTarget(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update fixed asset status.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Fixed assets unavailable" description={query.error?.message ?? 'No fixed asset data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Fixed Assets" description="Track assets, useful lives, accumulated depreciation, and carrying values." status="partial" />
      <FinanceNav />
      <DataTable
        columns={[
          { key: 'asset_code', header: 'Asset #' },
          { key: 'name', header: 'Name' },
          { key: 'category', header: 'Category' },
          { key: 'purchase_date', header: 'Purchase Date' },
          { key: 'purchase_cost', header: 'Cost', render: (row) => currency.format(Number(row.purchase_cost ?? 0)) },
          { key: 'accumulated_dep', header: 'Accumulated Dep.', render: (row) => currency.format(Number(row.accumulated_dep ?? 0)) },
          { key: 'current_value', header: 'Current Value', render: (row) => currency.format(Number(row.current_value ?? 0)) },
          { key: 'status', header: 'Status', render: (row) => String(row.status ?? 'ACTIVE') },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => openEditDrawer(row)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={String(row.status ?? 'ACTIVE').toUpperCase() === 'RETIRED' ? 'outline' : 'destructive'}
                  onClick={() => {
                    setFormError(null);
                    setStatusTarget(row);
                  }}
                >
                  <Power className="mr-2 h-4 w-4" />
                  {String(row.status ?? 'ACTIVE').toUpperCase() === 'RETIRED' ? 'Activate' : 'Retire'}
                </Button>
              </div>
            ),
          },
        ]}
        data={query.data}
      />

      <FormDrawer title="Edit Fixed Asset" open={Boolean(editingAsset)} onClose={() => { setEditingAsset(null); setFormError(null); }}>
        <form className="space-y-5" onSubmit={saveAsset}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}
          <label className="space-y-2 text-sm text-muted">
            <span>Asset Name</span>
            <input required value={assetForm.name} onChange={(event) => setAssetForm((current) => ({ ...current, name: event.target.value }))} className="surface-input-soft" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Current Value</span>
              <input min="0" step="0.01" type="number" value={assetForm.currentValue} onChange={(event) => setAssetForm((current) => ({ ...current, currentValue: event.target.value }))} className="surface-input-soft" />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Residual Value</span>
              <input min="0" step="0.01" type="number" value={assetForm.residualValue} onChange={(event) => setAssetForm((current) => ({ ...current, residualValue: event.target.value }))} className="surface-input-soft" />
            </label>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Status</span>
            <select value={assetForm.status} onChange={(event) => setAssetForm((current) => ({ ...current, status: event.target.value }))} className="surface-input-soft">
              <option value="ACTIVE">Active</option>
              <option value="RETIRED">Retired</option>
              <option value="DISPOSED">Disposed</option>
            </select>
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEditingAsset(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateAsset.isPending}>
              {updateAsset.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={String(statusTarget?.status ?? 'ACTIVE').toUpperCase() === 'RETIRED' ? 'Activate fixed asset' : 'Retire fixed asset'}
        description={
          String(statusTarget?.status ?? 'ACTIVE').toUpperCase() === 'RETIRED'
            ? 'This returns the asset to the active register.'
            : 'This keeps the asset history intact and marks it retired rather than deleting accounting history.'
        }
        confirmLabel={String(statusTarget?.status ?? 'ACTIVE').toUpperCase() === 'RETIRED' ? 'Activate' : 'Retire'}
        loading={updateAsset.isPending}
        errorMessage={formError}
        onCancel={() => {
          setStatusTarget(null);
          setFormError(null);
        }}
        onConfirm={() => void toggleAssetStatus()}
      />
    </div>
  );
}
