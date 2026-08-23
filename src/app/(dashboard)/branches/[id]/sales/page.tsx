'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, ShoppingBasket } from 'lucide-react';

import { ItemSelectorField } from '@/components/shared/item-selector-field';
import { DataTable, EmptyState, FilterBar, FormDrawer } from '@/components/ui-library';

import { BranchOperationsNav } from '@/components/branch-operations/branch-operations-nav';
import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { Button } from '@/components/ui/button';
import { useItemSelectorOptions } from '@/hooks/useItemSelectorOptions';
import { useSalesMeta } from '@/hooks/sales/useSalesMeta';
import { buildSalesReceiptPrintUrl } from '@/lib/sales-payments';
import {
  useBranchCustomers,
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
  const [paymentMethod, setPaymentMethod] = useState<'BANK' | 'CASH' | 'CREDIT'>('CASH');
  const [cashAccountId, setCashAccountId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [branchCustomerId, setBranchCustomerId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [saleItems, setSaleItems] = useState<SaleLineItem[]>([initialSaleLine]);
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('0');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'BANK' | 'CASH' | 'PETTY_CASH'>('CASH');
  const [expenseCashAccountId, setExpenseCashAccountId] = useState('');
  const [expenseBankAccountId, setExpenseBankAccountId] = useState('');
  const [expenseReference, setExpenseReference] = useState('');

  const salesQuery = useBranchSales(branchId, filters);
  const stockQuery = useBranchStock(branchId, {
    page: 1,
    pageSize: 100
  });
  const branchCustomersQuery = useBranchCustomers(branchId);
  const stockRows = useMemo(() => stockQuery.data?.data ?? [], [stockQuery.data?.data]);
  const resolvedWarehouse = useMemo(() => {
    const warehouseEntries = stockRows
      .map((row) => row.warehouse)
      .filter((warehouse): warehouse is NonNullable<(typeof stockRows)[number]['warehouse']> => Boolean(warehouse?.id))
      .map((warehouse) => [warehouse.id, warehouse] as const);
    const warehouses = [...new Map(warehouseEntries).values()];
    return warehouses[0] ?? null;
  }, [stockRows]);
  const itemOptionsQuery = useItemSelectorOptions({
    branchId,
    includePrice: true,
    includeStock: true,
    itemType: ['FINISHED_GOOD', 'FINISHED'],
    limit: 250,
    warehouseId: resolvedWarehouse?.id ?? null,
  });
  const createSale = useCreateBranchSale(branchId);
  const createExpense = useCreateBranchExpense(branchId);
  const salesMetaQuery = useSalesMeta();
  const stockOptions = useMemo(() => itemOptionsQuery.data ?? [], [itemOptionsQuery.data]);
  const stockOptionByItemId = useMemo(
    () => new Map(stockOptions.map((option) => [option.id, option])),
    [stockOptions],
  );
  const availableCashAccounts = useMemo(
    () => (salesMetaQuery.data?.cashAccounts ?? []).filter((account) => !account.branchId || account.branchId === branchId),
    [branchId, salesMetaQuery.data?.cashAccounts],
  );
  const availableBankAccounts = useMemo(
    () => salesMetaQuery.data?.bankAccounts ?? [],
    [salesMetaQuery.data?.bankAccounts],
  );
  const sales = salesQuery.data?.data ?? [];
  const pagination = salesQuery.data?.pagination;
  const branchCustomers = branchCustomersQuery.data ?? [];
  const grandTotal = useMemo(
    () =>
      saleItems.reduce((sum, item) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;

        return sum + quantity * unitPrice;
      }, 0),
    [saleItems],
  );

  useEffect(() => {
    if (paymentMethod === 'CASH') {
      if (!cashAccountId && availableCashAccounts.length > 0) {
        setCashAccountId(availableCashAccounts[0].id);
      }
      return;
    }

    if (paymentMethod === 'BANK' && !bankAccountId && availableBankAccounts.length > 0) {
      setBankAccountId(availableBankAccounts[0].id);
    }
  }, [availableBankAccounts, availableCashAccounts, bankAccountId, cashAccountId, paymentMethod]);

  useEffect(() => {
    if ((expensePaymentMethod === 'CASH' || expensePaymentMethod === 'PETTY_CASH') && !expenseCashAccountId && availableCashAccounts.length > 0) {
      setExpenseCashAccountId(availableCashAccounts[0].id);
    }
    if (expensePaymentMethod === 'BANK' && !expenseBankAccountId && availableBankAccounts.length > 0) {
      setExpenseBankAccountId(availableBankAccounts[0].id);
    }
  }, [availableBankAccounts, availableCashAccounts, expenseBankAccountId, expenseCashAccountId, expensePaymentMethod]);

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

    const quantityViolation = normalizedItems.find((item) => {
      const selectedOption = stockOptionByItemId.get(item.itemId);
      const availableQuantity = Number(selectedOption?.quantityAvailable ?? selectedOption?.warehouseQuantity ?? selectedOption?.branchQuantity ?? 0);
      return item.quantity > availableQuantity;
    });
    if (quantityViolation) {
      setSaleError('One or more line quantities exceed available warehouse stock.');
      return;
    }

    if (paymentMethod === 'CASH' && !cashAccountId) {
      setSaleError('Select the cash account that should receive this branch sale.');
      return;
    }

    if (paymentMethod === 'BANK' && !bankAccountId) {
      setSaleError('Select the bank account that should receive this branch sale.');
      return;
    }

    if (paymentMethod === 'CREDIT' && !branchCustomerId) {
      setSaleError('Select the branch customer for this credit sale.');
      return;
    }

    try {
      const createdSale = await createSale.mutateAsync({
        bankAccountId: paymentMethod === 'BANK' ? bankAccountId : null,
        cashAccountId: paymentMethod === 'CASH' ? cashAccountId : null,
        customerId: paymentMethod === 'CREDIT' ? branchCustomerId : null,
        items: normalizedItems,
        paymentMethod,
        paymentReference: paymentReference || null,
        saleDate: formatToday(),
        shift
      });
      setSaleDrawerOpen(false);
      setBranchCustomerId('');
      setSaleItems([initialSaleLine]);
      setSaleError(null);
      const saleId = String((createdSale as { id?: string } | null)?.id ?? '');
      if (saleId) {
        window.open(buildSalesReceiptPrintUrl({ branchSaleId: saleId }, { autoPrint: true }), '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : 'Failed to save branch sale.');
    }
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (expensePaymentMethod === 'BANK' && !expenseBankAccountId) {
      setExpenseError('Select the bank account for this branch expense.');
      return;
    }
    if ((expensePaymentMethod === 'CASH' || expensePaymentMethod === 'PETTY_CASH') && !expenseCashAccountId) {
      setExpenseError('Select the cash account for this branch expense.');
      return;
    }

    try {
      await createExpense.mutateAsync({
        amount: Number(expenseAmount),
        bankAccountId: expensePaymentMethod === 'BANK' ? expenseBankAccountId : null,
        category: expenseCategory,
        cashAccountId: expensePaymentMethod === 'BANK' ? null : expenseCashAccountId,
        description: expenseDescription,
        expenseDate: formatToday(),
        paymentMethod: expensePaymentMethod,
        referenceNumber: expenseReference || null,
      });
      setExpenseDrawerOpen(false);
      setExpenseCategory('');
      setExpenseDescription('');
      setExpenseAmount('0');
      setExpenseReference('');
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
              { label: 'Bank', value: 'BANK' },
              { label: 'Credit', value: 'CREDIT' }
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
                <Link href={buildSalesReceiptPrintUrl({ branchSaleId: row.id }, { autoPrint: true })} target="_blank">
                  Print Receipt
                </Link>
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
          sellingPrice: number;
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
              key: 'sellingPrice',
              header: 'Price',
              render: (row) => currencyFormatter.format(row.sellingPrice)
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
                className="surface-input-soft"
              >
                <option value="DAY">DAY</option>
                <option value="NIGHT">NIGHT</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Payment Method</span>
              <select
                value={paymentMethod}
                onChange={(event) => {
                  setPaymentMethod(event.target.value as 'BANK' | 'CASH' | 'CREDIT');
                  setSaleError(null);
                }}
                className="surface-input-soft"
              >
                <option value="CASH">CASH</option>
                <option value="BANK">BANK</option>
                <option value="CREDIT">CREDIT</option>
              </select>
            </label>
          </div>

          {paymentMethod === 'CASH' ? (
            <label className="space-y-2 text-sm text-muted">
              <span>Cash Account</span>
              <select
                value={cashAccountId}
                onChange={(event) => setCashAccountId(event.target.value)}
                className="surface-input-soft"
                required
              >
                <option value="">Select cash account</option>
                {availableCashAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          ) : paymentMethod === 'BANK' ? (
            <label className="space-y-2 text-sm text-muted">
              <span>Bank Account</span>
              <select
                value={bankAccountId}
                onChange={(event) => setBankAccountId(event.target.value)}
                className="surface-input-soft"
                required
              >
                <option value="">Select bank account</option>
                {availableBankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bankName ? `${account.bankName} - ` : ''}
                    {account.accountName}
                    {account.accountNumber ? ` (${account.accountNumber})` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="space-y-2 text-sm text-muted">
              <span>Branch Customer</span>
              <select
                value={branchCustomerId}
                onChange={(event) => setBranchCustomerId(event.target.value)}
                className="surface-input-soft"
                required
              >
                <option value="">Select branch customer</option>
                {branchCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_name}
                    {customer.credit_allowed ? ` | Credit ${currencyFormatter.format(customer.credit_limit)}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="space-y-2 text-sm text-muted">
            <span>Payment Reference</span>
            <input
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              className="surface-input-soft"
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

            {stockQuery.isError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {stockQuery.error?.message ?? 'Branch stock is unavailable for sale recording right now.'}
              </div>
            ) : null}

            {!stockQuery.isLoading && !stockQuery.isError && stockOptions.length === 0 ? (
              <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm text-muted">
                No items recorded for this branch yet.
              </div>
            ) : null}

            {saleItems.map((line, index) => (
              <div key={`${line.itemId}-${index}`} className="grid gap-3 rounded-2xl bg-white p-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <ItemSelectorField
                    value={line.itemId}
                    options={stockOptions}
                    loading={itemOptionsQuery.isLoading}
                    errorMessage={itemOptionsQuery.error?.message ?? null}
                    emptyMessage="No branch sale items are available."
                    onRetry={() => {
                      void itemOptionsQuery.refetch();
                    }}
                    onChange={(selectedItemId) => {
                      const selectedStock = stockOptionByItemId.get(selectedItemId);
                      const defaultPrice = Number(selectedStock?.sellingPrice ?? selectedStock?.currentInventoryCost ?? 0);
                      setSaleItems((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                itemId: selectedItemId,
                                unitPrice: defaultPrice > 0 ? String(defaultPrice) : item.unitPrice,
                              }
                            : item,
                        ),
                      );
                    }}
                  />
                </div>
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
                  className="surface-input-soft"
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
                  className="surface-input-soft"
                />
                <div className="text-sm text-muted sm:col-span-4">
                  {stockOptionByItemId.get(line.itemId) ? (
                    <span className="mr-3">
                      {stockOptionByItemId.get(line.itemId)?.hasStockRecord
                        ? `On Hand ${Number(stockOptionByItemId.get(line.itemId)?.quantityOnHand ?? 0).toFixed(3)} | Reserved ${Number(stockOptionByItemId.get(line.itemId)?.quantityReserved ?? 0).toFixed(3)} | Available ${Number(stockOptionByItemId.get(line.itemId)?.quantityAvailable ?? 0).toFixed(3)}`
                        : 'No stock record'}
                    </span>
                  ) : null}
                  {stockOptionByItemId.get(line.itemId)?.warehouseName ? (
                    <span className="mr-3">Warehouse: {stockOptionByItemId.get(line.itemId)?.warehouseName}</span>
                  ) : null}
                  Line Total:{' '}
                  <span className="font-semibold text-brown">
                    {currencyFormatter.format((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}
                  </span>
                </div>
                {line.itemId && Number(line.quantity || 0) > Number(stockOptionByItemId.get(line.itemId)?.quantityAvailable ?? 0) ? (
                  <div className="text-sm text-error sm:col-span-4">
                    Quantity exceeds available stock for the selling warehouse.
                  </div>
                ) : null}
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

          <div className="surface-tile text-sm text-muted">
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
              className="surface-input-soft"
            />
          </label>
          <label className="space-y-2 text-sm text-muted">
            <span>Description</span>
            <textarea
              required
              rows={3}
              value={expenseDescription}
              onChange={(event) => setExpenseDescription(event.target.value)}
              className="surface-textarea-soft"
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
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Payment Method</span>
              <select
                value={expensePaymentMethod}
                onChange={(event) =>
                  setExpensePaymentMethod(event.target.value as 'BANK' | 'CASH' | 'PETTY_CASH')
                }
                className="surface-input-soft"
              >
                <option value="CASH">CASH</option>
                <option value="BANK">BANK</option>
                <option value="PETTY_CASH">PETTY CASH</option>
              </select>
            </label>
          </div>

          {expensePaymentMethod === 'BANK' ? (
            <label className="space-y-2 text-sm text-muted">
              <span>Bank Account</span>
              <select
                value={expenseBankAccountId}
                onChange={(event) => setExpenseBankAccountId(event.target.value)}
                className="surface-input-soft"
                required
              >
                <option value="">Select bank account</option>
                {availableBankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bankName ? `${account.bankName} - ` : ''}
                    {account.accountName}
                    {account.accountNumber ? ` (${account.accountNumber})` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="space-y-2 text-sm text-muted">
              <span>{expensePaymentMethod === 'PETTY_CASH' ? 'Petty Cash Account' : 'Cash Account'}</span>
              <select
                value={expenseCashAccountId}
                onChange={(event) => setExpenseCashAccountId(event.target.value)}
                className="surface-input-soft"
                required
              >
                <option value="">Select cash account</option>
                {availableCashAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="space-y-2 text-sm text-muted">
            <span>Reference</span>
            <input
              value={expenseReference}
              onChange={(event) => setExpenseReference(event.target.value)}
              className="surface-input-soft"
            />
          </label>

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
