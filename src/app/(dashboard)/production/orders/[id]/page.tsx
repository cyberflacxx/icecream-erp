'use client';

import Link from 'next/link';
import { AlertCircle, ArrowLeft, Boxes, CheckCircle2, Factory, Lock, PackageCheck, Route, ScrollText } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, LoadingState, StatusBadge } from '@/components/ui-library';
import { useProductionOrder } from '@/hooks/production/useProductionOrders';
import { useProductionRequest } from '@/hooks/production/useProductionRequest';
import { API_ROUTES } from '@/lib/shared';
import { cn } from '@/lib/utils';

const tabs = ['Summary', 'Components', 'Issue for Production', 'Receipt from Production', 'Costing', 'Relationship Map', 'Audit History'] as const;

function qty(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function asRows(value: unknown) {
  return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}

export default function ProductionOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detailQuery = useProductionOrder(id);
  const request = useProductionRequest();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Summary');
  const [actionError, setActionError] = useState<string | null>(null);
  const [releaseQuantity, setReleaseQuantity] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [issueQuantities, setIssueQuantities] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState({ batchNumber: '', completedQuantity: '', expiryDate: '', productionDate: '', rejectedQuantity: '', wastageQuantity: '' });
  const [closingNotes, setClosingNotes] = useState('');

  const detail = detailQuery.data;
  const order = detail?.order ?? {};
  const components = useMemo(() => detail?.components ?? [], [detail?.components]);
  const issues = detail?.issues ?? [];
  const receipts = detail?.receipts ?? [];
  const isPlanned = order.status === 'PLANNED';
  const isReleased = order.status === 'RELEASED';
  const isClosed = order.status === 'CLOSED';

  const issueLines = useMemo(
    () => components
      .map((component) => ({
        component,
        remaining: Math.max(Number(component.released_quantity ?? 0) - Number(component.issued_quantity ?? 0), 0),
      }))
      .filter((row) => row.remaining > 0),
    [components],
  );

  async function runAction(path: string, payload: Record<string, unknown>) {
    setActionError(null);
    try {
      await request(path, { body: JSON.stringify(payload), method: 'POST' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production'] }),
        queryClient.invalidateQueries({ queryKey: ['production', 'order', id] }),
      ]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action failed.');
    }
  }

  async function submitRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(API_ROUTES.PRODUCTION.ORDER_RELEASE(id), {
      releaseNotes: releaseNotes || null,
      releasedQuantity: Number(releaseQuantity || order.planned_quantity || 0),
    });
  }

  async function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = issueLines
      .map(({ component, remaining }) => ({
        componentId: component.id,
        currentIssueQuantity: Number(issueQuantities[String(component.id)] || remaining),
      }))
      .filter((line) => line.currentIssueQuantity > 0);
    await runAction(API_ROUTES.PRODUCTION.ORDER_ISSUE(id), {
      idempotencyKey: crypto.randomUUID(),
      lines,
      remarks: 'Issue for production',
    });
    setIssueQuantities({});
  }

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(API_ROUTES.PRODUCTION.ORDER_RECEIPT(id), {
      batchNumber: receipt.batchNumber || null,
      completedQuantity: Number(receipt.completedQuantity || 0),
      expiryDate: receipt.expiryDate || null,
      idempotencyKey: crypto.randomUUID(),
      productionDate: receipt.productionDate || null,
      rejectedQuantity: Number(receipt.rejectedQuantity || 0),
      wastageQuantity: Number(receipt.wastageQuantity || 0),
    });
  }

  async function submitClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(API_ROUTES.PRODUCTION.ORDER_CLOSE(id), { closingNotes: closingNotes || null });
  }

  if (detailQuery.isLoading) return <LoadingState />;
  if (detailQuery.isError || !detail) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Production order unavailable" description={detailQuery.error?.message ?? 'No order data returned.'} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={String(order.production_order_number ?? 'Production Order')}
        description={`${String(order.product_number ?? '')} ${String(order.product_description_snapshot ?? '')}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/production/orders"><ArrowLeft className="mr-2 h-4 w-4" />Orders</Link>
          </Button>
        }
      />
      <ProductionNav />

      {actionError ? <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{actionError}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
          <p className="text-xs uppercase text-[color:var(--app-muted)]">Status</p>
          <div className="mt-2"><StatusBadge status={String(order.status ?? '')} /></div>
        </div>
        <div className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
          <p className="text-xs uppercase text-[color:var(--app-muted)]">Planned</p>
          <p className="mt-2 text-xl font-semibold">{qty(order.planned_quantity)}</p>
        </div>
        <div className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
          <p className="text-xs uppercase text-[color:var(--app-muted)]">Released</p>
          <p className="mt-2 text-xl font-semibold">{qty(order.released_quantity)}</p>
        </div>
        <div className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
          <p className="text-xs uppercase text-[color:var(--app-muted)]">Remaining</p>
          <p className="mt-2 text-xl font-semibold">{qty(order.remaining_quantity)}</p>
        </div>
      </section>

      <div className="overflow-x-auto border-b border-[color:var(--app-border)]">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn(
                'px-3 py-2 text-sm font-medium',
                activeTab === tab ? 'border-b-2 border-[color:var(--app-accent)] text-[color:var(--app-accent-strong)]' : 'text-[color:var(--app-muted)]',
              )}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Summary' ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
            <h2 className="text-sm font-semibold">Header</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              {[
                ['Product Number', order.product_number],
                ['Product Description', order.product_description_snapshot],
                ['BOM Number', order.bom_number],
                ['BOM Version', order.bom_version],
                ['Production Warehouse', (order.production_warehouse as Record<string, unknown> | null)?.name],
                ['Finished-Goods Warehouse', (order.finished_goods_warehouse as Record<string, unknown> | null)?.name],
                ['Start Date', order.planned_start_date],
                ['Due Date', order.planned_due_date],
                ['Priority', order.priority],
                ['Remarks', order.remarks],
              ].map(([label, value]) => (
                <div key={String(label)} className="grid grid-cols-[170px_1fr] gap-3">
                  <dt className="text-[color:var(--app-muted)]">{String(label)}</dt>
                  <dd>{String(value ?? '')}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="space-y-4">
            {isPlanned ? (
              <form className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4" onSubmit={submitRelease}>
                <h2 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" />Release Order</h2>
                <div className="mt-4 grid gap-3">
                  <input className="surface-input-soft" min="0.001" step="0.001" type="number" placeholder="Released quantity" value={releaseQuantity} onChange={(event) => setReleaseQuantity(event.target.value)} />
                  <textarea className="surface-input-soft min-h-20" placeholder="Release notes" value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} />
                  <Button type="submit">Release</Button>
                </div>
              </form>
            ) : null}

            {isReleased ? (
              <form className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4" onSubmit={submitClose}>
                <h2 className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4" />Close Order</h2>
                <div className="mt-4 grid gap-3">
                  <textarea className="surface-input-soft min-h-20" placeholder="Closing notes" value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} />
                  <Button type="submit" disabled={Number(order.completed_quantity ?? 0) <= 0}>Close</Button>
                </div>
              </form>
            ) : null}

            {isClosed ? (
              <div className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] p-4 text-sm">
                This order is locked. Corrections require a reversal or controlled reopening workflow.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'Components' ? (
        <DataTable
          columns={[
            { key: 'component_number_snapshot', header: 'Item #' },
            { key: 'component_description_snapshot', header: 'Description' },
            { key: 'planned_quantity', header: 'Planned', render: (row) => qty(row.planned_quantity) },
            { key: 'released_quantity', header: 'Released', render: (row) => qty(row.released_quantity) },
            { key: 'issued_quantity', header: 'Issued', render: (row) => qty(row.issued_quantity) },
            { key: 'available_quantity_snapshot', header: 'Available', render: (row) => qty(row.available_quantity_snapshot) },
            { key: 'shortage_quantity', header: 'Shortage', render: (row) => <span className={Number(row.shortage_quantity ?? 0) > 0 ? 'text-error' : 'text-success'}>{qty(row.shortage_quantity)}</span> },
            { key: 'unit_cost_snapshot', header: 'Unit Cost', render: (row) => money(row.unit_cost_snapshot) },
          ]}
          data={components}
          emptyState={<EmptyState icon={<Boxes className="h-6 w-6" />} title="No component snapshot" description="Release or save a planned order to calculate component requirements." />}
        />
      ) : null}

      {activeTab === 'Issue for Production' ? (
        <section className="space-y-4">
          {isReleased ? (
            <form className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4" onSubmit={submitIssue}>
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Factory className="h-4 w-4" />Issue Materials</h2>
              <div className="mt-4 space-y-2">
                {issueLines.map(({ component, remaining }) => (
                  <div key={String(component.id)} className="grid gap-2 rounded-lg bg-[color:var(--app-bg-subtle)] p-3 text-sm md:grid-cols-[1fr_120px_160px]">
                    <span>{String(component.component_number_snapshot)} {String(component.component_description_snapshot)}</span>
                    <span>Remaining {qty(remaining)}</span>
                    <input className="surface-input-soft" min="0" max={remaining} step="0.001" type="number" value={issueQuantities[String(component.id)] ?? String(remaining)} onChange={(event) => setIssueQuantities((current) => ({ ...current, [String(component.id)]: event.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end"><Button type="submit" disabled={issueLines.length === 0}>Post Issue</Button></div>
            </form>
          ) : null}
          <DataTable
            columns={[
              { key: 'issue_number', header: 'Issue #' },
              { key: 'issue_date', header: 'Date' },
              { key: 'posting_status', header: 'Status', render: (row) => <StatusBadge status={String(row.posting_status)} /> },
              { key: 'total_quantity', header: 'Quantity', render: (row) => qty(row.total_quantity) },
              { key: 'total_cost', header: 'Cost', render: (row) => money(row.total_cost) },
            ]}
            data={issues}
            emptyState={<EmptyState icon={<Factory className="h-6 w-6" />} title="No production issues" description="Posted issues will appear here." />}
          />
        </section>
      ) : null}

      {activeTab === 'Receipt from Production' ? (
        <section className="space-y-4">
          {isReleased ? (
            <form className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4" onSubmit={submitReceipt}>
              <h2 className="flex items-center gap-2 text-sm font-semibold"><PackageCheck className="h-4 w-4" />Receive Production</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <input className="surface-input-soft" placeholder="Completed quantity" type="number" min="0" step="0.001" value={receipt.completedQuantity} onChange={(event) => setReceipt((current) => ({ ...current, completedQuantity: event.target.value }))} />
                <input className="surface-input-soft" placeholder="Rejected quantity" type="number" min="0" step="0.001" value={receipt.rejectedQuantity} onChange={(event) => setReceipt((current) => ({ ...current, rejectedQuantity: event.target.value }))} />
                <input className="surface-input-soft" placeholder="Wastage quantity" type="number" min="0" step="0.001" value={receipt.wastageQuantity} onChange={(event) => setReceipt((current) => ({ ...current, wastageQuantity: event.target.value }))} />
                <input className="surface-input-soft" placeholder="Batch number" value={receipt.batchNumber} onChange={(event) => setReceipt((current) => ({ ...current, batchNumber: event.target.value }))} />
                <input className="surface-input-soft" type="date" value={receipt.productionDate} onChange={(event) => setReceipt((current) => ({ ...current, productionDate: event.target.value }))} />
                <input className="surface-input-soft" type="date" value={receipt.expiryDate} onChange={(event) => setReceipt((current) => ({ ...current, expiryDate: event.target.value }))} />
              </div>
              <div className="mt-4 flex justify-end"><Button type="submit">Post Receipt</Button></div>
            </form>
          ) : null}
          <DataTable
            columns={[
              { key: 'receipt_number', header: 'Receipt #' },
              { key: 'receipt_date', header: 'Date' },
              { key: 'posting_status', header: 'Status', render: (row) => <StatusBadge status={String(row.posting_status)} /> },
              { key: 'total_completed_quantity', header: 'Completed', render: (row) => qty(row.total_completed_quantity) },
              { key: 'total_rejected_quantity', header: 'Rejected', render: (row) => qty(row.total_rejected_quantity) },
              { key: 'total_cost', header: 'Cost', render: (row) => money(row.total_cost) },
            ]}
            data={receipts}
            emptyState={<EmptyState icon={<PackageCheck className="h-6 w-6" />} title="No production receipts" description="Posted receipts will appear here." />}
          />
        </section>
      ) : null}

      {activeTab === 'Costing' ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['Planned Cost', detail.costs?.planned_cost ?? order.planned_cost],
            ['Posted Material Cost', detail.costs?.posted_material_cost ?? order.actual_cost],
            ['Actual Cost', detail.costs?.actual_cost ?? order.actual_cost],
            ['Cost Per Unit', detail.costs?.cost_per_unit ?? order.cost_per_unit],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
              <p className="text-xs uppercase text-[color:var(--app-muted)]">{String(label)}</p>
              <p className="mt-2 text-xl font-semibold">{money(value)}</p>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'Relationship Map' ? (
        <div className="grid gap-3">
          {(detail.relationshipMap ?? []).map((node, index) => (
            <div key={`${node.document_type}-${node.document_id}`} className="flex items-center gap-3 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
              {index === 0 ? <ScrollText className="h-5 w-5 text-[color:var(--app-accent-strong)]" /> : <Route className="h-5 w-5 text-[color:var(--app-muted)]" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{String(node.document_number)}</p>
                <p className="text-sm text-[color:var(--app-muted)]">{String(node.document_type)} · {String(node.document_date ?? '')}</p>
              </div>
              <StatusBadge status={String(node.status)} />
              <span className="text-sm">{qty(node.quantity)}</span>
              <span className="text-sm">{money(node.value)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'Audit History' ? (
        <DataTable
          columns={[
            { key: 'changed_at', header: 'Changed At' },
            { key: 'previous_status', header: 'From', render: (row) => String(row.previous_status ?? '') },
            { key: 'new_status', header: 'To', render: (row) => <StatusBadge status={String(row.new_status)} /> },
            { key: 'source_action', header: 'Action' },
            { key: 'notes', header: 'Notes', render: (row) => String(row.notes ?? '') },
          ]}
          data={asRows(detail.statusHistory)}
          emptyState={<EmptyState icon={<ScrollText className="h-6 w-6" />} title="No status history" description="Status changes will appear here." />}
        />
      ) : null}
    </div>
  );
}
