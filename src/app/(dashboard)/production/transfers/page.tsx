'use client';

import { AlertCircle, ArrowDownToLine, ArrowUpRight, PackagePlus, Plus, RefreshCcw, TriangleAlert, Undo2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useBatchAction } from '@/hooks/production/useBatchAction';
import { useBatches } from '@/hooks/production/useBatches';
import { useProductionMeta } from '@/hooks/production/useProductionMeta';
import { useProductionReport } from '@/hooks/production/useProductionReport';
import { useProductionRequest } from '@/hooks/production/useProductionRequest';
import { API_ROUTES } from '@/lib/shared';

type TransferLine = {
  itemId: string;
  quantity: string;
  rowId: string;
};

const actionButtonClassNames = {
  receive: 'border border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-600 hover:bg-sky-600 hover:text-white',
  transfer: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white',
} as const;

function createTransferLine(): TransferLine {
  return {
    itemId: '',
    quantity: '1',
    rowId:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `raw-transfer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
}

export default function ProductionTransfersPage() {
  const readyQuery = useBatches({ status: 'COMPLETED' });
  const finishedTransferQuery = useProductionReport(API_ROUTES.PRODUCTION.TRANSFERS);
  const rawTransferQuery = useProductionReport(API_ROUTES.PRODUCTION.RAW_MATERIAL_TRANSFERS);
  const returnsQuery = useProductionReport(API_ROUTES.PRODUCTION.RETURNS_TO_STORES);
  const wastageQuery = useProductionReport('/api/production/wastage');
  const metaQuery = useProductionMeta();
  const request = useProductionRequest();
  const queryClient = useQueryClient();
  const actions = useBatchAction();
  const [selectedBatch, setSelectedBatch] = useState<Record<string, unknown> | null>(null);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [rawDrawerOpen, setRawDrawerOpen] = useState(false);
  const [returnDrawerOpen, setReturnDrawerOpen] = useState(false);
  const [damageDrawerOpen, setDamageDrawerOpen] = useState(false);
  const [rawSourceWarehouseId, setRawSourceWarehouseId] = useState('');
  const [rawDestinationWarehouseId, setRawDestinationWarehouseId] = useState('');
  const [rawTransferDate, setRawTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [rawNotes, setRawNotes] = useState('');
  const [rawLines, setRawLines] = useState<TransferLine[]>([createTransferLine()]);
  const [returnSourceWarehouseId, setReturnSourceWarehouseId] = useState('');
  const [returnDestinationWarehouseId, setReturnDestinationWarehouseId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnReason, setReturnReason] = useState('');
  const [returnBatchId, setReturnBatchId] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnLines, setReturnLines] = useState<TransferLine[]>([createTransferLine()]);
  const [damageBatchId, setDamageBatchId] = useState('');
  const [damageItemId, setDamageItemId] = useState('');
  const [damageQuantity, setDamageQuantity] = useState('1');
  const [damageReason, setDamageReason] = useState('');
  const [damageType, setDamageType] = useState('DAMAGED');
  const [feedback, setFeedback] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const readyBatches =
    readyQuery.data && typeof readyQuery.data === 'object' && Array.isArray((readyQuery.data as { data?: unknown }).data)
      ? (readyQuery.data as { data: Array<Record<string, unknown>> }).data
      : [];
  const finishedTransfers = Array.isArray(finishedTransferQuery.data) ? finishedTransferQuery.data as Array<Record<string, unknown>> : [];
  const rawTransfers = Array.isArray(rawTransferQuery.data) ? rawTransferQuery.data as Array<Record<string, unknown>> : [];
  const productionReturns = Array.isArray(returnsQuery.data) ? returnsQuery.data as Array<Record<string, unknown>> : [];
  const wastageRows = Array.isArray(wastageQuery.data) ? wastageQuery.data as Array<Record<string, unknown>> : [];
  const mainWarehouses = metaQuery.data?.mainWarehouses?.length ? metaQuery.data.mainWarehouses : metaQuery.data?.warehouses ?? [];
  const productionMaterialWarehouses =
    metaQuery.data?.productionMaterialWarehouses?.length ? metaQuery.data.productionMaterialWarehouses : metaQuery.data?.warehouses ?? [];
  const destinationWarehouses =
    metaQuery.data?.productionFinishedWarehouses?.length ? metaQuery.data.productionFinishedWarehouses : metaQuery.data?.warehouses ?? [];
  const materialItems = [...(metaQuery.data?.rawMaterials ?? []), ...(metaQuery.data?.packagingItems ?? [])];

  async function refresh() {
    await Promise.all([
      readyQuery.refetch(),
      finishedTransferQuery.refetch(),
      rawTransferQuery.refetch(),
      returnsQuery.refetch(),
      wastageQuery.refetch(),
      metaQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] }),
    ]);
  }

  async function handleTransferFinishedGoods(event: FormEvent<HTMLFormElement>) {
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
      setFeedback({ message: 'Finished goods transferred out of production.', tone: 'success' });
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to transfer finished goods.');
    }
  }

  async function handleReceiveRawMaterials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items = rawLines
      .filter((line) => line.itemId && Number(line.quantity) > 0)
      .map((line) => ({ itemId: line.itemId, quantity: Number(line.quantity) }));

    if (!rawSourceWarehouseId || !rawDestinationWarehouseId || items.length === 0) {
      setFormError('Source warehouse, production warehouse, and at least one raw material line are required.');
      return;
    }

    try {
      await request(API_ROUTES.PRODUCTION.RAW_MATERIAL_TRANSFERS, {
        body: JSON.stringify({
          destinationWarehouseId: rawDestinationWarehouseId,
          items,
          notes: rawNotes || null,
          sourceWarehouseId: rawSourceWarehouseId,
          transferDate: rawTransferDate,
        }),
        method: 'POST',
      });
      setRawDrawerOpen(false);
      setRawSourceWarehouseId('');
      setRawDestinationWarehouseId('');
      setRawNotes('');
      setRawLines([createTransferLine()]);
      setFormError(null);
      setFeedback({ message: 'Raw materials received into production inventory.', tone: 'success' });
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to receive raw materials into production.';
      console.error('Production raw material receive failed.', {
        destinationWarehouseId: rawDestinationWarehouseId,
        items,
        message,
        sourceWarehouseId: rawSourceWarehouseId,
        transferDate: rawTransferDate,
      });
      setFormError(message);
    }
  }

  async function handleReturnToStores(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items = returnLines
      .filter((line) => line.itemId && Number(line.quantity) > 0)
      .map((line) => ({ itemId: line.itemId, quantity: Number(line.quantity) }));

    if (!returnSourceWarehouseId || !returnDestinationWarehouseId || !returnReason.trim() || items.length === 0) {
      setFormError('Production warehouse, stores warehouse, reason, and at least one surplus line are required.');
      return;
    }

    try {
      await request(API_ROUTES.PRODUCTION.RETURNS_TO_STORES, {
        body: JSON.stringify({
          destinationWarehouseId: returnDestinationWarehouseId,
          items,
          notes: returnNotes || null,
          productionBatchId: returnBatchId || null,
          reason: returnReason,
          returnDate,
          sourceWarehouseId: returnSourceWarehouseId,
        }),
        method: 'POST',
      });
      setReturnDrawerOpen(false);
      setReturnSourceWarehouseId('');
      setReturnDestinationWarehouseId('');
      setReturnReason('');
      setReturnBatchId('');
      setReturnNotes('');
      setReturnLines([createTransferLine()]);
      setFormError(null);
      setFeedback({ message: 'Production surplus returned to stores.', tone: 'success' });
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to return surplus to stores.');
    }
  }

  async function handleDamageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!damageBatchId || !damageItemId || Number(damageQuantity) <= 0 || !damageReason.trim()) {
      setFormError('Production batch, item, quantity, and reason are required for damaged stock.');
      return;
    }

    try {
      await request('/api/production/wastage', {
        body: JSON.stringify({
          itemId: damageItemId,
          productionBatchId: damageBatchId,
          quantity: Number(damageQuantity),
          reason: damageReason,
          wastageType: damageType,
        }),
        method: 'POST',
      });
      setDamageDrawerOpen(false);
      setDamageBatchId('');
      setDamageItemId('');
      setDamageQuantity('1');
      setDamageReason('');
      setDamageType('DAMAGED');
      setFormError(null);
      setFeedback({ message: 'Damaged production stock recorded and deducted.', tone: 'success' });
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to record damaged stock.');
    }
  }

  function updateRawLine(rowId: string, next: Partial<TransferLine>) {
    setRawLines((current) => current.map((line) => (line.rowId === rowId ? { ...line, ...next } : line)));
  }

  function removeRawLine(rowId: string) {
    setRawLines((current) => current.length === 1 ? current : current.filter((line) => line.rowId !== rowId));
  }

  if (readyQuery.isLoading || finishedTransferQuery.isLoading || rawTransferQuery.isLoading || returnsQuery.isLoading || wastageQuery.isLoading || metaQuery.isLoading) return <LoadingState />;
  if (readyQuery.isError || finishedTransferQuery.isError || rawTransferQuery.isError || returnsQuery.isError || wastageQuery.isError) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" />}
        title="Transfers unavailable"
        description={readyQuery.error?.message ?? finishedTransferQuery.error?.message ?? rawTransferQuery.error?.message ?? returnsQuery.error?.message ?? wastageQuery.error?.message ?? 'No transfer data returned.'}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Inventory Transfers"
        description="Receive raw materials from HQ/main inventory into production, then transfer completed finished goods out when requested."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setDamageDrawerOpen(true)}>
              <TriangleAlert className="mr-2 h-4 w-4" />
              Log Damaged
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setReturnDrawerOpen(true)}>
              <Undo2 className="mr-2 h-4 w-4" />
              Return Surplus
            </Button>
            <Button type="button" size="sm" onClick={() => setRawDrawerOpen(true)}>
              <PackagePlus className="mr-2 h-4 w-4" />
              Receive Raw Materials
            </Button>
          </div>
        }
      />
      <ProductionNav />

      {feedback ? (
        <div
          className={`rounded-3xl border px-4 py-3 text-sm shadow-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card bg-gradient-to-br from-white via-white to-sky-50">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Raw Material Receipts</p>
          <p className="mt-3 text-3xl font-semibold text-brown">{rawTransfers.length}</p>
        </div>
        <div className="surface-card bg-gradient-to-br from-white via-white to-emerald-50">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Completed Runs</p>
          <p className="mt-3 text-3xl font-semibold text-brown">{readyBatches.length}</p>
        </div>
        <div className="surface-card bg-gradient-to-br from-white via-white to-emerald-50">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Surplus Returns</p>
          <p className="mt-3 text-3xl font-semibold text-brown">{productionReturns.length}</p>
        </div>
        <div className="surface-card bg-gradient-to-br from-white via-white to-orange-50">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Damaged Entries</p>
          <p className="mt-3 text-3xl font-semibold text-brown">{wastageRows.length}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-brown dark:text-darkText">Raw Materials Received Into Production</h2>
            <p className="text-sm text-muted">This is the continuity point from procurement: GRN stock lands in HQ/main inventory, then production receives it here.</p>
          </div>
        </div>
        <DataTable
          columns={[
            { key: 'transferNumber', header: 'Transfer #' },
            {
              key: 'sourceWarehouse',
              header: 'From',
              render: (row) => String(((row as Record<string, unknown>).sourceWarehouse as Record<string, unknown> | null)?.name ?? ''),
            },
            {
              key: 'destinationWarehouse',
              header: 'To Production',
              render: (row) => String(((row as Record<string, unknown>).destinationWarehouse as Record<string, unknown> | null)?.name ?? ''),
            },
            { key: 'quantityTransferred', header: 'Qty' },
            { key: 'transferDate', header: 'Date' },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <StatusBadge status={String((row as Record<string, unknown>).status ?? '')} />,
            },
          ]}
          data={rawTransfers}
          emptyState={<EmptyState icon={<ArrowDownToLine className="h-6 w-6" />} title="No raw material receipts" description="Receive materials from HQ/main inventory before issuing to production." />}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-brown dark:text-darkText">Ready To Transfer Finished Goods</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {readyBatches.length ? readyBatches.map((batch) => (
            <article key={String(batch.id)} className="surface-card border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,246,232,0.92))]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-lg font-semibold text-brown">{String(batch.batchNumber ?? '')}</p>
                    <StatusBadge status="Completed" variant="success" />
                  </div>
                  <p className="mt-2 text-sm text-muted">Finished output: {String(batch.actualOutput ?? 0)}</p>
                </div>
                <Button type="button" size="sm" variant="outline" className={actionButtonClassNames.transfer} onClick={() => setSelectedBatch(batch)}>
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Transfer Out
                </Button>
              </div>
            </article>
          )) : (
            <EmptyState icon={<RefreshCcw className="h-6 w-6" />} title="No completed batches waiting" description="Released production output appears here before transfer to stores or main warehouse." />
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-brown dark:text-darkText">Finished Goods Transfer History</h2>
        <DataTable
          columns={[
            {
              key: 'batch',
              header: 'Batch',
              render: (row) => String(((row as Record<string, unknown>).batch as Record<string, unknown> | null)?.batch_number ?? (row as Record<string, unknown>).production_batch_id ?? ''),
            },
            {
              key: 'sourceWarehouse',
              header: 'From Production',
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
          data={finishedTransfers}
          emptyState={<EmptyState icon={<RefreshCcw className="h-6 w-6" />} title="No finished goods transfers yet" description="Transfer history appears after completed output is moved out of production." />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-brown dark:text-darkText">Surplus Returned To Stores</h2>
          <DataTable
            columns={[
              { key: 'returnNumber', header: 'Return #' },
              {
                key: 'sourceWarehouse',
                header: 'From Production',
                render: (row) => String(((row as Record<string, unknown>).sourceWarehouse as Record<string, unknown> | null)?.name ?? ''),
              },
              {
                key: 'storeWarehouse',
                header: 'To Stores',
                render: (row) => String(((row as Record<string, unknown>).storeWarehouse as Record<string, unknown> | null)?.name ?? ''),
              },
              { key: 'quantityReturned', header: 'Quantity' },
              { key: 'returnDate', header: 'Date' },
            ]}
            data={productionReturns}
            emptyState={<EmptyState icon={<Undo2 className="h-6 w-6" />} title="No surplus returns yet" description="Returned production surplus will appear here with the stores destination." />}
          />
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-brown dark:text-darkText">Damaged Stock Logged</h2>
          <DataTable
            columns={[
              { key: 'created_at', header: 'Logged At' },
              { key: 'wastage_type', header: 'Type' },
              { key: 'quantity', header: 'Qty' },
              { key: 'reason', header: 'Reason' },
            ]}
            data={wastageRows}
            emptyState={<EmptyState icon={<TriangleAlert className="h-6 w-6" />} title="No damaged stock logged" description="Damaged or wasted production stock will appear here after posting." />}
          />
        </div>
      </section>

      <FormDrawer title="Receive Raw Materials Into Production" open={rawDrawerOpen} onClose={() => setRawDrawerOpen(false)}>
        <form className="space-y-6" onSubmit={handleReceiveRawMaterials}>
          {formError ? <ErrorBox message={formError} /> : null}
          <div className="rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,232,0.88))] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Transfer Source</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SelectField label="From HQ/Main Warehouse" value={rawSourceWarehouseId} onChange={setRawSourceWarehouseId}>
                <option value="">Select source</option>
                {mainWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{String(warehouse.name)}</option>)}
              </SelectField>
              <SelectField label="To Production Raw Materials" value={rawDestinationWarehouseId} onChange={setRawDestinationWarehouseId}>
                <option value="">Select production store</option>
                {productionMaterialWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{String(warehouse.name)}</option>)}
              </SelectField>
              <InputField label="Transfer Date" type="date" value={rawTransferDate} onChange={setRawTransferDate} />
              <InputField label="Notes" value={rawNotes} onChange={setRawNotes} />
            </div>
          </div>

          <section className="rounded-3xl border border-border/70 bg-white/75 p-4 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Raw Material Lines</p>
                <p className="mt-1 text-sm text-muted">Move only materials already available in HQ/main inventory.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setRawLines((current) => [...current, createTransferLine()])}>
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {rawLines.map((line) => (
                <div key={line.rowId} className="rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,232,0.82))] p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_110px]">
                    <select className="surface-input-soft" value={line.itemId} onChange={(event) => updateRawLine(line.rowId, { itemId: event.target.value })}>
                      <option value="">Select raw material</option>
                      {materialItems.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <input className="surface-input-soft" min="0.001" step="0.001" type="number" value={line.quantity} onChange={(event) => updateRawLine(line.rowId, { quantity: event.target.value })} />
                    <Button type="button" variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-600 hover:bg-rose-600 hover:text-white" onClick={() => removeRawLine(line.rowId)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setRawDrawerOpen(false)}>Cancel</Button>
            <Button type="submit" variant="outline" className={actionButtonClassNames.receive}>
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Receive Into Production
            </Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer title="Return Production Surplus To Stores" open={returnDrawerOpen} onClose={() => setReturnDrawerOpen(false)}>
        <form className="space-y-6" onSubmit={handleReturnToStores}>
          {formError ? <ErrorBox message={formError} /> : null}
          <div className="rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,232,0.88))] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Return Details</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SelectField label="From Production Warehouse" value={returnSourceWarehouseId} onChange={setReturnSourceWarehouseId}>
                <option value="">Select production warehouse</option>
                {productionMaterialWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{String(warehouse.name)}</option>)}
              </SelectField>
              <SelectField label="To Stores Warehouse" value={returnDestinationWarehouseId} onChange={setReturnDestinationWarehouseId}>
                <option value="">Select stores warehouse</option>
                {mainWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{String(warehouse.name)}</option>)}
              </SelectField>
              <InputField label="Return Date" type="date" value={returnDate} onChange={setReturnDate} />
              <SelectField label="Production Batch" value={returnBatchId} onChange={setReturnBatchId}>
                <option value="">Optional batch reference</option>
                {readyBatches.map((batch) => <option key={String(batch.id)} value={String(batch.id)}>{String(batch.batchNumber ?? '')}</option>)}
              </SelectField>
              <InputField label="Reason" value={returnReason} onChange={setReturnReason} />
              <InputField label="Notes" value={returnNotes} onChange={setReturnNotes} />
            </div>
          </div>

          <section className="rounded-3xl border border-border/70 bg-white/75 p-4 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Surplus Lines</p>
                <p className="mt-1 text-sm text-muted">Return only the stock still physically in production.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setReturnLines((current) => [...current, createTransferLine()])}>
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {returnLines.map((line) => (
                <div key={line.rowId} className="rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,232,0.82))] p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_110px]">
                    <select className="surface-input-soft" value={line.itemId} onChange={(event) => setReturnLines((current) => current.map((row) => row.rowId === line.rowId ? { ...row, itemId: event.target.value } : row))}>
                      <option value="">Select production item</option>
                      {[...materialItems, ...(metaQuery.data?.finishedGoods ?? [])].map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <input className="surface-input-soft" min="0.001" step="0.001" type="number" value={line.quantity} onChange={(event) => setReturnLines((current) => current.map((row) => row.rowId === line.rowId ? { ...row, quantity: event.target.value } : row))} />
                    <Button type="button" variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-600 hover:bg-rose-600 hover:text-white" onClick={() => setReturnLines((current) => current.length === 1 ? current : current.filter((row) => row.rowId !== line.rowId))}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setReturnDrawerOpen(false)}>Cancel</Button>
            <Button type="submit" variant="outline" className={actionButtonClassNames.transfer}>
              <Undo2 className="mr-2 h-4 w-4" />
              Return To Stores
            </Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer title="Log Damaged Production Stock" open={damageDrawerOpen} onClose={() => setDamageDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleDamageSubmit}>
          {formError ? <ErrorBox message={formError} /> : null}
          <SelectField label="Production Batch" value={damageBatchId} onChange={setDamageBatchId}>
            <option value="">Select batch</option>
            {readyBatches.map((batch) => <option key={String(batch.id)} value={String(batch.id)}>{String(batch.batchNumber ?? '')}</option>)}
          </SelectField>
          <SelectField label="Item" value={damageItemId} onChange={setDamageItemId}>
            <option value="">Select item</option>
            {[...materialItems, ...(metaQuery.data?.finishedGoods ?? [])].map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </SelectField>
          <InputField label="Quantity" type="number" value={damageQuantity} onChange={setDamageQuantity} />
          <SelectField label="Classification" value={damageType} onChange={setDamageType}>
            <option value="DAMAGED">Damaged</option>
            <option value="WASTAGE">Wastage</option>
          </SelectField>
          <InputField label="Reason" value={damageReason} onChange={setDamageReason} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDamageDrawerOpen(false)}>Cancel</Button>
            <Button type="submit">
              <TriangleAlert className="mr-2 h-4 w-4" />
              Log Damaged Stock
            </Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer title="Transfer Finished Goods Out" open={Boolean(selectedBatch)} onClose={() => setSelectedBatch(null)}>
        <form className="space-y-5" onSubmit={handleTransferFinishedGoods}>
          {formError ? <ErrorBox message={formError} /> : null}
          <div className="rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,232,0.88))] p-5 text-sm">
            <p className="font-medium text-brown dark:text-darkText">{String(selectedBatch?.batchNumber ?? '')}</p>
            <p className="text-muted">Finished output: {String(selectedBatch?.actualOutput ?? 0)}</p>
          </div>
          <SelectField label="Destination Warehouse" value={destinationWarehouseId} onChange={setDestinationWarehouseId}>
            <option value="">Select destination</option>
            {destinationWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{String(warehouse.name)}</option>
            ))}
          </SelectField>
          <InputField label="Transfer Date" type="date" value={transferDate} onChange={setTransferDate} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setSelectedBatch(null)}>Cancel</Button>
            <Button type="submit" variant="outline" className={actionButtonClassNames.transfer}>Transfer To Warehouse</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>;
}

function InputField({ label, onChange, type = 'text', value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label className="space-y-2 text-sm text-muted">
      <span>{label}</span>
      <input className="surface-input-soft" min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.001' : undefined} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-2 text-sm text-muted">
      <span>{label}</span>
      <select className="surface-input-soft" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}
