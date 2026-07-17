'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, Minus, Plus, Send, Truck, XCircle } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { EmptyState, FormDrawer, StatusBadge } from '@/components/ui-library';
import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { SupplierSelect } from '@/components/procurement/supplier-select';
import { Button } from '@/components/ui/button';
import { useProcurementMeta, useProcurementRequest, usePurchaseOrder } from '@/hooks/procurement';
import { downloadFromUrl } from '@/lib/export';
import { API_ROUTES, PERMISSIONS } from '@/lib/shared';
import {
  buildPurchaseOrderDraftPayload,
  formatPurchaseOrderStatusLabel,
  isPurchaseOrderApprovable,
  isPurchaseOrderRejectable,
  isPurchaseOrderSentLike,
  normalizePurchaseOrderStatus,
} from '@/lib/procurement-purchase-orders';
import { usePermission } from '@/hooks/usePermission';

interface PurchaseOrderDetailPageProps {
  params: {
    id: string;
  };
}

interface PurchaseOrderDetail {
  id: string;
  poNumber: string;
  supplierId: string | null;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  requisitionId: string | null;
  approverUserId: string | null;
  approvedBy: string | null;
  orderDate: string;
  expectedDeliveryDate: string | null;
  status: string;
  approvedAt: string | null;
  sentAt: string | null;
  rejectedAt: string | null;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  items: Array<{
    id: string;
    item: {
      id: string;
      code: string;
      name: string;
    } | null;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number;
    totalCost: number;
    unitOfMeasure: {
      id: string;
      abbreviation: string;
      name: string;
    } | null;
  }>;
  grns: Array<{
    id: string;
    grnNumber: string;
    receivedDate: string;
    status: string;
    qualityStatus: string;
    itemsCount: number;
  }>;
}

type EditLine = {
  rowId: string;
  itemId: string;
  quantityOrdered: string;
  unitCost: string;
  unitOfMeasureId: string;
};

type EditFormState = {
  approverUserId: string;
  discountAmount: string;
  expectedDeliveryDate: string;
  items: EditLine[];
  notes: string;
  orderDate: string;
  supplierId: string;
  taxAmount: string;
};

interface FeedbackState {
  message: string;
  tone: 'error' | 'success';
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency',
});

function createLineDraft(): EditLine {
  return {
    itemId: '',
    quantityOrdered: '1',
    rowId:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `po-edit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    unitCost: '0',
    unitOfMeasureId: '',
  };
}

function statusVariant(status: string) {
  const normalized = normalizePurchaseOrderStatus(status);

  if (normalized === 'FULLY_RECEIVED') return 'success' as const;
  if (normalized === 'PARTIAL_RECEIVED') return 'warning' as const;
  if (normalized === 'REJECTED' || normalized === 'CANCELLED') return 'error' as const;
  if (normalized === 'APPROVED' || normalized === 'SENT_TO_SUPPLIER') return 'info' as const;

  return 'neutral' as const;
}

const actionButtonClassNames = {
  approve:
    'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white',
  reject:
    'border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-600 hover:bg-rose-600 hover:text-white',
  send:
    'border border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-600 hover:bg-sky-600 hover:text-white',
} as const;

function createEditState(order: PurchaseOrderDetail): EditFormState {
  return {
    approverUserId: order.approverUserId ?? '',
    discountAmount: String(order.discountAmount ?? 0),
    expectedDeliveryDate: order.expectedDeliveryDate ? String(order.expectedDeliveryDate).slice(0, 10) : '',
    items:
      order.items.length > 0
        ? order.items.map((item) => ({
            rowId: item.id,
            itemId: item.item?.id ?? '',
            quantityOrdered: String(item.quantityOrdered ?? 1),
            unitCost: String(item.unitCost ?? 0),
            unitOfMeasureId: item.unitOfMeasure?.id ?? '',
          }))
        : [createLineDraft()],
    notes: order.notes ?? '',
    orderDate: order.orderDate ? String(order.orderDate).slice(0, 10) : '',
    supplierId: order.supplierId ?? order.supplier?.id ?? '',
    taxAmount: String(order.taxAmount ?? 0),
  };
}

export default function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  const canApprove = usePermission([PERMISSIONS.purchaseOrder.approve, 'procurement.approve']);
  const canSend = usePermission([PERMISSIONS.purchaseOrder.create, 'procurement.write']);
  const canEdit = usePermission([PERMISSIONS.purchaseOrder.create, 'procurement.write']);
  const request = useProcurementRequest();
  const queryClient = useQueryClient();
  const orderQuery = usePurchaseOrder(params.id);
  const metaQuery = useProcurementMeta();
  const order = orderQuery.data as PurchaseOrderDetail | undefined;
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isDownloadingDocument, setIsDownloadingDocument] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<EditFormState | null>(null);

  useEffect(() => {
    if (!order) return;
    setFormState((current) => (current && isEditOpen ? current : createEditState(order)));
  }, [isEditOpen, order]);

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['procurement'],
    });
  }

  async function runAction(actionKey: string, successMessage: string, task: () => Promise<void>) {
    setPendingAction(actionKey);
    setFeedback(null);

    try {
      await task();
      setFeedback({ message: successMessage, tone: 'success' });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Purchase order action failed.',
        tone: 'error',
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function approve() {
    await runAction('approve', 'Purchase order approved.', async () => {
      await request(`${API_ROUTES.PROCUREMENT.PURCHASE_ORDER(params.id)}/approve`, {
        body: JSON.stringify({}),
        method: 'POST',
      });
      await refresh();
    });
  }

  async function send() {
    await runAction('send', 'Purchase order emailed to supplier and marked as sent.', async () => {
      await request(`${API_ROUTES.PROCUREMENT.PURCHASE_ORDER(params.id)}/send`, {
        body: JSON.stringify({}),
        method: 'POST',
      });
      await refresh();
    });
  }

  async function reject() {
    const remarks = window.prompt('Reason for rejecting this purchase order:', 'Rejected from purchase order review.');
    if (remarks === null) return;

    await runAction('reject', 'Purchase order rejected.', async () => {
      await request(`${API_ROUTES.PROCUREMENT.PURCHASE_ORDER(params.id)}/reject`, {
        body: JSON.stringify({ remarks }),
        method: 'POST',
      });
      await refresh();
    });
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formState) return;

    const items = formState.items
      .filter((item) => item.itemId && item.unitOfMeasureId)
      .map((item) => ({
        itemId: item.itemId,
        quantityOrdered: Number(item.quantityOrdered),
        unitCost: Number(item.unitCost),
        unitOfMeasureId: item.unitOfMeasureId,
      }));

    if (!formState.supplierId || !items.length) {
      setFormError('Supplier and at least one complete line item are required.');
      return;
    }

    if (
      items.some(
        (item) =>
          Number.isNaN(item.quantityOrdered) ||
          Number.isNaN(item.unitCost) ||
          item.quantityOrdered <= 0 ||
          item.unitCost < 0,
      )
    ) {
      setFormError('Quantities must be above zero and prices cannot be negative.');
      return;
    }

    try {
      await request(API_ROUTES.PROCUREMENT.PURCHASE_ORDER(params.id), {
        body: JSON.stringify(buildPurchaseOrderDraftPayload({
          approverUserId: formState.approverUserId || null,
          discountAmount: Number(formState.discountAmount || 0),
          expectedDeliveryDate: formState.expectedDeliveryDate || null,
          items,
          notes: formState.notes || null,
          orderDate: formState.orderDate || null,
          supplierId: formState.supplierId,
          supplier_id: formState.supplierId,
          taxAmount: Number(formState.taxAmount || 0),
        })),
        method: 'PATCH',
      });

      setFormError(null);
      setIsEditOpen(false);
      setFeedback({ message: 'Purchase order draft updated.', tone: 'success' });
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update purchase order draft.');
    }
  }

  async function downloadPurchaseOrderDocument() {
    setIsDownloadingDocument(true);
    setFeedback(null);

    try {
      await downloadFromUrl(`/api/procurement/purchase-orders/${params.id}/pdf`, {
        filename: `purchase-order-${order?.poNumber ?? params.id}.pdf`,
      });
      setFeedback({ message: 'Purchase order PDF downloaded.', tone: 'success' });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Failed to download purchase order PDF.',
        tone: 'error',
      });
    } finally {
      setIsDownloadingDocument(false);
    }
  }

  function appendLineItem() {
    setFormState((current) =>
      current
        ? {
            ...current,
            items: [...current.items, createLineDraft()],
          }
        : current,
    );
  }

  function updateLineItem(rowId: string, field: keyof Omit<EditLine, 'rowId'>, value: string) {
    setFormState((current) =>
      current
        ? {
            ...current,
            items: current.items.map((row) => {
              if (row.rowId !== rowId) return row;

              if (field === 'itemId') {
                const matchedItem = (metaQuery.data?.items ?? []).find((item) => item.id === value);
                return {
                  ...row,
                  itemId: value,
                  unitOfMeasureId: row.unitOfMeasureId || matchedItem?.unitOfMeasureId || '',
                };
              }

              return {
                ...row,
                [field]: value,
              };
            }),
          }
        : current,
    );
  }

  function stepNumericField(rowId: string, field: 'quantityOrdered' | 'unitCost', delta: number, minimum: number, precision: number) {
    setFormState((current) =>
      current
        ? {
            ...current,
            items: current.items.map((row) => {
              if (row.rowId !== rowId) return row;
              const nextValue = Math.max(minimum, Number(row[field] || 0) + delta);
              return {
                ...row,
                [field]: nextValue.toFixed(precision),
              };
            }),
          }
        : current,
    );
  }

  function removeLineItem(rowId: string) {
    setFormState((current) =>
      current
        ? {
            ...current,
            items: current.items.length === 1 ? current.items : current.items.filter((row) => row.rowId !== rowId),
          }
        : current,
    );
  }

  const normalizedStatus = normalizePurchaseOrderStatus(order?.status ?? '');

  return (
    <div className="space-y-6">
      <PageHeader
        title={order ? `Purchase Order ${order.poNumber}` : 'Purchase Order Detail'}
        description="Review supplier-facing pricing, dispatch status, and receiving progress from one focused workspace."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/procurement/purchase-orders">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Orders
              </Link>
            </Button>

            {order && isPurchaseOrderApprovable(normalizedStatus) && canEdit ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFormState(createEditState(order));
                  setIsEditOpen(true);
                }}
              >
                Edit Draft
              </Button>
            ) : null}

            {order && isPurchaseOrderApprovable(normalizedStatus) && canApprove ? (
              <Button
                size="sm"
                variant="outline"
                className={actionButtonClassNames.approve}
                disabled={pendingAction === 'approve'}
                onClick={approve}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {pendingAction === 'approve' ? 'Approving...' : 'Approve'}
              </Button>
            ) : null}

            {order && normalizedStatus === 'APPROVED' && canSend ? (
              <Button
                size="sm"
                variant="outline"
                className={actionButtonClassNames.send}
                disabled={pendingAction === 'send'}
                onClick={send}
              >
                <Send className="mr-2 h-4 w-4" />
                {pendingAction === 'send' ? 'Emailing...' : 'Email Supplier'}
              </Button>
            ) : null}

            {order && isPurchaseOrderRejectable(normalizedStatus) && canApprove ? (
              <Button
                size="sm"
                variant="outline"
                className={actionButtonClassNames.reject}
                disabled={pendingAction === 'reject'}
                onClick={reject}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {pendingAction === 'reject' ? 'Rejecting...' : 'Reject'}
              </Button>
            ) : null}

            {order ? (
              <Button size="sm" variant="outline" disabled={isDownloadingDocument} onClick={downloadPurchaseOrderDocument}>
                <Download className="mr-2 h-4 w-4" />
                {isDownloadingDocument ? 'Downloading PO...' : 'Print / Save PO'}
              </Button>
            ) : null}
          </div>
        }
      />

      <ProcurementNav />

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

      {order ? (
        <>
          <section className="surface-card bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,232,0.9))]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-brown">{order.poNumber}</h2>
                  <StatusBadge
                    status={formatPurchaseOrderStatusLabel(order.status)}
                    variant={statusVariant(order.status)}
                  />
                </div>
                <div className="space-y-1 text-sm text-muted">
                  <p>{order.supplier?.name ?? 'Supplier not linked'}</p>
                  {order.supplier?.email ? <p>{order.supplier.email}</p> : null}
                  {order.supplier?.phone ? <p>{order.supplier.phone}</p> : null}
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-white/80 px-5 py-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Total Order Value</p>
                <p className="mt-3 text-3xl font-semibold text-brown">
                  {currencyFormatter.format(order.total)}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <DetailCard label="Order Date" value={new Date(order.orderDate).toLocaleDateString()} />
              <DetailCard
                label="Expected Delivery"
                value={order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : 'Not scheduled'}
              />
              <DetailCard
                label="Approval Date"
                value={order.approvedAt ? new Date(order.approvedAt).toLocaleDateString() : 'Pending'}
              />
              <DetailCard
                label="Dispatch Status"
                value={
                  order.sentAt
                    ? `Sent ${new Date(order.sentAt).toLocaleDateString()}`
                    : isPurchaseOrderSentLike(order.status)
                      ? 'Sent'
                      : 'Not sent yet'
                }
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MoneyCard label="Subtotal" value={order.subtotal} />
              <MoneyCard label="Tax" value={order.taxAmount} />
              <MoneyCard label="Discount" value={order.discountAmount} />
            </div>

            {order.notes ? (
              <div className="mt-6 rounded-2xl border border-border/70 bg-white/80 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Procurement Notes</p>
                <p className="mt-2 text-sm leading-6 text-brown">{order.notes}</p>
              </div>
            ) : null}
          </section>

          <section className="surface-card overflow-hidden p-0">
            <div className="border-b border-border/70 px-5 py-4">
              <h3 className="text-lg font-semibold text-brown">Line Items</h3>
              <p className="mt-1 text-sm text-muted">Supplier-facing commercial view with raw material pricing included.</p>
            </div>

            {order.items.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-cream/70">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted">Item</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted">Qty Ordered</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted">Qty Received</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted">UOM</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted">Unit Price</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {order.items.map((item) => (
                      <tr key={item.id} className="bg-white/75">
                        <td className="px-5 py-4 text-sm text-brown">
                          <div className="font-medium">{item.item?.name ?? 'Unknown item'}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">{item.item?.code ?? '-'}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-brown">{item.quantityOrdered}</td>
                        <td className="px-5 py-4 text-sm text-brown">{item.quantityReceived}</td>
                        <td className="px-5 py-4 text-sm text-brown">{item.unitOfMeasure?.abbreviation ?? '-'}</td>
                        <td className="px-5 py-4 text-sm text-brown">{currencyFormatter.format(item.unitCost)}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-brown">{currencyFormatter.format(item.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={<Download className="h-6 w-6" />}
                  title="No line items"
                  description="This purchase order does not have line items yet."
                />
              </div>
            )}
          </section>

          <section className="surface-card">
            <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-brown">Goods Received Notes</h3>
                <p className="mt-1 text-sm text-muted">Track receiving documents linked to this purchase order.</p>
              </div>
              {isPurchaseOrderSentLike(order.status) ? (
                <Button asChild size="sm" variant="outline" className={actionButtonClassNames.send}>
                  <Link href={`/procurement/goods-received?purchaseOrderId=${order.id}`}>
                    <Truck className="mr-2 h-4 w-4" />
                    Record GRN
                  </Link>
                </Button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {order.grns.length ? (
                order.grns.map((grn) => (
                  <div
                    key={grn.id}
                    className="surface-tile flex flex-col gap-3 border border-border/60 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-brown">{grn.grnNumber}</p>
                      <p className="mt-1 text-sm text-muted">
                        {new Date(grn.receivedDate).toLocaleDateString()} - {grn.itemsCount} items
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={formatPurchaseOrderStatusLabel(grn.status)} variant={statusVariant(grn.status)} />
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        {formatPurchaseOrderStatusLabel(grn.qualityStatus)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No GRNs recorded for this purchase order yet.</p>
              )}
            </div>
          </section>
        </>
      ) : null}

      <FormDrawer title="Edit Purchase Order Draft" open={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <form className="space-y-6" onSubmit={saveDraft}>
          {formError ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}

          {formState ? (
            <>
              <div className="rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,232,0.88))] p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-muted">
                    <span>Supplier</span>
                    <SupplierSelect
                      required
                      value={formState.supplierId}
                      onChange={(supplierId) =>
                        setFormState((current) => (current ? { ...current, supplierId } : current))
                      }
                    />
                  </label>

                  <label className="space-y-2 text-sm text-muted">
                    <span>Approver</span>
                    <select
                      value={formState.approverUserId}
                      onChange={(event) =>
                        setFormState((current) => (current ? { ...current, approverUserId: event.target.value } : current))
                      }
                      className="surface-input-soft"
                    >
                      <option value="">Auto route to supervisor</option>
                      {(metaQuery.data?.approvers ?? []).map((approver) => (
                        <option key={approver.id} value={approver.id}>
                          {approver.fullName}
                          {approver.role ? ` (${approver.role.replace(/_/g, ' ')})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm text-muted">
                    <span>Order Date</span>
                    <input
                      type="date"
                      value={formState.orderDate}
                      onChange={(event) =>
                        setFormState((current) => (current ? { ...current, orderDate: event.target.value } : current))
                      }
                      className="surface-input-soft"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-muted">
                    <span>Expected Delivery</span>
                    <input
                      type="date"
                      value={formState.expectedDeliveryDate}
                      onChange={(event) =>
                        setFormState((current) =>
                          current ? { ...current, expectedDeliveryDate: event.target.value } : current,
                        )
                      }
                      className="surface-input-soft"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-muted">
                    <span>Tax Amount</span>
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={formState.taxAmount}
                      onChange={(event) =>
                        setFormState((current) => (current ? { ...current, taxAmount: event.target.value } : current))
                      }
                      className="surface-input-soft"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-muted">
                    <span>Discount Amount</span>
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={formState.discountAmount}
                      onChange={(event) =>
                        setFormState((current) =>
                          current ? { ...current, discountAmount: event.target.value } : current,
                        )
                      }
                      className="surface-input-soft"
                    />
                  </label>
                </div>
              </div>

              <label className="space-y-2 text-sm text-muted">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((current) => (current ? { ...current, notes: event.target.value } : current))
                  }
                  className="surface-textarea-soft"
                  placeholder="Supplier instructions, delivery notes, or approval context"
                />
              </label>

              <section className="rounded-3xl border border-border/70 bg-white/75 p-4 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Line Items</p>
                    <p className="mt-1 text-sm text-muted">
                      Use the plus and minus controls for quantity and pricing tweaks while the PO is still a draft.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={appendLineItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                <div className="mt-3 space-y-3">
                  {formState.items.map((item) => (
                    <div
                      key={item.rowId}
                      className="rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,232,0.82))] p-4"
                    >
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_160px_160px_140px_110px]">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Item</label>
                          <select
                            value={item.itemId}
                            onChange={(event) => updateLineItem(item.rowId, 'itemId', event.target.value)}
                            className="surface-input-soft"
                          >
                            <option value="">Select item</option>
                            {(metaQuery.data?.items ?? []).map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.code} - {row.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Quantity</label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => stepNumericField(item.rowId, 'quantityOrdered', -1, 1, 0)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <input
                              min="1"
                              step="1"
                              type="number"
                              value={item.quantityOrdered}
                              onChange={(event) => updateLineItem(item.rowId, 'quantityOrdered', event.target.value)}
                              className="surface-input-soft text-center"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => stepNumericField(item.rowId, 'quantityOrdered', 1, 1, 0)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Unit Price</label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => stepNumericField(item.rowId, 'unitCost', -0.5, 0, 2)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <input
                              min="0"
                              step="0.01"
                              type="number"
                              value={item.unitCost}
                              onChange={(event) => updateLineItem(item.rowId, 'unitCost', event.target.value)}
                              className="surface-input-soft text-center"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => stepNumericField(item.rowId, 'unitCost', 0.5, 0, 2)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">UOM</label>
                          <select
                            value={item.unitOfMeasureId}
                            onChange={(event) => updateLineItem(item.rowId, 'unitOfMeasureId', event.target.value)}
                            className="surface-input-soft"
                          >
                            <option value="">UOM</option>
                            {(metaQuery.data?.units ?? []).map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.abbreviation}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            className={`w-full ${actionButtonClassNames.reject}`}
                            onClick={() => removeLineItem(item.rowId)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Draft Changes</Button>
              </div>
            </>
          ) : null}
        </form>
      </FormDrawer>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-brown">{value}</p>
    </div>
  );
}

function MoneyCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-brown">{currencyFormatter.format(value)}</p>
    </div>
  );
}
