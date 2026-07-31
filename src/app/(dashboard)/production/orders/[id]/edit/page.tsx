'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useParams } from 'next/navigation';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { ProductionOrderPlanningForm } from '@/components/production/production-order-planning-form';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui-library';
import { useProductionOrder } from '@/hooks/production/useProductionOrders';

function hasPostedDocuments(documents: Array<Record<string, unknown>>) {
  return documents.some((document) => {
    const postingStatus = String(document.posting_status ?? '').toUpperCase();
    return postingStatus === 'POSTED' || postingStatus === 'REVERSED';
  });
}

export default function EditProductionOrderPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detailQuery = useProductionOrder(id);

  if (detailQuery.isLoading) return <LoadingState />;
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Production order unavailable"
        description={detailQuery.error?.message ?? 'No order data was returned.'}
      />
    );
  }

  const order = detailQuery.data.order ?? {};
  const orderStatus = String(order.status ?? '').toUpperCase();
  const documentsExist = hasPostedDocuments(detailQuery.data.issues ?? []) || hasPostedDocuments(detailQuery.data.receipts ?? []);
  const canEdit = orderStatus === 'PLANNED' && !documentsExist;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${String(order.production_order_number ?? 'Production Order')}`}
        description="Only PLANNED production orders can be updated. Saving recalculates components from the latest active BOM."
        actions={(
          <Button asChild size="sm" variant="outline">
            <Link href={`/production/orders/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Order
            </Link>
          </Button>
        )}
      />
      <ProductionNav />

      {!canEdit ? (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {documentsExist
            ? 'Editing is blocked because issue or receipt documents already exist for this order.'
            : `This order is ${orderStatus || 'not editable'} and is read-only.`}
        </div>
      ) : null}

      {canEdit ? (
        <ProductionOrderPlanningForm
          existingOrder={order}
          hasPostedDocuments={documentsExist}
          mode="edit"
          orderId={id}
        />
      ) : null}
    </div>
  );
}
