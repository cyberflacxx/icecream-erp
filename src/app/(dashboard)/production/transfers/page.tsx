'use client';

import { AlertCircle, RefreshCcw } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { useBatchAction } from '@/hooks/production/useBatchAction';
import { useBatches } from '@/hooks/production/useBatches';
import { useProductionMeta } from '@/hooks/production/useProductionMeta';
import { useProductionReport } from '@/hooks/production/useProductionReport';
import { API_ROUTES } from '@/lib/shared';

export default function ProductionTransfersPage() {
  const readyQuery = useBatches({ status: 'COMPLETED' });
  const transferQuery = useProductionReport(API_ROUTES.PRODUCTION.TRANSFERS);
  const metaQuery = useProductionMeta();
  const actions = useBatchAction();
  const [selectedBatch, setSelectedBatch] = useState<Record<string, unknown> | null>(null);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);

  const readyBatches =
    readyQuery.data && typeof readyQuery.data === 'object' && Array.isArray((readyQuery.data as { data?: unknown }).data)
      ? (readyQuery.data as { data: Array<Record<string, unknown>> }).data
      : [];
  const transfers = Array.isArray(transferQuery.data) ? transferQuery.data as Array<Record<string, unknown>> : [];

  async function handleTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBatch || !destinationWarehouseId) {
      setFormError('Batch and destination warehouse are required.');
      return;
    }

    try {
      await actions.transferFinishedGoods.mutateAsync({
        destinationWarehouseId,
        id: String(selectedBatch.id),
        transferDate,
      });
      setSelectedBatch(null);
      setDestinationWarehouseId('');
      setFormError(null);
      await transferQuery.refetch();
      await readyQuery.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to transfer finished goods.');
    }
  }

  if (readyQuery.isLoading || transferQuery.isLoading || metaQuery.isLoading) return <LoadingState />;
  if (readyQuery.isError || transferQuery.isError) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Transfers unavailable" description={readyQuery.error?.message ?? transferQuery.error?.message ?? 'No transfer data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Finished Goods Transfers" description="Move completed production output from the production warehouse into stores or branch warehouses." />
      <ProductionNav />

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-brown dark:text-darkText">Ready To Transfer</h2>
        <DataTable
          columns={[
            { key: 'batchNumber', header: 'Batch #' },
            { key: 'productionDate', header: 'Date' },
            { key: 'shift', header: 'Shift' },
            { key: 'actualOutput', header: 'Finished Output' },
            {
              key: 'actions',
              header: 'Actions',
              render: (row) => (
                <Button type="button" size="sm" onClick={() => setSelectedBatch(row as Record<string, unknown>)}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Transfer
                </Button>
              ),
            },
          ]}
          data={readyBatches}
          emptyState={<EmptyState icon={<RefreshCcw className="h-6 w-6" />} title="No completed batches waiting" description="Completed batches will appear here before transfer to stores." />}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-brown dark:text-darkText">Transfer History</h2>
        <DataTable
          columns={[
            {
              key: 'batch',
              header: 'Batch',
              render: (row) => String(((row as Record<string, unknown>).batch as Record<string, unknown> | null)?.batch_number ?? (row as Record<string, unknown>).production_batch_id ?? ''),
            },
            {
              key: 'sourceWarehouse',
              header: 'From',
              render: (row) => String(((row as Record<string, unknown>).sourceWarehouse as Record<string, unknown> | null)?.name ?? ''),
            },
            {
              key: 'destinationWarehouse',
              header: 'To',
              render: (row) => String(((row as Record<string, unknown>).destinationWarehouse as Record<string, unknown> | null)?.name ?? ''),
            },
            { key: 'quantity_transferred', header: 'Quantity' },
            { key: 'transfer_date', header: 'Date' },
          ]}
          data={transfers}
          emptyState={<EmptyState icon={<RefreshCcw className="h-6 w-6" />} title="No transfers yet" description="Transfer history appears after completed output is moved to stores." />}
        />
      </section>

      <FormDrawer title="Transfer Finished Goods" open={Boolean(selectedBatch)} onClose={() => setSelectedBatch(null)}>
        <form className="space-y-5" onSubmit={handleTransfer}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}
          <div className="rounded-2xl border border-border bg-cream/60 p-4 text-sm dark:border-darkBorder dark:bg-darkBg/40">
            <p className="font-medium text-brown dark:text-darkText">{String(selectedBatch?.batchNumber ?? '')}</p>
            <p className="text-muted">Finished output: {String(selectedBatch?.actualOutput ?? 0)}</p>
          </div>
          <label className="space-y-2 text-sm text-muted">
            <span>Destination Warehouse</span>
            <select className="surface-input-soft" value={destinationWarehouseId} onChange={(event) => setDestinationWarehouseId(event.target.value)}>
              <option value="">Select warehouse</option>
              {(metaQuery.data?.warehouses ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{String(warehouse.name)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-muted">
            <span>Transfer Date</span>
            <input className="surface-input-soft" type="date" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} />
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setSelectedBatch(null)}>Cancel</Button>
            <Button type="submit">Transfer To Stores</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
