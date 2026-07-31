'use client';

import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Factory,
  Lock,
  PackageCheck,
  PencilLine,
  RotateCcw,
  Route,
  ScrollText,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DataTable, EmptyState, LoadingState, StatusBadge } from '@/components/ui-library';
import { useProductionOrder } from '@/hooks/production/useProductionOrders';
import { useProductionRequest } from '@/hooks/production/useProductionRequest';
import { usePermission } from '@/hooks/usePermission';
import { isProductionDocumentDateInFuture } from '@/lib/production';
import { API_ROUTES } from '@/lib/shared';
import { cn } from '@/lib/utils';

const today = new Date().toISOString().slice(0, 10);
const tabs = ['Summary', 'Components', 'Issue for Production', 'Receipt from Production', 'Costing', 'Relationship Map', 'Audit History'] as const;

type TabName = (typeof tabs)[number];

type CorrectionDialogState =
  | { documentId: string; documentNumber: string; kind: 'issue' }
  | { documentId: string; documentNumber: string; kind: 'receipt' }
  | { documentNumber: string; kind: 'reopen' };

type ReceiptFormState = {
  batchNumber: string;
  completedQuantity: string;
  expiryDate: string;
  productionDate: string;
  receiptDate: string;
  rejectedQuantity: string;
  remarks: string;
  wastageQuantity: string;
};

function qty(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function asRows(value: unknown) {
  return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function resolveInitialTab(value: string | null): TabName {
  if (value === 'issue') return 'Issue for Production';
  if (value === 'receipt') return 'Receipt from Production';
  return 'Summary';
}

function formatDate(value: unknown) {
  return String(value ?? '').slice(0, 10);
}

function resolveUserDisplayName(value: unknown) {
  const user = asRecord(value);
  if (!user) return '';
  const fullName = String(user.full_name ?? '').trim();
  if (fullName) return fullName;
  const firstName = String(user.first_name ?? '').trim();
  const lastName = String(user.last_name ?? '').trim();
  return `${firstName} ${lastName}`.trim();
}

function isPostedOrReversed(value: unknown) {
  const status = String(value ?? '').toUpperCase();
  return status === 'POSTED' || status === 'REVERSED';
}

export default function ProductionOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const detailQuery = useProductionOrder(id);
  const request = useProductionRequest();
  const queryClient = useQueryClient();
  const canEditPlanned = usePermission('production_order.edit_planned');
  const canReleaseOrder = usePermission('production_order.release');
  const canCloseOrder = usePermission('production_order.close');
  const canReopenOrder = usePermission('production_order.reopen');
  const canPostIssue = usePermission('production_issue.post');
  const canReverseIssue = usePermission('production_issue.reverse');
  const canPostReceipt = usePermission('production_receipt.post');
  const canReverseReceipt = usePermission('production_receipt.reverse');
  const [activeTab, setActiveTab] = useState<TabName>(resolveInitialTab(searchParams.get('tab')));
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [releaseQuantity, setReleaseQuantity] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [issueRemarks, setIssueRemarks] = useState('');
  const [issueQuantities, setIssueQuantities] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<ReceiptFormState>({
    batchNumber: '',
    completedQuantity: '',
    expiryDate: '',
    productionDate: today,
    receiptDate: today,
    rejectedQuantity: '',
    remarks: '',
    wastageQuantity: '',
  });
  const [closingNotes, setClosingNotes] = useState('');
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [correctionDialog, setCorrectionDialog] = useState<CorrectionDialogState | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');

  useEffect(() => {
    setActiveTab(resolveInitialTab(searchParams.get('tab')));
  }, [searchParams]);

  const detail = detailQuery.data;
  const order = detail?.order ?? {};
  const components = useMemo(() => detail?.components ?? [], [detail?.components]);
  const issues = detail?.issues ?? [];
  const receipts = detail?.receipts ?? [];
  const isPlanned = order.status === 'PLANNED';
  const isReleased = order.status === 'RELEASED';
  const isClosed = order.status === 'CLOSED';
  const hasPostedDocuments = issues.some((issue) => isPostedOrReversed(issue.posting_status)) || receipts.some((receiptDocument) => isPostedOrReversed(receiptDocument.posting_status));
  const correctionPendingKey = correctionDialog
    ? correctionDialog.kind === 'reopen'
      ? 'reopen'
      : `${correctionDialog.kind}-reverse-${correctionDialog.documentId}`
    : null;

  const issueLines = useMemo(
    () => components
      .map((component) => ({
        component,
        remaining: Math.max(Number(component.released_quantity ?? 0) - Number(component.issued_quantity ?? 0), 0),
      }))
      .filter((row) => row.remaining > 0),
    [components],
  );

  function isPending(key: string) {
    return pendingAction === key;
  }

  function resetReceiptForm() {
    setReceipt({
      batchNumber: '',
      completedQuantity: '',
      expiryDate: '',
      productionDate: today,
      receiptDate: today,
      rejectedQuantity: '',
      remarks: '',
      wastageQuantity: '',
    });
  }

  function openCorrectionDialog(next: CorrectionDialogState) {
    setActionError(null);
    setCorrectionReason('');
    setCorrectionDialog(next);
  }

  function closeCorrectionDialog() {
    if (correctionPendingKey && isPending(correctionPendingKey)) return;
    setCorrectionDialog(null);
    setCorrectionReason('');
  }

  function closeCloseDialog() {
    if (isPending('close')) return;
    setCloseDialogOpen(false);
  }

  async function runAction(
    path: string,
    payload: Record<string, unknown>,
    options?: { onSuccess?: () => void; pendingKey?: string },
  ) {
    setActionError(null);
    if (options?.pendingKey) {
      setPendingAction(options.pendingKey);
    }

    try {
      await request(path, { body: JSON.stringify(payload), method: 'POST' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production'] }),
        queryClient.invalidateQueries({ queryKey: ['production', 'order', id] }),
        queryClient.invalidateQueries({ queryKey: ['production-batches'] }),
      ]);
      options?.onSuccess?.();
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action failed.');
      return false;
    } finally {
      if (options?.pendingKey) {
        setPendingAction((current) => (current === options.pendingKey ? null : current));
      }
    }
  }

  async function submitRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(API_ROUTES.PRODUCTION.ORDER_RELEASE(id), {
      releaseNotes: releaseNotes || null,
      releasedQuantity: Number(releaseQuantity || order.planned_quantity || 0),
    }, {
      pendingKey: 'release',
    });
  }

  async function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isProductionDocumentDateInFuture(issueDate)) {
      setActionError(`Issue date ${issueDate} cannot be in the future.`);
      return;
    }

    const lines = issueLines
      .map(({ component, remaining }) => ({
        componentId: component.id,
        currentIssueQuantity: Number(issueQuantities[String(component.id)] || remaining),
      }))
      .filter((line) => line.currentIssueQuantity > 0);
    const succeeded = await runAction(API_ROUTES.PRODUCTION.ORDER_ISSUE(id), {
      idempotencyKey: crypto.randomUUID(),
      issueDate,
      lines,
      remarks: issueRemarks || null,
    }, {
      pendingKey: 'issue',
    });
    if (succeeded) {
      setIssueQuantities({});
      setIssueRemarks('');
      setIssueDate(today);
    }
  }

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isProductionDocumentDateInFuture(receipt.receiptDate)) {
      setActionError(`Receipt date ${receipt.receiptDate} cannot be in the future.`);
      return;
    }

    await runAction(API_ROUTES.PRODUCTION.ORDER_RECEIPT(id), {
      batchNumber: receipt.batchNumber || null,
      completedQuantity: Number(receipt.completedQuantity || 0),
      expiryDate: receipt.expiryDate || null,
      idempotencyKey: crypto.randomUUID(),
      productionDate: receipt.productionDate || null,
      receiptDate: receipt.receiptDate || null,
      rejectedQuantity: Number(receipt.rejectedQuantity || 0),
      remarks: receipt.remarks || null,
      wastageQuantity: Number(receipt.wastageQuantity || 0),
    }, {
      onSuccess: resetReceiptForm,
      pendingKey: 'receipt',
    });
  }

  async function confirmClose() {
    await runAction(API_ROUTES.PRODUCTION.ORDER_CLOSE(id), {
      closingNotes: closingNotes || null,
    }, {
      onSuccess: () => {
        setCloseDialogOpen(false);
        setClosingNotes('');
      },
      pendingKey: 'close',
    });
  }

  async function confirmCorrection() {
    if (!correctionDialog || !correctionPendingKey) return;

    if (correctionDialog.kind === 'issue') {
      await runAction(API_ROUTES.PRODUCTION.ORDER_ISSUE_REVERSE(id, correctionDialog.documentId), {
        reason: correctionReason,
      }, {
        onSuccess: () => {
          setCorrectionDialog(null);
          setCorrectionReason('');
        },
        pendingKey: correctionPendingKey,
      });
      return;
    }

    if (correctionDialog.kind === 'receipt') {
      await runAction(API_ROUTES.PRODUCTION.ORDER_RECEIPT_REVERSE(id, correctionDialog.documentId), {
        reason: correctionReason,
      }, {
        onSuccess: () => {
          setCorrectionDialog(null);
          setCorrectionReason('');
        },
        pendingKey: correctionPendingKey,
      });
      return;
    }

    await runAction(API_ROUTES.PRODUCTION.ORDER_REOPEN(id), {
      reason: correctionReason,
    }, {
      onSuccess: () => {
        setCorrectionDialog(null);
        setCorrectionReason('');
      },
      pendingKey: correctionPendingKey,
    });
  }

  if (detailQuery.isLoading) return <LoadingState />;
  if (detailQuery.isError || !detail) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Production order unavailable" description={detailQuery.error?.message ?? 'No order data returned.'} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={String(order.production_order_number ?? 'Production Order')}
        description={`${String(order.product_number ?? '')} ${String(order.product_description_snapshot ?? '')}`.trim()}
        actions={(
          <div className="flex gap-2">
            {isPlanned && canEditPlanned && !hasPostedDocuments ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/production/orders/${id}/edit`}>
                  <PencilLine className="mr-2 h-4 w-4" />
                  Edit Planned Order
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/production/orders"><ArrowLeft className="mr-2 h-4 w-4" />Orders</Link>
            </Button>
          </div>
        )}
      />
      <ProductionNav />

      {actionError ? <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{actionError}</div> : null}
      {isClosed ? (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This order is CLOSED and read-only. Further corrections require document reversal or an authorized reopen action.
        </div>
      ) : null}

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
            {isPlanned && canReleaseOrder ? (
              <form className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4" onSubmit={submitRelease}>
                <h2 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" />Release Order</h2>
                <div className="mt-4 grid gap-3">
                  <input className="surface-input-soft" min="0.001" step="0.001" type="number" placeholder="Released quantity" value={releaseQuantity} onChange={(event) => setReleaseQuantity(event.target.value)} />
                  <textarea className="surface-input-soft min-h-20" placeholder="Release notes" value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} />
                  <Button type="submit" disabled={isPending('release')}>Release</Button>
                </div>
              </form>
            ) : null}

            {isReleased && canCloseOrder ? (
              <div className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4" />Close Order</h2>
                <div className="mt-4 grid gap-3">
                  <p className="text-sm text-[color:var(--app-muted)]">Closing locks the order until an authorized reopen action is performed.</p>
                  <Button
                    type="button"
                    disabled={Number(order.completed_quantity ?? 0) <= 0}
                    onClick={() => {
                      setActionError(null);
                      setCloseDialogOpen(true);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : null}

            {isClosed ? (
              <div className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-bg-subtle)] p-4 text-sm">
                <p>This order is locked. Corrections require a reversal or controlled reopening workflow.</p>
                {canReopenOrder ? (
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openCorrectionDialog({
                        documentNumber: String(order.production_order_number ?? 'Production Order'),
                        kind: 'reopen',
                      })}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reopen Order
                    </Button>
                  </div>
                ) : null}
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
          {isReleased && canPostIssue ? (
            <form className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4" onSubmit={submitIssue}>
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Factory className="h-4 w-4" />Issue Materials</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
                <input className="surface-input-soft" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
                <input className="surface-input-soft" placeholder="Issue remarks" value={issueRemarks} onChange={(event) => setIssueRemarks(event.target.value)} />
              </div>
              <div className="mt-4 space-y-2">
                {issueLines.map(({ component, remaining }) => (
                  <div key={String(component.id)} className="grid gap-2 rounded-lg bg-[color:var(--app-bg-subtle)] p-3 text-sm md:grid-cols-[1fr_140px_160px]">
                    <span>{String(component.component_number_snapshot)} {String(component.component_description_snapshot)}</span>
                    <span>Remaining {qty(remaining)}</span>
                    <input className="surface-input-soft" min="0" max={remaining} step="0.001" type="number" value={issueQuantities[String(component.id)] ?? String(remaining)} onChange={(event) => setIssueQuantities((current) => ({ ...current, [String(component.id)]: event.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={issueLines.length === 0 || isPending('issue') || isClosed}>Post Issue</Button>
              </div>
            </form>
          ) : null}

          {issues.length ? issues.map((issue) => (
            <DocumentCard
              key={String(issue.id)}
              action={(() => {
                const postingStatus = String(issue.posting_status ?? '');
                const issueId = String(issue.id ?? '');
                if (postingStatus === 'REVERSED') {
                  return <span className="text-xs text-[color:var(--app-muted)]">{String(issue.reversal_reason ?? 'Reversed')}</span>;
                }
                if (!canReverseIssue || postingStatus !== 'POSTED' || isClosed || !issueId) {
                  return <span className="text-xs text-[color:var(--app-muted)]">-</span>;
                }
                return (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending(`issue-reverse-${issueId}`)}
                    onClick={() => openCorrectionDialog({
                      documentId: issueId,
                      documentNumber: String(issue.issue_number ?? 'Production Issue'),
                      kind: 'issue',
                    })}
                  >
                    Reverse
                  </Button>
                );
              })()}
              creator={resolveUserDisplayName(issue.issued_by_user)}
              date={formatDate(issue.issue_date)}
              documentNumber={String(issue.issue_number ?? '')}
              lines={asRows(issue.lines).map((line) => ({
                itemCode: String(line.component_number_snapshot ?? ''),
                itemDescription: String(line.component_description_snapshot ?? ''),
                quantity: `Issued ${qty(line.current_issue_quantity)} / Total ${qty(line.total_issued_quantity)}`,
                secondary: `${line.batch_number ? `Batch ${String(line.batch_number)}` : 'Component issue line'}${line.expiry_date ? ` | Expiry ${formatDate(line.expiry_date)}` : ''}`,
                value: money(line.line_cost),
              }))}
              postingStatus={String(issue.posting_status ?? '')}
              quantityLabel="Quantity"
              quantityValue={qty(issue.total_quantity)}
              reversalReason={String(issue.reversal_reason ?? '')}
              title="Production Issue"
              warehouseName={String(asRecord(issue.production_warehouse)?.name ?? '')}
            />
          )) : (
            <EmptyState icon={<Factory className="h-6 w-6" />} title="No production issues" description="Posted issues will appear here." />
          )}
        </section>
      ) : null}

      {activeTab === 'Receipt from Production' ? (
        <section className="space-y-4">
          {isReleased && canPostReceipt ? (
            <form className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4" onSubmit={submitReceipt}>
              <h2 className="flex items-center gap-2 text-sm font-semibold"><PackageCheck className="h-4 w-4" />Receive Production</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <input className="surface-input-soft" placeholder="Completed quantity" type="number" min="0" step="0.001" value={receipt.completedQuantity} onChange={(event) => setReceipt((current) => ({ ...current, completedQuantity: event.target.value }))} />
                <input className="surface-input-soft" placeholder="Rejected quantity" type="number" min="0" step="0.001" value={receipt.rejectedQuantity} onChange={(event) => setReceipt((current) => ({ ...current, rejectedQuantity: event.target.value }))} />
                <input className="surface-input-soft" placeholder="Wastage quantity" type="number" min="0" step="0.001" value={receipt.wastageQuantity} onChange={(event) => setReceipt((current) => ({ ...current, wastageQuantity: event.target.value }))} />
                <input className="surface-input-soft" placeholder="Batch number" value={receipt.batchNumber} onChange={(event) => setReceipt((current) => ({ ...current, batchNumber: event.target.value }))} />
                <input className="surface-input-soft" type="date" value={receipt.receiptDate} onChange={(event) => setReceipt((current) => ({ ...current, receiptDate: event.target.value }))} />
                <input className="surface-input-soft" type="date" value={receipt.productionDate} onChange={(event) => setReceipt((current) => ({ ...current, productionDate: event.target.value }))} />
                <input className="surface-input-soft" type="date" value={receipt.expiryDate} onChange={(event) => setReceipt((current) => ({ ...current, expiryDate: event.target.value }))} />
                <input className="surface-input-soft md:col-span-2" placeholder="Receipt remarks" value={receipt.remarks} onChange={(event) => setReceipt((current) => ({ ...current, remarks: event.target.value }))} />
              </div>
              <div className="mt-4 flex justify-end"><Button type="submit" disabled={isPending('receipt') || isClosed}>Post Receipt</Button></div>
            </form>
          ) : null}

          {receipts.length ? receipts.map((receiptDocument) => (
            <DocumentCard
              key={String(receiptDocument.id)}
              action={(() => {
                const postingStatus = String(receiptDocument.posting_status ?? '');
                const receiptId = String(receiptDocument.id ?? '');
                if (postingStatus === 'REVERSED') {
                  return <span className="text-xs text-[color:var(--app-muted)]">{String(receiptDocument.reversal_reason ?? 'Reversed')}</span>;
                }
                if (!canReverseReceipt || postingStatus !== 'POSTED' || isClosed || !receiptId) {
                  return <span className="text-xs text-[color:var(--app-muted)]">-</span>;
                }
                return (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending(`receipt-reverse-${receiptId}`)}
                    onClick={() => openCorrectionDialog({
                      documentId: receiptId,
                      documentNumber: String(receiptDocument.receipt_number ?? 'Production Receipt'),
                      kind: 'receipt',
                    })}
                  >
                    Reverse
                  </Button>
                );
              })()}
              creator={resolveUserDisplayName(receiptDocument.received_by_user)}
              date={formatDate(receiptDocument.receipt_date)}
              documentNumber={String(receiptDocument.receipt_number ?? '')}
              lines={asRows(receiptDocument.lines).map((line) => ({
                itemCode: String(line.finished_product_number_snapshot ?? ''),
                itemDescription: String(line.finished_product_description_snapshot ?? ''),
                quantity: `Completed ${qty(line.current_completed_quantity)} / Rejected ${qty(line.current_rejected_quantity)} / Wastage ${qty(line.current_wastage_quantity)}`,
                secondary: `${line.batch_number ? `Batch ${String(line.batch_number)}` : 'Finished-goods receipt line'}${line.production_date ? ` | Production ${formatDate(line.production_date)}` : ''}${line.expiry_date ? ` | Expiry ${formatDate(line.expiry_date)}` : ''}`,
                value: money(line.total_production_cost),
              }))}
              postingStatus={String(receiptDocument.posting_status ?? '')}
              quantityLabel="Completed"
              quantityValue={qty(receiptDocument.total_completed_quantity)}
              reversalReason={String(receiptDocument.reversal_reason ?? '')}
              title="Production Receipt"
              warehouseName={String(asRecord(receiptDocument.finished_goods_warehouse)?.name ?? '')}
            />
          )) : (
            <EmptyState icon={<PackageCheck className="h-6 w-6" />} title="No production receipts" description="Posted receipts will appear here." />
          )}
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
                <p className="text-sm text-[color:var(--app-muted)]">
                  {String(node.document_type)}
                  <span aria-hidden="true"> - </span>
                  {String(node.document_date ?? '')}
                </p>
              </div>
              <StatusBadge status={String(node.status ?? node.posting_status ?? node.document_status ?? '')} />
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

      <ConfirmDialog
        title="Close production order"
        description={`Confirm closing ${String(order.production_order_number ?? 'this production order')}.`}
        open={closeDialogOpen}
        loading={isPending('close')}
        onCancel={closeCloseDialog}
        onConfirm={confirmClose}
        confirmLabel="Close Order"
        errorMessage={closeDialogOpen ? actionError : null}
      >
        <textarea
          className="surface-input-soft min-h-24 w-full"
          placeholder="Closing notes"
          value={closingNotes}
          onChange={(event) => setClosingNotes(event.target.value)}
        />
      </ConfirmDialog>

      <ConfirmDialog
        title={
          correctionDialog?.kind === 'reopen'
            ? 'Reopen production order'
            : correctionDialog?.kind === 'issue'
              ? 'Reverse production issue'
              : 'Reverse production receipt'
        }
        description={
          correctionDialog?.kind === 'reopen'
            ? `Reopen ${correctionDialog.documentNumber} to RELEASED without deleting posted history.`
            : `Confirm reversal for ${correctionDialog?.documentNumber ?? 'this document'}.`
        }
        open={Boolean(correctionDialog)}
        loading={Boolean(correctionPendingKey && isPending(correctionPendingKey))}
        onCancel={closeCorrectionDialog}
        onConfirm={confirmCorrection}
        confirmLabel={correctionDialog?.kind === 'reopen' ? 'Reopen Order' : 'Reverse'}
        confirmDisabled={!correctionReason.trim()}
        errorMessage={correctionDialog ? actionError : null}
      >
        <textarea
          className="surface-input-soft min-h-24 w-full"
          placeholder={correctionDialog?.kind === 'reopen' ? 'Reopen reason' : 'Reversal reason'}
          value={correctionReason}
          onChange={(event) => setCorrectionReason(event.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}

function DocumentCard({
  action,
  creator,
  date,
  documentNumber,
  lines,
  postingStatus,
  quantityLabel,
  quantityValue,
  reversalReason,
  title,
  warehouseName,
}: {
  action?: ReactNode;
  creator: string;
  date: string;
  documentNumber: string;
  lines: Array<{
    itemCode: string;
    itemDescription: string;
    quantity: string;
    secondary: string;
    value: string;
  }>;
  postingStatus: string;
  quantityLabel: string;
  quantityValue: string;
  reversalReason?: string;
  title: string;
  warehouseName: string;
}) {
  return (
    <article className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
      <div className="flex flex-col gap-3 border-b border-[color:var(--app-border)] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-base font-semibold text-[color:var(--app-accent-strong)]">{documentNumber}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={postingStatus} />
          {action}
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <MetaRow label="Document Date" value={date} />
        <MetaRow label={quantityLabel} value={quantityValue} />
        <MetaRow label="Warehouse" value={warehouseName} />
        <MetaRow label="Creator" value={creator || 'System'} />
        <MetaRow label="Reversal Status" value={postingStatus === 'REVERSED' ? 'Reversed' : 'Active'} />
        <MetaRow label="Reversal Reason" value={reversalReason || '-'} />
      </div>

      <div className="mt-4 space-y-2">
        {lines.map((line, index) => (
          <div key={`${line.itemCode}-${index}`} className="rounded-lg bg-[color:var(--app-bg-subtle)] p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-medium">{line.itemCode} {line.itemDescription}</p>
                <p className="mt-1 text-sm text-[color:var(--app-muted)]">{line.quantity}</p>
                <p className="text-sm text-[color:var(--app-muted)]">{line.secondary}</p>
              </div>
              <p className="text-sm font-medium">{line.value}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-[color:var(--app-muted)]">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
