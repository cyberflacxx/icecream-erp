'use client';

import { Download } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { DataTable, EmptyState, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { Button } from '@/components/ui/button';
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
    };
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

export default function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  const canApprove = usePermission(PERMISSIONS.purchaseOrder.approve);
  const request = useProcurementRequest();
  const queryClient = useQueryClient();
  const orderQuery = usePurchaseOrder(params.id);
  const order = orderQuery.data as PurchaseOrderDetail | undefined;

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['procurement']
    });
  }

  async function approve() {
    await request(`/api/procurement/purchase-orders/${params.id}/approve`, {
      body: JSON.stringify({}),
      method: 'POST'
    });
    await refresh();
  }

  async function send() {
    await request(`/api/procurement/purchase-orders/${params.id}/send`, {
      body: JSON.stringify({}),
      method: 'POST'
    });
    await refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={order ? `Purchase Order ${order.poNumber}` : 'Purchase Order Detail'}
        description="Review order header details, line items, and linked goods received notes."
        actions={
          <div className="flex gap-3">
            {canApprove ? (
              <Button size="sm" variant="outline" onClick={approve}>
                Approve
              </Button>
            ) : null}
            {canApprove ? (
              <Button size="sm" variant="outline" onClick={send}>
                Send
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <a href={`/api/procurement/purchase-orders/${params.id}/pdf`} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </a>
            </Button>
          </div>
        }
      />

      <ProcurementNav />

      {order ? (
        <>
          <div className="grid gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Supplier</p>
              <p className="mt-2 text-sm font-semibold text-brown">{order.supplier.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Order Date</p>
              <p className="mt-2 text-sm font-semibold text-brown">
                {new Date(order.orderDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Expected Delivery</p>
              <p className="mt-2 text-sm font-semibold text-brown">
                {order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Status</p>
              <div className="mt-2">
                <StatusBadge status={order.status} />
              </div>
            </div>
          </div>

          <DataTable<Record<string, unknown>>
            data={order.items as unknown as Record<string, unknown>[]}
            columns={[
              {
                key: 'item',
                header: 'Item',
                render: (row) => {
                  const item = row.item as { code: string; name: string };
                  return `${item.code} - ${item.name}`;
                }
              },
              { key: 'quantityOrdered', header: 'Qty Ordered' },
              { key: 'quantityReceived', header: 'Qty Received' },
              {
                key: 'unitOfMeasure',
                header: 'UOM',
                render: (row) => String((row.unitOfMeasure as { abbreviation: string })?.abbreviation ?? '-')
              },
              { key: 'unitCost', header: 'Unit Cost' },
              { key: 'totalCost', header: 'Total Cost' }
            ]}
            emptyState={
              <EmptyState
                icon={<Download className="h-6 w-6" />}
                title="No line items"
                description="This purchase order does not have line items yet."
              />
            }
          />

          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-brown">Goods Received Notes</h2>
            <div className="mt-4 space-y-3">
              {order.grns.length ? (
                order.grns.map((grn) => (
                  <div key={grn.id} className="rounded-2xl bg-cream px-4 py-3">
                    <p className="font-medium text-brown">{grn.grnNumber}</p>
                    <p className="mt-1 text-sm text-muted">
                      {new Date(grn.receivedDate).toLocaleDateString()} | {grn.itemsCount} items | {grn.status}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No GRNs recorded for this purchase order yet.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
