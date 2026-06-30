'use client';

import { type FormEvent, useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState } from '@/components/ui-library';
import { useBranchReturns, useBranchStock, useCreateBranchReturn } from '@/hooks/branch-operations';

export default function BranchReturnsPage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const query = useBranchReturns(branchId);
  const stockQuery = useBranchStock(branchId, { page: 1, pageSize: 100 });
  const createReturn = useCreateBranchReturn(branchId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [itemId, setItemId] = useState('');
  const [quantityReturned, setQuantityReturned] = useState('1');
  const [returnReason, setReturnReason] = useState('');
  const [goodsReturnVoucherNumber, setGoodsReturnVoucherNumber] = useState('');
  const [finalAction, setFinalAction] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createReturn.mutateAsync({
        finalAction: finalAction || undefined,
        goodsReturnVoucherNumber: goodsReturnVoucherNumber || undefined,
        itemId,
        quantityReturned: Number(quantityReturned),
        returnReason,
      });
      setDrawerOpen(false);
      setItemId('');
      setQuantityReturned('1');
      setReturnReason('');
      setGoodsReturnVoucherNumber('');
      setFinalAction('');
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save branch return.');
    }
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Branch returns unavailable" description={query.error?.message ?? 'No branch returns returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Branch Returns"
        description="Capture goods returned at the branch and track QC status and final stock action."
        actions={
          <Button type="button" size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record Return
          </Button>
        }
      />
      <BranchOperationsNav branchId={branchId} />
      <DataTable
        columns={[
          { key: 'return_number', header: 'Return #' },
          { key: 'quantity_returned', header: 'Quantity' },
          { key: 'return_reason', header: 'Reason' },
          { key: 'qc_status', header: 'QC Status' },
          { key: 'final_action', header: 'Final Action', render: (row) => row.final_action ?? 'Pending' },
          { key: 'status', header: 'Status' },
        ]}
        data={query.data}
      />

      <FormDrawer title="Record Goods Returned" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <label className="space-y-2 text-sm text-muted">
            <span>Returned Item</span>
            <select
              required
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
              className="surface-input-soft"
            >
              <option value="">Select item</option>
              {(stockQuery.data?.data ?? []).map((row) => (
                <option key={row.item.id} value={row.item.id}>
                  {row.item.code} - {row.item.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Quantity Returned</span>
              <input
                required
                min="0.001"
                step="0.001"
                type="number"
                value={quantityReturned}
                onChange={(event) => setQuantityReturned(event.target.value)}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Goods Return Voucher</span>
              <input
                value={goodsReturnVoucherNumber}
                onChange={(event) => setGoodsReturnVoucherNumber(event.target.value)}
                className="surface-input-soft"
                placeholder="Optional GRV number"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Final Action</span>
            <select
              value={finalAction}
              onChange={(event) => setFinalAction(event.target.value)}
              className="surface-input-soft"
            >
              <option value="">Pending QC decision</option>
              <option value="RETURN_TO_STOCK">Return to stock</option>
              <option value="REWORK">Rework</option>
              <option value="SCRAP">Scrap</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-muted">
            <span>Return Reason</span>
            <textarea
              required
              rows={3}
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              className="surface-textarea-soft"
              placeholder="Reason for the returned goods"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createReturn.isPending || stockQuery.isLoading}>
              {createReturn.isPending ? 'Saving...' : 'Save Return'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
