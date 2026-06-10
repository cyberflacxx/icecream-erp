'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, ShoppingBasket } from 'lucide-react';

import { DataTable, EmptyState, FilterBar, FormDrawer } from '@/components/ui-library';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { Button } from '@/components/ui/button';
import {
  useBranchSales,
  useBranchStock,
  useCreateBranchExpense,
  useCreateBranchSale
} from '@/hooks/branch-operations';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency'
});

interface SaleLineItem {
  itemId: string;
  quantity: string;
  unitPrice: string;
}

const initialSaleLine: SaleLineItem = {
  itemId: '',
  quantity: '1',
  unitPrice: '0'
};

function formatToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function BranchSalesPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const branchId = params.id;
  const showStock = searchParams.get('view') === 'stock';
  const [filters, setFilters] = useState({
    endDate: formatToday(),
    page: 1,
    pageSize: 10,
    paymentMethod: '',
    shift: '',
    startDate: formatToday()
  });
  const [saleDrawerOpen, setSaleDrawerOpen] = useState(false);
  const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(searchParams.get('expense') === 'true');
  const [saleError, setSaleError] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>('DAY');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ECOCASH' | 'CARD'>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [saleItems, setSaleItems] = useState<SaleLineItem[]>([initialSaleLine]);
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('0');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'CASH' | 'ECOCASH' | 'CARD'>('CASH');

  const salesQuery = useBranchSales(branchId, filters);
  const stockQuery = useBranchStock(branchId, {
    page: 1,
    pageSize: 100
  });
  const createSale = useCreateBranchSale(branchId);
  const createExpense = useCreateBranchExpense(branchId);
  const stockRows = stockQuery.data?.data ?? [];
  const stockOptions = stockRows.filter(
    (row) => row.item.itemType === 'FINISHED_GOOD' && row.quantityAvailable > 0,
  );
  const sales = salesQuery.data?.data ?? [];
  const pagination = salesQuery.data?.pagination;
  const grandTotal = useMemo(
    () =>
      saleItems.reduce((sum, item) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;

        return sum + quantity * unitPrice;
      }, 0),
    [saleItems],
  );

  async function handleSaleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedItems = saleItems
      .filter((row) => row.itemId && Number(row.quantity) > 0)
      .map((row) => {
        const quantity = Number(row.quantity);
        const unitPrice = Number(row.unitPrice);

        return {
          itemId: row.itemId,
          quantity,
          totalPrice: quantity * unitPrice,
          unitPrice
        };
      });

    if (!normalizedItems.length) {
      setSaleError('At least one valid line item is required.');
      return;
    }

    try {
      await createSale.mutateAsync({
        items: normalizedItems,
        paymentMethod,
        paymentReference: paymentReference || null,
        saleDate: formatToday(),
        shift
      });
      setSaleDrawerOpen(false);
      setSaleItems([initialSaleLine]);
      setSaleError(null);
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : 'Failed to save branch sale.');
    }
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createExpense.mutateAsync({
        amount: Number(expenseAmount),
        category: expenseCategory,
        description: expenseDescription,
        expenseDate: formatToday(),
        paymentMethod: expensePaymentMethod
      });
      setExpenseDrawerOpen(false);
      setExpenseCategory('');
      setExpenseDescription('');
      setExpenseAmount('0');
      setExpenseError(null);
    } catch (error) {
      setExpenseError(error instanceof Error ? error.message : 'Failed to save branch expense.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Sales"
        description="Record shift sales and track branch transaction performance in real time."
        actions={
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setExpenseDrawerOpen(true)}>
              Record Expense
            </Button>
            <Button type="button" size="sm" onClick={() => setSaleDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Record Sale
            </Button>
          </div>
        }
      />

      <BranchOperationsNav branchId={branchId} />

      <FilterBar
        filters={[
          {
            key: 'startDate',
            label: 'From',
            type: 'date',
            value: filters.startDate
          },
          {
            key: 'endDate',
            label: 'To',
            type: 'date',
            value: filters.endDate
          },
          {
            key: 'shift',
            label: 'Shift',
            options: [
              { label: 'Day', value: 'DAY' },
              { label: 'Night', value: 'NIGHT' }
            ],
            type: 'select',
            value: filters.shift
          },
          {
            key: 'paymentMethod',
            label: 'Payment Method',
            options: [
              { label: 'Cash', value: 'CASH' },
              { label: 'EcoCash', value: 'ECOCASH' },
              { label: 'Card', value: 'CARD' }
            ],
            type: 'select',
            value: filters.paymentMethod
          }
        ]}
        onFilterChange={(key, value) =>
          setFilters((current) => ({
            ...current,
            [key]: value,
            page: 1
          }))
        }
      />

      <DataTable<{
        id: string;
        saleNumber: string;
        saleDate: string;
        shift: string;
        itemsCount: number;
        totalAmount: number;
        paymentMethod: string;
        servedBy: string;
      }>
        data={sales}
        loading={salesQuery.isLoading}
        pagination={pagination}
        columns={[
          { key: 'saleNumber', header: 'Sale #' },
          {
            key: 'saleDate',
            header: 'Date',
            render: (row) => new Date(row.saleDate).toLocaleDateString()
          },
          { key: 'shift', header: 'Shift' },
          { key: 'itemsCount', header: 'Items' },
          {
            key: 'totalAmount',
            header: 'Total',
            render: (row) => currencyFormatter.format(row.totalAmount)
          },
          { key: 'paymentMethod', header: 'Payment Method' },
          { key: 'servedBy', header: 'Served By' },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <Button asChild size="sm" variant="outline">
                <Link href={`/branches/${branchId}/sales?sale=${row.id}`}>View</Link>
              </Button>
            )
          }
        ]}
        emptyState={
          <EmptyState
            icon={<ShoppingBasket className="h-6 w-6" />}
            title="No branch sales found"
            description="Record your first sale to start tracking branch shift performance."
          />
        }
      />

      {pagination ? (
        <PaginationControls
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={(page) =>
            setFilters((current) => ({
              ...current,
              page
            }))
          }
        />
      ) : null}

      {showStock ? (
        <DataTable<{
          id: string;
          item: {
            code: string;
            name: string;
          };
          quantityAvailable: number;
          quantityOnHand: number;
          totalValue: number;
        }>
          data={stockRows}
          loading={stockQuery.isLoading}
          columns={[
            {
              key: 'item',
              header: 'Item',
              render: (row) => `${row.item.code} - ${row.item.name}`
            },
            {
              key: 'quantityOnHand',
              header: 'On Hand'
            },
            {
              key: 'quantityAvailable',
              header: 'Available'
            },
            {
              key: 'totalValue',
              header: 'Total Value',
              render: (row) => currencyFormatter.format(row.totalValue)
            }
          ]}
          emptyState={
            <EmptyState
              icon={<ShoppingBasket className="h-6 w-6" />}
              title="No stock found"
              description="This branch has no stock balances to display."
            />
          }
        />
      ) : null}

      <FormDrawer title="Record Branch Sale" open={saleDrawerOpen} onClose={() => setSaleDrawerOpen(false)}>
        <form className="space-y-5" onSubmit={handleSaleSubmit}>
          {saleError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {saleError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Shift</span>
              <select
                value={shift}
                onChange={(event) => setShift(event.target.value as 'DAY' | 'NIGHT')}
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              >
                <option value="DAY">DAY</option>
                <option value="NIGHT">NIGHT</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Payment Method</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as 'CASH' | 'ECOCASH' | 'CARD')}
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              >
                <option value="CASH">CASH</option>
                <option value="ECOCASH">ECOCASH</option>
                <option value="CARD">CARD</option>
              </select>
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Payment Reference</span>
            <input
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
            />
          </label>

          <div className="space-y-3 rounded-2xl border border-border bg-cream/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-brown">Line Items</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSaleItems((current) => [...current, initialSaleLine])}
              >
                Add Item
              </Button>
            </div>

            {saleItems.map((line, index) => (
              <div key={`${line.itemId}-${index}`} className="grid gap-3 rounded-2xl bg-white p-3 sm:grid-cols-4">
                <select
                  value={line.itemId}
                  onChange={(event) =>
                    setSaleItems((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, itemId: event.target.value } : item,
                      ),
                    )
                  }
                  className="h-11 rounded-2xl border border-border bg-cream px-3 text-brown outline-none sm:col-span-2"
                >
                  <option value="">Select item</option>
                  {stockOptions.map((option) => (
                    <option key={option.item.id} value={option.item.id}>
                      {option.item.code} - {option.item.name}
                    </option>
                  ))}
                </select>
                <input
                  min="0"
                  step="0.001"
                  type="number"
                  value={line.quantity}
                  onChange={(event) =>
                    setSaleItems((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, quantity: event.target.value } : item,
                      ),
                    )
                  }
                  className="h-11 rounded-2xl border border-border bg-cream px-3 text-brown outline-none"
                />
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={line.unitPrice}
                  onChange={(event) =>
                    setSaleItems((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, unitPrice: event.target.value } : item,
                      ),
                    )
                  }
                  className="h-11 rounded-2xl border border-border bg-cream px-3 text-brown outline-none"
                />
                <div className="text-sm text-muted sm:col-span-4">
                  Line Total:{' '}
                  <span className="font-semibold text-brown">
                    {currencyFormatter.format((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}
                  </span>
                </div>
                {saleItems.length > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSaleItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                    className="sm:col-span-4"
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-cream px-4 py-3 text-sm text-muted">
            Grand Total: <span className="font-semibold text-brown">{currencyFormatter.format(grandTotal)}</span>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setSaleDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSale.isPending}>
              {createSale.isPending ? 'Saving...' : 'Submit Sale'}
            </Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer
        title="Record Branch Expense"
        open={expenseDrawerOpen}
        onClose={() => setExpenseDrawerOpen(false)}
      >
        <form className="space-y-5" onSubmit={handleExpenseSubmit}>
          {expenseError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {expenseError}
            </div>
          ) : null}

          <label className="space-y-2 text-sm text-muted">
            <span>Category</span>
            <input
              required
              value={expenseCategory}
              onChange={(event) => setExpenseCategory(event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
            />
          </label>
          <label className="space-y-2 text-sm text-muted">
            <span>Description</span>
            <textarea
              required
              rows={3}
              value={expenseDescription}
              onChange={(event) => setExpenseDescription(event.target.value)}
              className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-brown outline-none"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Amount</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Payment Method</span>
              <select
                value={expensePaymentMethod}
                onChange={(event) =>
                  setExpensePaymentMethod(event.target.value as 'CASH' | 'ECOCASH' | 'CARD')
                }
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              >
                <option value="CASH">CASH</option>
                <option value="ECOCASH">ECOCASH</option>
                <option value="CARD">CARD</option>
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setExpenseDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createExpense.isPending}>
              {createExpense.isPending ? 'Saving...' : 'Save Expense'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
