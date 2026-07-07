'use client';

import Link from 'next/link';
import { AlertTriangle, Boxes, ClipboardCheck, Factory, PackagePlus, RotateCcw, Scale, SlidersHorizontal, TriangleAlert, Undo2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { InventoryNav } from '@/components/inventory/inventory-nav';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui-library';
import { useInventoryDashboard, useInventoryMeta, useInventoryRequest } from '@/hooks/inventory';
import { useSalesMeta } from '@/hooks/sales/useSalesMeta';

const adjustmentTypes = [
  { label: 'Add Stock', value: 'ADJUSTMENT_IN' },
  { label: 'Reduce Stock', value: 'ADJUSTMENT_OUT' },
] as const;

const finalStockActions = [
  { label: 'Quarantine', value: 'QUARANTINE' },
  { label: 'Reusable', value: 'REUSABLE' },
  { label: 'Damaged', value: 'DAMAGED' },
  { label: 'Waste', value: 'WASTE' },
] as const;

const initialAdjustmentState = {
  itemId: '',
  quantity: '',
  reason: '',
  transactionAt: new Date().toISOString().slice(0, 16),
  type: 'ADJUSTMENT_IN',
  warehouseId: '',
};

const initialStockTakeState = {
  itemId: '',
  physicalQuantity: '',
  postVariances: false,
  reason: '',
  warehouseId: '',
};

const initialReturnState = {
  customerId: '',
  finalStockAction: 'QUARANTINE',
  itemId: '',
  qcNote: '',
  quantity: '',
  reason: '',
  returnWarehouseId: '',
};

const initialProductionIssueState = {
  itemId: '',
  notes: '',
  productionRequestReference: '',
  productionWarehouseId: '',
  quantity: '',
  sourceWarehouseId: '',
};

const initialFinishedGoodsReceiptState = {
  destinationWarehouseId: '',
  itemId: '',
  notes: '',
  productionBatchReference: '',
  quantityAccepted: '',
};

interface FeedbackState {
  message: string;
  tone: 'error' | 'success';
}

export default function InventoryStoresPage() {
  const inventoryMetaQuery = useInventoryMeta();
  const salesMetaQuery = useSalesMeta();
  const dashboardQuery = useInventoryDashboard();
  const request = useInventoryRequest();
  const queryClient = useQueryClient();
  const [adjustmentState, setAdjustmentState] = useState(initialAdjustmentState);
  const [stockTakeState, setStockTakeState] = useState(initialStockTakeState);
  const [returnState, setReturnState] = useState(initialReturnState);
  const [productionIssueState, setProductionIssueState] = useState(initialProductionIssueState);
  const [finishedGoodsReceiptState, setFinishedGoodsReceiptState] = useState(initialFinishedGoodsReceiptState);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  if (inventoryMetaQuery.isLoading || salesMetaQuery.isLoading || dashboardQuery.isLoading) return <LoadingState />;
  if (inventoryMetaQuery.isError || salesMetaQuery.isError || dashboardQuery.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Stores controls unavailable"
        description={
          inventoryMetaQuery.error?.message
          ?? salesMetaQuery.error?.message
          ?? dashboardQuery.error?.message
          ?? 'The stores control data could not be loaded.'
        }
      />
    );
  }

  const warehouses = inventoryMetaQuery.data?.warehouses ?? [];
  const items = inventoryMetaQuery.data?.items ?? [];
  const customers = salesMetaQuery.data?.customers ?? [];
  const metrics = dashboardQuery.data;

  async function runAction(actionKey: string, successMessage: string, task: () => Promise<void>) {
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      await task();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
      ]);
      setFeedback({ message: successMessage, tone: 'success' });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Stores action failed.',
        tone: 'error',
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAdjustmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustmentState.itemId || !adjustmentState.warehouseId || Number(adjustmentState.quantity) <= 0 || !adjustmentState.reason) {
      setFeedback({ message: 'Adjustment needs item, warehouse, quantity, and reason.', tone: 'error' });
      return;
    }

    await runAction('adjustment', 'Stock adjustment posted.', async () => {
      await request('/api/inventory/adjustments', {
        method: 'POST',
          body: JSON.stringify({
            itemId: adjustmentState.itemId,
            quantity: Number(adjustmentState.quantity),
            reason: adjustmentState.reason,
            transactionAt: new Date(adjustmentState.transactionAt).toISOString(),
            type: adjustmentState.type,
            warehouseId: adjustmentState.warehouseId,
          }),
      });
      setAdjustmentState(initialAdjustmentState);
    });
  }

  async function handleStockTakeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stockTakeState.itemId || !stockTakeState.warehouseId || Number(stockTakeState.physicalQuantity) < 0) {
      setFeedback({ message: 'Stock take needs warehouse, item, and physical quantity.', tone: 'error' });
      return;
    }

    await runAction(
      'stock-take',
      stockTakeState.postVariances ? 'Stock take posted and variances applied.' : 'Stock take recorded for review.',
      async () => {
        await request('/api/inventory/stock-take', {
          method: 'POST',
          body: JSON.stringify({
            items: [{ itemId: stockTakeState.itemId, physicalQuantity: Number(stockTakeState.physicalQuantity) }],
            postVariances: stockTakeState.postVariances,
            reason: stockTakeState.reason || 'Stock take variance',
            warehouseId: stockTakeState.warehouseId,
          }),
        });
        setStockTakeState(initialStockTakeState);
      },
    );
  }

  async function handleReturnSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!returnState.customerId || !returnState.returnWarehouseId || !returnState.itemId || Number(returnState.quantity) <= 0 || !returnState.reason) {
      setFeedback({ message: 'Goods return needs customer, warehouse, item, quantity, and reason.', tone: 'error' });
      return;
    }

    await runAction('goods-return', 'Goods return posted into stores.', async () => {
      await request('/api/inventory/goods-return', {
        method: 'POST',
        body: JSON.stringify({
          customerId: returnState.customerId,
          finalStockAction: returnState.finalStockAction,
          items: [{ itemId: returnState.itemId, quantity: Number(returnState.quantity) }],
          qcNote: returnState.qcNote || null,
          reason: returnState.reason,
          returnWarehouseId: returnState.returnWarehouseId,
        }),
      });
      setReturnState(initialReturnState);
    });
  }

  async function handleProductionIssueSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !productionIssueState.sourceWarehouseId ||
      !productionIssueState.productionWarehouseId ||
      !productionIssueState.itemId ||
      Number(productionIssueState.quantity) <= 0
    ) {
      setFeedback({ message: 'Production issue needs source warehouse, production warehouse, item, and quantity.', tone: 'error' });
      return;
    }

    await runAction('production-issue', 'Production issue posted from stores into production.', async () => {
      await request('/api/inventory/production-issue', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ itemId: productionIssueState.itemId, quantity: Number(productionIssueState.quantity) }],
          notes: productionIssueState.notes || null,
          productionRequestReference: productionIssueState.productionRequestReference || null,
          productionWarehouseId: productionIssueState.productionWarehouseId,
          sourceWarehouseId: productionIssueState.sourceWarehouseId,
        }),
      });
      setProductionIssueState(initialProductionIssueState);
    });
  }

  async function handleFinishedGoodsReceiptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !finishedGoodsReceiptState.destinationWarehouseId ||
      !finishedGoodsReceiptState.itemId ||
      Number(finishedGoodsReceiptState.quantityAccepted) <= 0
    ) {
      setFeedback({ message: 'Finished goods receipt needs destination warehouse, item, and accepted quantity.', tone: 'error' });
      return;
    }

    await runAction('finished-goods-receipt', 'Finished goods receipt posted into stores.', async () => {
      await request('/api/inventory/finished-goods-receipt', {
        method: 'POST',
        body: JSON.stringify({
          destinationWarehouseId: finishedGoodsReceiptState.destinationWarehouseId,
          items: [{
            itemId: finishedGoodsReceiptState.itemId,
            quantityAccepted: Number(finishedGoodsReceiptState.quantityAccepted),
          }],
          notes: finishedGoodsReceiptState.notes || null,
          productionBatchReference: finishedGoodsReceiptState.productionBatchReference || null,
        }),
      });
      setFinishedGoodsReceiptState(initialFinishedGoodsReceiptState);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stores Controls"
        description="Run the day-to-day stores controls from one place: stock adjustments, stock take variances, and customer returns back into inventory."
      />
      <InventoryNav />

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile icon={<Boxes className="h-5 w-5 text-orange" />} label="Current stock" value={String(metrics?.currentStockQuantity?.toFixed(3) ?? '0.000')} helper="Live on-hand quantity across stores" />
        <MetricTile icon={<PackagePlus className="h-5 w-5 text-orange" />} label="Received today" value={String(metrics?.receivedTodayQuantity?.toFixed(3) ?? '0.000')} helper="Inbound stores receipts posted today" />
        <MetricTile icon={<Factory className="h-5 w-5 text-orange" />} label="Moved to production" value={String(metrics?.movedToProductionTodayQuantity?.toFixed(3) ?? '0.000')} helper="Stock issued out of stores today" />
        <MetricTile icon={<Undo2 className="h-5 w-5 text-orange" />} label="Returned from production" value={String(metrics?.returnedFromProductionTodayQuantity?.toFixed(3) ?? '0.000')} helper="Surplus posted back into stores today" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile icon={<TriangleAlert className="h-5 w-5 text-warning" />} label="Damaged today" value={String(metrics?.damagedTodayQuantity?.toFixed(3) ?? '0.000')} helper="Stock deducted as damaged or waste" />
        <MetricTile icon={<ClipboardCheck className="h-5 w-5 text-orange" />} label="Pending approvals" value={String(metrics?.pendingApprovalsCount ?? 0)} helper="Transfers, returns, and adjustments waiting" />
        <MetricTile icon={<AlertTriangle className="h-5 w-5 text-warning" />} label="Low stock" value={String(metrics?.lowStockCount ?? 0)} helper="Immediate reorder watch" />
        <MetricTile icon={<Scale className="h-5 w-5 text-orange" />} label="Expiring soon" value={String(metrics?.expiringSoonCount ?? 0)} helper="Batch attention needed" />
      </div>

      <div className="rounded-3xl border border-border bg-white p-5">
        <h2 className="text-lg font-semibold text-brown">Cross-Module Stores Trail</h2>
        <p className="mt-1 text-sm text-muted">
          Jump directly into the linked workflows that feed stores activity across procurement, inventory, production, and quality.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CrossLinkTile href="/procurement/goods-received" label="Procurement GRN" helper="Receive and post incoming stock from suppliers" />
          <CrossLinkTile href="/inventory/transfers" label="Inventory Transfers" helper="Move stock between raw materials, production, dispatch, and returns" />
          <CrossLinkTile href="/production/transfers" label="Production Release" helper="Push completed finished goods from production into stores" />
          <CrossLinkTile href="/quality/returns" label="Quality Returns" helper="Review returned or quarantined stock actions" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-3xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="h-5 w-5 text-orange" />
            <div>
              <h2 className="text-lg font-semibold text-brown">Stock Adjustment</h2>
              <p className="text-sm text-muted">Correct overstated or understated stock with a clear reason trail.</p>
            </div>
          </div>
          <form className="mt-5 space-y-4" onSubmit={handleAdjustmentSubmit}>
            <SelectField
              label="Warehouse"
              value={adjustmentState.warehouseId}
              onChange={(value) => setAdjustmentState((current) => ({ ...current, warehouseId: value }))}
              options={warehouses.map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))}
              placeholder="Select warehouse"
            />
            <SelectField
              label="Item"
              value={adjustmentState.itemId}
              onChange={(value) => setAdjustmentState((current) => ({ ...current, itemId: value }))}
              options={items.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))}
              placeholder="Select item"
            />
            <SelectField
              label="Adjustment Type"
              value={adjustmentState.type}
              onChange={(value) => setAdjustmentState((current) => ({ ...current, type: value }))}
              options={adjustmentTypes.map((option) => ({ label: option.label, value: option.value }))}
            />
            <InputField
              label="Quantity"
              type="number"
              value={adjustmentState.quantity}
              onChange={(value) => setAdjustmentState((current) => ({ ...current, quantity: value }))}
            />
            <InputField
              label="Date / Time"
              type="datetime-local"
              value={adjustmentState.transactionAt}
              onChange={(value) => setAdjustmentState((current) => ({ ...current, transactionAt: value }))}
            />
            <TextAreaField
              label="Reason"
              value={adjustmentState.reason}
              onChange={(value) => setAdjustmentState((current) => ({ ...current, reason: value }))}
            />
            <Button type="submit" className="w-full" disabled={pendingAction === 'adjustment'}>
              {pendingAction === 'adjustment' ? 'Posting...' : 'Post Adjustment'}
            </Button>
          </form>
        </section>

        <section className="rounded-3xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <Scale className="h-5 w-5 text-orange" />
            <div>
              <h2 className="text-lg font-semibold text-brown">Stock Take</h2>
              <p className="text-sm text-muted">Capture a physical count and choose whether to post the variance immediately.</p>
            </div>
          </div>
          <form className="mt-5 space-y-4" onSubmit={handleStockTakeSubmit}>
            <SelectField
              label="Warehouse"
              value={stockTakeState.warehouseId}
              onChange={(value) => setStockTakeState((current) => ({ ...current, warehouseId: value }))}
              options={warehouses.map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))}
              placeholder="Select warehouse"
            />
            <SelectField
              label="Item"
              value={stockTakeState.itemId}
              onChange={(value) => setStockTakeState((current) => ({ ...current, itemId: value }))}
              options={items.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))}
              placeholder="Select item"
            />
            <InputField
              label="Physical Quantity"
              type="number"
              value={stockTakeState.physicalQuantity}
              onChange={(value) => setStockTakeState((current) => ({ ...current, physicalQuantity: value }))}
            />
            <TextAreaField
              label="Variance Reason"
              value={stockTakeState.reason}
              onChange={(value) => setStockTakeState((current) => ({ ...current, reason: value }))}
            />
            <label className="surface-checkbox-row">
              <input
                type="checkbox"
                checked={stockTakeState.postVariances}
                onChange={(event) => setStockTakeState((current) => ({ ...current, postVariances: event.target.checked }))}
                className="h-4 w-4 rounded border-border text-orange focus:ring-orange"
              />
              Post variance immediately
            </label>
            <Button type="submit" className="w-full" disabled={pendingAction === 'stock-take'}>
              {pendingAction === 'stock-take' ? 'Saving...' : 'Save Stock Take'}
            </Button>
          </form>
        </section>

        <section className="rounded-3xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-orange" />
            <div>
              <h2 className="text-lg font-semibold text-brown">Customer Return To Stores</h2>
              <p className="text-sm text-muted">Receive customer returns back into inventory with the intended stock action recorded.</p>
            </div>
          </div>
          <form className="mt-5 space-y-4" onSubmit={handleReturnSubmit}>
            <SelectField
              label="Customer"
              value={returnState.customerId}
              onChange={(value) => setReturnState((current) => ({ ...current, customerId: value }))}
              options={customers.map((customer) => ({ label: customer.name, value: customer.id }))}
              placeholder="Select customer"
            />
            <SelectField
              label="Return Warehouse"
              value={returnState.returnWarehouseId}
              onChange={(value) => setReturnState((current) => ({ ...current, returnWarehouseId: value }))}
              options={warehouses.map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))}
              placeholder="Select warehouse"
            />
            <SelectField
              label="Item"
              value={returnState.itemId}
              onChange={(value) => setReturnState((current) => ({ ...current, itemId: value }))}
              options={items.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))}
              placeholder="Select item"
            />
            <InputField
              label="Quantity"
              type="number"
              value={returnState.quantity}
              onChange={(value) => setReturnState((current) => ({ ...current, quantity: value }))}
            />
            <SelectField
              label="Final Stock Action"
              value={returnState.finalStockAction}
              onChange={(value) => setReturnState((current) => ({ ...current, finalStockAction: value }))}
              options={finalStockActions.map((option) => ({ label: option.label, value: option.value }))}
            />
            <TextAreaField
              label="Reason"
              value={returnState.reason}
              onChange={(value) => setReturnState((current) => ({ ...current, reason: value }))}
            />
            <TextAreaField
              label="QC Note"
              value={returnState.qcNote}
              onChange={(value) => setReturnState((current) => ({ ...current, qcNote: value }))}
            />
            <Button type="submit" className="w-full" disabled={pendingAction === 'goods-return'}>
              {pendingAction === 'goods-return' ? 'Posting...' : 'Post Customer Return'}
            </Button>
          </form>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <Factory className="h-5 w-5 text-orange" />
            <div>
              <h2 className="text-lg font-semibold text-brown">Production Issue</h2>
              <p className="text-sm text-muted">Issue raw materials or packaging out of stores into the production warehouse.</p>
            </div>
          </div>
          <form className="mt-5 space-y-4" onSubmit={handleProductionIssueSubmit}>
            <SelectField
              label="Source Warehouse"
              value={productionIssueState.sourceWarehouseId}
              onChange={(value) => setProductionIssueState((current) => ({ ...current, sourceWarehouseId: value }))}
              options={warehouses.map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))}
              placeholder="Select source warehouse"
            />
            <SelectField
              label="Production Warehouse"
              value={productionIssueState.productionWarehouseId}
              onChange={(value) => setProductionIssueState((current) => ({ ...current, productionWarehouseId: value }))}
              options={warehouses.map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))}
              placeholder="Select production warehouse"
            />
            <SelectField
              label="Item"
              value={productionIssueState.itemId}
              onChange={(value) => setProductionIssueState((current) => ({ ...current, itemId: value }))}
              options={items.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))}
              placeholder="Select item"
            />
            <InputField
              label="Quantity"
              type="number"
              value={productionIssueState.quantity}
              onChange={(value) => setProductionIssueState((current) => ({ ...current, quantity: value }))}
            />
            <InputField
              label="Production Request Reference"
              value={productionIssueState.productionRequestReference}
              onChange={(value) => setProductionIssueState((current) => ({ ...current, productionRequestReference: value }))}
            />
            <TextAreaField
              label="Notes"
              value={productionIssueState.notes}
              onChange={(value) => setProductionIssueState((current) => ({ ...current, notes: value }))}
            />
            <Button type="submit" className="w-full" disabled={pendingAction === 'production-issue'}>
              {pendingAction === 'production-issue' ? 'Posting...' : 'Post Production Issue'}
            </Button>
          </form>
        </section>

        <section className="rounded-3xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <PackagePlus className="h-5 w-5 text-orange" />
            <div>
              <h2 className="text-lg font-semibold text-brown">Finished Goods Receipt</h2>
              <p className="text-sm text-muted">Receive accepted finished output back into stores after production completion.</p>
            </div>
          </div>
          <form className="mt-5 space-y-4" onSubmit={handleFinishedGoodsReceiptSubmit}>
            <SelectField
              label="Destination Warehouse"
              value={finishedGoodsReceiptState.destinationWarehouseId}
              onChange={(value) => setFinishedGoodsReceiptState((current) => ({ ...current, destinationWarehouseId: value }))}
              options={warehouses.map((warehouse) => ({ label: warehouse.name, value: warehouse.id }))}
              placeholder="Select destination warehouse"
            />
            <SelectField
              label="Finished Good Item"
              value={finishedGoodsReceiptState.itemId}
              onChange={(value) => setFinishedGoodsReceiptState((current) => ({ ...current, itemId: value }))}
              options={items.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))}
              placeholder="Select finished good"
            />
            <InputField
              label="Accepted Quantity"
              type="number"
              value={finishedGoodsReceiptState.quantityAccepted}
              onChange={(value) => setFinishedGoodsReceiptState((current) => ({ ...current, quantityAccepted: value }))}
            />
            <InputField
              label="Production Batch Reference"
              value={finishedGoodsReceiptState.productionBatchReference}
              onChange={(value) => setFinishedGoodsReceiptState((current) => ({ ...current, productionBatchReference: value }))}
            />
            <TextAreaField
              label="Notes"
              value={finishedGoodsReceiptState.notes}
              onChange={(value) => setFinishedGoodsReceiptState((current) => ({ ...current, notes: value }))}
            />
            <Button type="submit" className="w-full" disabled={pendingAction === 'finished-goods-receipt'}>
              {pendingAction === 'finished-goods-receipt' ? 'Posting...' : 'Post Finished Goods Receipt'}
            </Button>
          </form>
        </section>
      </div>

      <section className="rounded-3xl border border-border bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-brown">Stock Balance By Item / Warehouse</h2>
            <p className="mt-1 text-sm text-muted">
              Focused stores view of the current balance, reorder point, and warehouse holding location.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          {metrics?.stockBalanceByWarehouse?.length ? (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.18em] text-muted">
                  <th className="px-2 py-3 font-semibold">Item</th>
                  <th className="px-2 py-3 font-semibold">Warehouse</th>
                  <th className="px-2 py-3 font-semibold">On Hand</th>
                  <th className="px-2 py-3 font-semibold">Available</th>
                  <th className="px-2 py-3 font-semibold">Reorder</th>
                  <th className="px-2 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics.stockBalanceByWarehouse.map((row) => (
                  <tr key={`${row.itemId}:${row.warehouseId}`} className="border-b border-border/60 last:border-b-0">
                    <td className="px-2 py-3">
                      <p className="font-medium text-brown">{row.itemCode} - {row.itemName}</p>
                    </td>
                    <td className="px-2 py-3">{row.warehouseName}</td>
                    <td className="px-2 py-3">{row.quantityOnHand.toFixed(3)}</td>
                    <td className="px-2 py-3">{row.availableQuantity.toFixed(3)}</td>
                    <td className="px-2 py-3">{row.reorderLevel.toFixed(3)}</td>
                    <td className={`px-2 py-3 font-medium ${row.isLowStock ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {row.isLowStock ? 'Low stock' : 'Healthy'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon={<Boxes className="h-6 w-6" />}
              title="No store balances loaded"
              description="Stock balances appear here once receiving, adjustments, or production postings are recorded."
            />
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-brown">Today&apos;s Stores Movement Trail</h2>
            <p className="mt-1 text-sm text-muted">
              Stores highlights inbound receipts, production issues, production returns, and damaged stock from the live movement ledger.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {metrics?.todaysMovements?.length ? (
            metrics.todaysMovements.map((movement) => {
              const tone =
                movement.movementType === 'PRODUCTION_ISSUE'
                  ? 'text-sky-700'
                  : movement.movementType === 'PRODUCTION_RETURN'
                    ? 'text-emerald-700'
                    : ['DAMAGE', 'WASTAGE', 'DAMAGED_GOODS_TRANSFER', 'EXPIRY_WRITE_OFF'].includes(movement.movementType)
                      ? 'text-rose-700'
                      : 'text-brown';

              return (
                <div key={movement.id} className="surface-tile flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-brown">{movement.itemName}</p>
                    <p className="text-sm text-muted">
                      {movement.warehouseName}
                      {movement.notes ? ` • ${movement.notes}` : ''}
                    </p>
                  </div>
                  <div className={`flex items-center gap-3 text-sm font-semibold ${tone}`}>
                    <span>{movement.movementType}</span>
                    <span>{movement.quantity.toFixed(3)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={<ClipboardCheck className="h-6 w-6" />}
              title="No stores movements yet today"
              description="Posted receipts, production issues, returns, and damages will appear here."
            />
          )}
        </div>
      </section>
    </div>
  );
}

function CrossLinkTile({
  helper,
  href,
  label,
}: {
  helper: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-cream/40 px-4 py-4 text-sm transition hover:border-orange/30 hover:bg-cream/70"
    >
      <p className="font-semibold text-brown">{label}</p>
      <p className="mt-2 text-muted">{helper}</p>
    </Link>
  );
}

function MetricTile({
  helper,
  icon,
  label,
  value,
}: {
  helper: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="surface-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">{label}</p>
        {icon}
      </div>
      <p className="mt-4 text-3xl font-semibold text-brown">{value}</p>
      <p className="mt-2 text-sm text-muted">{helper}</p>
    </div>
  );
}

function SelectField({
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="space-y-2 text-sm text-muted">
      <span>{label}</span>
      <select className="surface-input-soft" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder ?? 'Select option'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InputField({
  label,
  onChange,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="space-y-2 text-sm text-muted">
      <span>{label}</span>
      <input
        className="surface-input-soft"
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.001' : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="space-y-2 text-sm text-muted">
      <span>{label}</span>
      <textarea
        rows={3}
        className="surface-textarea-soft"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
