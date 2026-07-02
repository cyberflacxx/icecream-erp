'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, Send, Truck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { EmptyState, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { Button } from '@/components/ui/button';
import {
  formatPurchaseOrderStatusLabel,
  isPurchaseOrderApprovable,
  isPurchaseOrderRejectable,
  isPurchaseOrderSentLike,
  normalizePurchaseOrderStatus,
} from '@/lib/procurement-purchase-orders';
import { useProcurementRequest, usePurchaseOrder } from '@/hooks/procurement';
import { usePermission } from '@/hooks/usePermission';

interface PurchaseOrderDetailPageProps {
  params: {
    id: string;
  };
}

interface PurchaseOrderDetail {
  id: string;
  poNumber: string;
  supplier: {
    id: string;
    name: string;
  };
  orderDate: string;
  expectedDeliveryDate: string | null;
  status: string;
  approvedAt: string | null;
  sentAt: string | null;
  rejectedAt: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  items: Array<{
    id: string;
    item: {
      code: string;
      name: string;
    };
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number;
    totalCost: number;
    unitOfMeasure: {
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

interface FeedbackState {
  message: string;
  tone: 'error' | 'success';
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency'
});

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
    'border border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-600 hover:bg-sky-600 hover:text-white'
} as const;

export default function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  const canApprove = usePermission([PERMISSIONS.purchaseOrder.approve, 'procurement.approve']);
  const canSend = usePermission([PERMISSIONS.purchaseOrder.create, 'procurement.write']);
  const request = useProcurementRequest();
  const queryClient = useQueryClient();
  const orderQuery = usePurchaseOrder(params.id);
  const order = orderQuery.data as PurchaseOrderDetail | undefined;
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['procurement']
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
        tone: 'error'
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function approve() {
    await runAction('approve', 'Purchase order approved.', async () => {
      await request(`/api/procurement/purchase-orders/${params.id}/approve`, {
        body: JSON.stringify({}),
        method: 'POST'
      });
      await refresh();
    });
  }

  async function send() {
    await runAction('send', 'Purchase order sent to supplier.', async () => {
      await request(`/api/procurement/purchase-orders/${params.id}/send`, {
        body: JSON.stringify({}),
        method: 'POST'
      });
      await refresh();
    });
  }

  async function reject() {
    await runAction('reject', 'Purchase order rejected.', async () => {
      await request(`/api/procurement/purchase-orders/${params.id}/reject`, {
        body: JSON.stringify({}),
        method: 'POST'
      });
      await refresh();
    });
  }

  const normalizedStatus = normalizePurchaseOrderStatus(order?.status ?? '');

  return (
    <div className="space-y-6">
      <PageHeader
        title={order ? `Purchase Order ${order.poNumber}` : 'Purchase Order Detail'}
        description="Compact review of supplier terms, line values, and receiving progress."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/procurement/purchase-orders">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Orders
              </Link>
            </Button>

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
                {pendingAction === 'send' ? 'Sending...' : 'Send to Supplier'}
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
              <Button asChild size="sm" variant="outline">
                <a href={`/api/procurement/purchase-orders/${params.id}/pdf`} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Print / Save PDF
                </a>
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
                <p className="text-sm text-muted">{order.supplier.name}</p>
              </div>

              <div className="rounded-3xl border border-border/70 bg-white/80 px-5 py-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Total Order Value</p>
                <p className="mt-3 text-3xl font-semibold text-brown">
                  {currencyFormatter.format(order.total)}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <DetailCard
                label="Order Date"
                value={new Date(order.orderDate).toLocaleDateString()}
              />
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
          </section>

          <section className="surface-card overflow-hidden p-0">
            <div className="border-b border-border/70 px-5 py-4">
              <h3 className="text-lg font-semibold text-brown">Line Items</h3>
              <p className="mt-1 text-sm text-muted">Compact commercial view for supplier order review.</p>
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
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted">Unit Cost</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {order.items.map((item) => (
                      <tr key={item.id} className="bg-white/75">
                        <td className="px-5 py-4 text-sm text-brown">
                          <div className="font-medium">{item.item.name}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">{item.item.code}</div>
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
