'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  PackageCheck,
  Plus,
  Send,
  ShoppingCart,
  Truck,
  XCircle,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { EmptyState, FilterBar, FormDrawer, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { SupplierSelect } from '@/components/procurement/supplier-select';
import { TransactionShortcuts } from '@/components/procurement/transaction-shortcuts';
import { ItemSelectorField } from '@/components/shared/item-selector-field';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/contexts/UserContext';
import { type ItemSelectorOption, useItemSelectorOptions } from '@/hooks/useItemSelectorOptions';
import {
  buildPurchaseOrderDraftPayload,
  formatPurchaseOrderStatusLabel,
  extractRequisitionLineItems,
  mapRequisitionItemToPurchaseOrderLine,
} from '@/lib/procurement-purchase-orders';
import {
  formatProcurementWorkflowStatusLabel,
  getPurchaseOrderActionState,
  getPurchaseOrderWorkflowCopy,
} from '@/lib/procurement-workflow';
import {
  useProcurementMeta,
  useProcurementRequest,
  usePurchaseOrders,
  type PurchaseOrderRow,
  useSupplierOptions,
} from '@/hooks/procurement';
import { usePermission } from '@/hooks/usePermission';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency'
});
const purchasableItemTypes = new Set([
  'RAW',
  'RAW_MATERIAL',
  'PACKAGING',
  'PACKAGING_MATERIAL',
  'INGREDIENT',
  'CONSUMABLE',
  'GENERAL',
  'STOCK',
]);

interface PurchaseOrderItemOption extends ItemSelectorOption {
  description?: string | null;
}

function createLineItemDraft() {
  return {
    description: '',
    itemCode: '',
    itemId: '',
    itemName: '',
    requisitionItemId: '',
    quantityOrdered: '1',
    rowId:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `po-item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    specification: '',
    taxRate: '0',
    unitCost: '0',
    unitOfMeasureId: '',
    unitOfMeasureName: ''
  };
}

function createInitialFormState(requisitionId = '') {
  return {
    approverEmail: '',
    approverName: '',
    approverUserId: '',
    approvalNotes: '',
    discountAmount: '0',
    expectedDeliveryDate: '',
    items: [createLineItemDraft()],
    notes: '',
    orderDate: '',
    requisitionId,
    supplierId: '',
    taxAmount: '0'
  };
}

const actionButtonClassNames = {
  approve:
    'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white',
  reject:
    'border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-600 hover:bg-rose-600 hover:text-white',
  send:
    'border border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-600 hover:bg-sky-600 hover:text-white',
  view:
    'border border-brown/15 bg-white text-brown hover:border-brown hover:bg-brown hover:text-white'
} as const;

interface FeedbackState {
  message: string;
  tone: 'error' | 'success';
}

interface RequisitionPickerOption {
  id: string;
  label: string;
  requisitionNumber: string;
}

interface RequisitionDetailResponse {
  data?: RequisitionDetailResponse;
  id: string;
  requisition_id?: string | null;
  requisitionId?: string | null;
  needed_by_date: string | null;
  approver_user_id: string | null;
  approver_name?: string | null;
  approverName?: string | null;
  approver_email?: string | null;
  approverEmail?: string | null;
  approval_notes?: string | null;
  approvalNotes?: string | null;
  items?: Array<{
    id: string;
    requisition_item_id?: string | null;
    requisitionItemId?: string | null;
    item_id?: string | null;
    itemId?: string | null;
    item_code?: string | null;
    itemCode?: string | null;
    item_name?: string | null;
    itemName?: string | null;
    description?: string | null;
    quantity?: number | string;
    quantityRemainingForPurchaseOrder?: number | string;
    remainingApprovedQuantity?: number | string;
    remaining_approved_quantity?: number | string;
    unit_of_measure_id?: string | null;
    unitOfMeasureId?: string | null;
    unit_of_measure_name?: string | null;
    uomName?: string | null;
    unit_price?: number | string | null;
    unitPrice?: number | string | null;
  }>;
  line_items?: RequisitionDetailResponse['items'];
  lineItems?: RequisitionDetailResponse['items'];
  requisition_items?: RequisitionDetailResponse['items'];
  requisitionItems?: RequisitionDetailResponse['items'];
  purchase_requisition_items: Array<{
    id: string;
    item_id: string;
    itemId?: string | null;
    item_code?: string | null;
    itemCode?: string | null;
    item_name?: string | null;
    itemName?: string | null;
    description?: string | null;
    quantityRemainingForPurchaseOrder?: number | string;
    remainingApprovedQuantity?: number | string;
    remaining_approved_quantity?: number | string;
    unit_of_measure_id: string;
    unitOfMeasureId?: string | null;
    unit_of_measure_name?: string | null;
    uomName?: string | null;
    quantity_requested: number | string;
    estimated_unit_cost?: number | string | null;
  }>;
}

export default function PurchaseOrdersPage() {
  const searchParams = useSearchParams();
  const requisitionIdParam = searchParams.get('requisitionId');
  const canCreate = usePermission([PERMISSIONS.purchaseOrder.create, 'procurement.write']);
  const canApprove = usePermission([PERMISSIONS.purchaseOrder.approve, 'procurement.approve']);
  const canSend = usePermission([PERMISSIONS.purchaseOrder.create, 'procurement.write']);
  const { currentUser } = useUserContext();
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 10,
    status: '',
    supplierId: ''
  });
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState(() => createInitialFormState(requisitionIdParam ?? ''));
  const [requisitionLoadError, setRequisitionLoadError] = useState<string | null>(null);
  const [isLoadingRequisition, setIsLoadingRequisition] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const router = useRouter();
  const queryClient = useQueryClient();
  const request = useProcurementRequest();
  const metaQuery = useProcurementMeta();
  const supplierOptionsQuery = useSupplierOptions();
  const itemSelectorQuery = useItemSelectorOptions({
    includeCost: true,
    includePrice: true,
    includeStock: true,
    itemType: Array.from(purchasableItemTypes),
  });
  const requisitionPickerQuery = useQuery({
    queryKey: ['procurement', 'purchase-order-requisition-picker'],
    queryFn: async () => {
      const response = await request<{ data?: RequisitionPickerOption[]; success?: boolean }>(
        '/api/procurement/requisitions?picker=true&forPurchaseOrder=true&pageSize=100',
      );
      return response.data ?? [];
    },
    enabled: isDrawerOpen,
  });
  const ordersQuery = usePurchaseOrders({
    page: filters.page,
    pageSize: filters.pageSize,
    status: filters.status || undefined,
    supplierId: filters.supplierId || undefined
  });

  useEffect(() => {
    if (!requisitionIdParam) {
      return;
    }

    setFormState((current) => ({
      ...current,
      requisitionId: requisitionIdParam
    }));
    setIsDrawerOpen(true);
  }, [requisitionIdParam]);

  async function loadRequisitionIntoForm(requisitionId: string) {
    if (!requisitionId) {
      setRequisitionLoadError(null);
      return;
    }

    setIsLoadingRequisition(true);
    setRequisitionLoadError(null);

    try {
      const response = await request<RequisitionDetailResponse>(`/api/procurement/requisitions/${requisitionId}`);
      const detail = response.data ?? response;
      const requisitionItems = extractRequisitionLineItems(response);
      const eligibleRequisitionItems = requisitionItems.filter((item) => item.quantityRemainingForPurchaseOrder > 0 && item.itemId);

      if (!requisitionItems.length) {
        setRequisitionLoadError('Selected requisition has no items. Please check the requisition before creating a PO.');
      } else if (!eligibleRequisitionItems.length) {
        setRequisitionLoadError('Selected requisition is fully converted or has no remaining approved quantity.');
      }

      setFormState((current) => ({
        ...current,
        approverEmail: current.approverEmail || detail.approverEmail || detail.approver_email || '',
        approverName: current.approverName || detail.approverName || detail.approver_name || '',
        approverUserId: current.approverUserId || detail.approver_user_id || '',
        approvalNotes: current.approvalNotes || detail.approvalNotes || detail.approval_notes || '',
        expectedDeliveryDate: current.expectedDeliveryDate || (detail.needed_by_date ? String(detail.needed_by_date).slice(0, 10) : ''),
        items:
          eligibleRequisitionItems.length > 0
            ? eligibleRequisitionItems.map((item) => mapRequisitionItemToPurchaseOrderLine(item) ?? createLineItemDraft())
            : [createLineItemDraft()],
        requisitionId,
      }));
    } catch (error) {
      setRequisitionLoadError(error instanceof Error ? error.message : 'Unable to load requisition details right now.');
    } finally {
      setIsLoadingRequisition(false);
    }
  }

  const orders = ordersQuery.data?.data ?? [];
  const pagination = ordersQuery.data?.pagination;
  const purchaseOrderItems = (() => {
    const merged = new Map<string, PurchaseOrderItemOption>();

    for (const item of itemSelectorQuery.data ?? []) {
      merged.set(item.id, {
        ...item,
        description: item.name,
      });
    }

    return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
  })();
  const workflowAccess = {
    canApprove,
    canCreate,
    canEdit: canCreate,
    canSend,
    role: currentUser?.profile.role ?? null,
    roleNames: currentUser?.roles.map((role) => role.name) ?? [],
  };

  const summary = orders.reduce(
    (accumulator, order) => {
      const normalizedStatus = getPurchaseOrderActionState(order, workflowAccess).normalizedStatus;
      accumulator.total += 1;

      if (normalizedStatus === 'APPROVED') {
        accumulator.approved += 1;
      }

      if (normalizedStatus === 'SENT_TO_SUPPLIER') {
        accumulator.sent += 1;
      }

      if (normalizedStatus === 'PARTIAL_RECEIVED' || normalizedStatus === 'FULLY_RECEIVED') {
        accumulator.receiving += 1;
      }

      return accumulator;
    },
    { approved: 0, receiving: 0, sent: 0, total: 0 },
  );

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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items = formState.items
      .filter((item) => item.itemId)
      .map((item) => ({
        description: item.description || '',
        itemId: item.itemId,
        requisitionItemId: item.requisitionItemId || null,
        quantityOrdered: Number(item.quantityOrdered),
        taxRate: Number(item.taxRate || 0),
        unitCost: Number(item.unitCost),
        unitOfMeasureId: item.unitOfMeasureId || ''
      }));

    if (!formState.supplierId) {
      setFormError('Please select a supplier.');
      return;
    }

    if (!items.length) {
      setFormError(formState.requisitionId ? 'Please select an item for every PO line.' : 'Please select a requisition or add items manually.');
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
      setFormError('Please enter a valid quantity.');
      return;
    }

    try {
      const response = await request<{
        data?: {
          id?: string;
          purchase_order_id?: string;
          purchaseOrderId?: string;
        };
        id?: string;
        purchase_order_id?: string;
        purchaseOrderId?: string;
      }>('/api/procurement/purchase-orders', {
        body: JSON.stringify(buildPurchaseOrderDraftPayload({
          approverEmail: formState.approverEmail || null,
          approverName: formState.approverName || null,
          discountAmount: Number(formState.discountAmount),
          expectedDeliveryDate: formState.expectedDeliveryDate || null,
          items,
          notes: formState.notes || null,
          orderDate: formState.orderDate || null,
          approverUserId: formState.approverUserId || null,
          approvalNotes: formState.approvalNotes || null,
          requisitionId: formState.requisitionId || null,
          supplierId: formState.supplierId,
          supplier_id: formState.supplierId,
          taxAmount: Number(formState.taxAmount)
        })),
        method: 'POST'
      });
      const createdOrder = response.data ?? response;
      const createdOrderId = createdOrder.id ?? createdOrder.purchase_order_id ?? createdOrder.purchaseOrderId ?? null;
      setFeedback({ message: 'Purchase order created successfully.', tone: 'success' });
      setFormError(null);
      setFormState(createInitialFormState());
      setIsDrawerOpen(false);
      await refresh();
      if (createdOrderId) {
        router.push(`/procurement/purchase-orders/${createdOrderId}`);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create purchase order.');
    }
  }

  async function approveOrder(id: string) {
    await runAction(`approve:${id}`, 'Purchase order approved.', async () => {
      await request(`/api/procurement/purchase-orders/${id}/approve`, {
        body: JSON.stringify({}),
        method: 'POST'
      });
      await refresh();
    });
  }

  async function sendOrder(id: string) {
    await runAction(`send:${id}`, 'Purchase order sent to supplier.', async () => {
      await request(`/api/procurement/purchase-orders/${id}/send`, {
        body: JSON.stringify({}),
        method: 'POST'
      });
      await refresh();
    });
  }

  async function rejectOrder(id: string) {
    const remarks = window.prompt('Reason for rejecting this purchase order:', 'Rejected from purchase order review.');
    if (remarks === null) return;

    await runAction(`reject:${id}`, 'Purchase order rejected.', async () => {
      await request(`/api/procurement/purchase-orders/${id}/reject`, {
        body: JSON.stringify({ remarks }),
        method: 'POST'
      });
      await refresh();
    });
  }

  function appendLineItem() {
    setFormState((current) => ({
      ...current,
      items: [...current.items, createLineItemDraft()]
    }));
  }

  function updateLineItem(
    rowId: string,
    field: 'itemId' | 'quantityOrdered' | 'unitCost' | 'unitOfMeasureId',
    value: string,
  ) {
    setFormState((current) => ({
      ...current,
      items: current.items.map((row) => {
        if (row.rowId !== rowId) {
          return row;
        }

        if (field === 'itemId') {
          const matchedItem = purchaseOrderItems.find((item) => item.id === value);
          const derivedUnitCost = matchedItem?.currentInventoryCost ?? matchedItem?.sellingPrice ?? 0;

          return {
            ...row,
            description: matchedItem?.description ?? matchedItem?.name ?? '',
            itemCode: matchedItem?.code ?? '',
            itemId: value,
            itemName: matchedItem?.name ?? '',
            unitCost: String(derivedUnitCost),
            unitOfMeasureId: matchedItem?.unitId || row.unitOfMeasureId || '',
            unitOfMeasureName: matchedItem?.unitName ?? '',
          };
        }

        return {
          ...row,
          [field]: value
        };
      })
    }));
  }

  function removeLineItem(rowId: string) {
    setFormState((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((row) => row.rowId !== rowId)
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Review approvals, dispatch supplier orders, and keep receiving work moving without wasting screen space."
        actions={
          canCreate ? (
            <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Purchase Order
            </Button>
          ) : null
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card bg-gradient-to-br from-white via-white to-amber-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Open Orders</p>
              <p className="mt-3 text-3xl font-semibold text-brown">{summary.total}</p>
            </div>
            <span className="app-icon-chip h-11 w-11">
              <ShoppingCart className="h-5 w-5" />
            </span>
          </div>
        </div>
        <div className="surface-card bg-gradient-to-br from-white via-white to-sky-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Approved</p>
              <p className="mt-3 text-3xl font-semibold text-brown">{summary.approved}</p>
            </div>
            <span className="app-icon-chip h-11 w-11 text-sky-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </div>
        </div>
        <div className="surface-card bg-gradient-to-br from-white via-white to-emerald-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Sent</p>
              <p className="mt-3 text-3xl font-semibold text-brown">{summary.sent}</p>
            </div>
            <span className="app-icon-chip h-11 w-11 text-emerald-700">
              <Send className="h-5 w-5" />
            </span>
          </div>
        </div>
        <div className="surface-card bg-gradient-to-br from-white via-white to-orange-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">In Receiving</p>
              <p className="mt-3 text-3xl font-semibold text-brown">{summary.receiving}</p>
            </div>
            <span className="app-icon-chip h-11 w-11 text-orange">
              <Truck className="h-5 w-5" />
            </span>
          </div>
        </div>
      </section>

      <FilterBar
        filters={[
          {
            key: 'supplierId',
            label: 'Supplier',
            options: (supplierOptionsQuery.data ?? []).map((supplier) => ({
              label: supplier.code ? `${supplier.code} - ${supplier.name}` : supplier.name,
              value: supplier.id
            })),
            type: 'select',
            value: filters.supplierId
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Draft', value: 'DRAFT' },
              { label: 'Approved', value: 'APPROVED' },
              { label: 'Sent to Supplier', value: 'SENT_TO_SUPPLIER' },
              { label: 'Partial Received', value: 'PARTIAL_RECEIVED' },
              { label: 'Fully Received', value: 'FULLY_RECEIVED' },
              { label: 'Rejected', value: 'REJECTED' },
              { label: 'Cancelled', value: 'CANCELLED' }
            ],
            type: 'select',
            value: filters.status
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

      {ordersQuery.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface-card h-64 animate-pulse bg-cream/70" />
          ))}
        </div>
      ) : orders.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {orders.map((row) => {
            const actionState = getPurchaseOrderActionState(row, workflowAccess);
            const actionBase = 'transition-colors';
            const isApproving = pendingAction === `approve:${row.id}`;
            const isSending = pendingAction === `send:${row.id}`;
            const isRejecting = pendingAction === `reject:${row.id}`;

            return (
              <article
                key={row.id}
                className="surface-card relative overflow-hidden border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,246,232,0.92))] p-0"
              >
                <div className="border-b border-border/70 px-5 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-semibold text-brown">{row.poNumber}</p>
                        <StatusBadge
                          status={formatProcurementWorkflowStatusLabel(actionState.normalizedStatus)}
                          variant={actionState.statusVariant}
                        />
                      </div>
                      <p className="text-sm text-muted">
                        {row.supplier.name}
                        {row.approverName ? ` - Approver: ${row.approverName}` : ' - Supervisor routing'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-white/80 px-4 py-3 text-right shadow-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted">Order Total</p>
                      <p className="mt-2 text-2xl font-semibold text-brown">
                        {currencyFormatter.format(row.total)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 px-5 py-5 md:grid-cols-4">
                  <div className="rounded-2xl border border-border/70 bg-white/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Order Date</p>
                    <p className="mt-2 text-sm font-semibold text-brown">
                      {new Date(row.orderDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-white/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Expected</p>
                    <p className="mt-2 text-sm font-semibold text-brown">
                      {row.expectedDeliveryDate
                        ? new Date(row.expectedDeliveryDate).toLocaleDateString()
                        : 'Not scheduled'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-white/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Items</p>
                    <p className="mt-2 text-sm font-semibold text-brown">{row.itemsCount} lines</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-white/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Approval</p>
                    <p className="mt-2 text-sm font-semibold text-brown">
                      {row.approvedAt ? new Date(row.approvedAt).toLocaleDateString() : 'Pending action'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-border/70 bg-white/55 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted">
                    {actionState.normalizedStatus === 'SENT_TO_SUPPLIER' || actionState.normalizedStatus === 'PARTIAL_RECEIVED' ? (
                      <>
                        <Truck className="h-4 w-4 text-sky-700" />
                        {getPurchaseOrderWorkflowCopy(row)}
                      </>
                    ) : actionState.normalizedStatus === 'APPROVED' ? (
                      <>
                        <Clock3 className="h-4 w-4 text-orange" />
                        {getPurchaseOrderWorkflowCopy(row)}
                      </>
                    ) : (
                      <>
                        <PackageCheck className="h-4 w-4 text-muted" />
                        {getPurchaseOrderWorkflowCopy(row)}
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {actionState.canApprove ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className={`${actionBase} ${actionButtonClassNames.approve}`}
                        disabled={isApproving}
                        onClick={() => approveOrder(row.id)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {isApproving ? 'Approving...' : 'Approve'}
                      </Button>
                    ) : null}

                    {actionState.canSend ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className={`${actionBase} ${actionButtonClassNames.send}`}
                        disabled={isSending}
                        onClick={() => sendOrder(row.id)}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {isSending ? 'Emailing...' : 'Email Supplier'}
                      </Button>
                    ) : null}

                    {actionState.canReject ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className={`${actionBase} ${actionButtonClassNames.reject}`}
                        disabled={isRejecting}
                        onClick={() => rejectOrder(row.id)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {isRejecting ? 'Rejecting...' : 'Reject'}
                      </Button>
                    ) : null}

                    {actionState.canRecordGrn ? (
                      <Button asChild size="sm" variant="outline" className={`${actionBase} ${actionButtonClassNames.view}`}>
                        <Link href={`/procurement/goods-received?purchaseOrderId=${row.id}`}>
                          Record GRN
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}

                    <Button asChild size="sm" variant="outline" className={`${actionBase} ${actionButtonClassNames.view}`}>
                      <Link href={`/procurement/purchase-orders/${row.id}`}>
                        {actionState.canEdit ? 'Edit Order' : 'View Order'}
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Plus className="h-6 w-6" />}
          title="No purchase orders found"
          description="Create a purchase order from approved requisitions or direct supplier demand."
        />
      )}

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

      <FormDrawer title="New Purchase Order" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <form className="space-y-6" onSubmit={handleCreate}>
          {formError ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}

          <section className="rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,232,0.88))] p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Supplier Details</p>
              <p className="mt-1 text-xs text-muted">Choose the supplier, manual approver, and originating requisition before the order moves into pricing and receiving.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-muted">
                <span>Supplier</span>
                <SupplierSelect
                  required
                  value={formState.supplierId}
                  onChange={(supplierId) => setFormState((current) => ({ ...current, supplierId }))}
                />
              </label>

              <div className="space-y-2 text-sm text-muted">
                <span>Quick Actions</span>
                <TransactionShortcuts
                  onSupplierCreated={(supplier) =>
                    setFormState((current) => ({ ...current, supplierId: supplier.id }))
                  }
                  onItemCreated={(createdItem) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === current.items.length - 1 && !row.itemId
                          ? {
                              ...row,
                              description: createdItem.description ?? createdItem.name ?? '',
                              itemId: createdItem.id,
                              unitCost: String(createdItem.unitCost ?? 0),
                              unitOfMeasureId: createdItem.unitOfMeasureId,
                            }
                          : row,
                      ),
                    }))
                  }
                  onUomCreated={(unit) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === current.items.length - 1 && !row.unitOfMeasureId
                          ? { ...row, unitOfMeasureId: unit.id }
                          : row,
                      ),
                    }))
                  }
                />
              </div>

              <label className="space-y-2 text-sm text-muted">
                <span>Approver</span>
                <select
                  value={formState.approverUserId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, approverUserId: event.target.value }))
                  }
                  className="surface-input-soft"
                >
                  <option value="">Auto route to supervisor</option>
                  {(metaQuery.data?.approvers ?? []).map((approver) => (
                    <option key={approver.id} value={approver.id}>
                      {approver.fullName} {approver.role ? `(${approver.role.replace(/_/g, ' ')})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2 text-sm text-muted">
                <span>Approved Requisition</span>
                <select
                  value={formState.requisitionId}
                  onChange={async (event) => {
                    const nextId = event.target.value;
                    setFormState((current) => ({ ...current, requisitionId: nextId }));
                    if (nextId) {
                      await loadRequisitionIntoForm(nextId);
                    } else {
                      setRequisitionLoadError(null);
                    }
                  }}
                  className="surface-input-soft"
                >
                  <option value="">
                    {requisitionPickerQuery.isLoading ? 'Loading requisitions...' : 'Optional source requisition'}
                  </option>
                  {(requisitionPickerQuery.data ?? []).map((requisition) => (
                    <option key={requisition.id} value={requisition.id}>
                      {requisition.label || requisition.requisitionNumber}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {isLoadingRequisition ? <span>Loading requisition lines...</span> : null}
                  {!isLoadingRequisition && requisitionPickerQuery.data?.length === 0 && !requisitionPickerQuery.isLoading ? (
                    <span>No approved requisitions are available for PO conversion.</span>
                  ) : null}
                  {requisitionLoadError ? <span className="text-rose-600">{requisitionLoadError}</span> : null}
                  {requisitionLoadError && formState.requisitionId ? (
                    <button type="button" className="text-primary underline" onClick={() => void loadRequisitionIntoForm(formState.requisitionId)}>
                      Retry
                    </button>
                  ) : null}
                </div>
              </div>

              <label className="space-y-2 text-sm text-muted">
                <span>Manual approver name</span>
                <input
                  value={formState.approverName}
                  onChange={(event) => setFormState((current) => ({ ...current, approverName: event.target.value }))}
                  className="surface-input-soft"
                  placeholder="Supervisor or approver name"
                />
              </label>

              <label className="space-y-2 text-sm text-muted">
                <span>Manual approver email</span>
                <input
                  type="email"
                  value={formState.approverEmail}
                  onChange={(event) => setFormState((current) => ({ ...current, approverEmail: event.target.value }))}
                  className="surface-input-soft"
                  placeholder="approver@example.com"
                />
              </label>

              <label className="space-y-2 text-sm text-muted">
                <span>Order Date</span>
                <input
                  type="date"
                  value={formState.orderDate}
                  onChange={(event) => setFormState((current) => ({ ...current, orderDate: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>

              <label className="space-y-2 text-sm text-muted">
                <span>Expected Delivery</span>
                <input
                  type="date"
                  value={formState.expectedDeliveryDate}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, expectedDeliveryDate: event.target.value }))
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
                  onChange={(event) => setFormState((current) => ({ ...current, taxAmount: event.target.value }))}
                  className="surface-input-soft"
                />
              </label>

              <label className="space-y-2 text-sm text-muted md:col-span-2">
                <span>Discount Amount</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={formState.discountAmount}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, discountAmount: event.target.value }))
                  }
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted md:col-span-2">
                <span>Approval Notes</span>
                <textarea
                  rows={2}
                  value={formState.approvalNotes}
                  onChange={(event) => setFormState((current) => ({ ...current, approvalNotes: event.target.value }))}
                  className="surface-textarea-soft"
                  placeholder="Approval instructions, requisition context, or supplier routing notes."
                />
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-border/70 bg-white/80 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Purchase Order Details</p>
              <p className="mt-1 text-xs text-muted">Capture delivery timing, tax, discounts, and notes before the order is reviewed and sent to the supplier.</p>
            </div>
            <label className="space-y-2 text-sm text-muted">
              <span>Notes</span>
              <textarea
                rows={3}
                value={formState.notes}
                onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
                className="surface-textarea-soft"
                placeholder="Supplier instructions, delivery notes, or approval context"
              />
            </label>
          </section>

          <section className="rounded-3xl border border-border/70 bg-white/75 p-4 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Line Items</p>
                <p className="mt-1 text-sm text-muted">Compact item entry for cleaner screens and faster review.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={appendLineItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

            <div className="mt-4 hidden rounded-2xl bg-cream/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted xl:grid xl:grid-cols-[minmax(0,2.2fr)_110px_120px_120px] xl:gap-3">
              <span>Item</span>
              <span>Qty</span>
              <span>Unit Cost</span>
              <span>UOM</span>
            </div>

            <div className="mt-3 space-y-3">
              {formState.items.map((item) => {
                const selectedMetaItem = purchaseOrderItems.find((candidate) => candidate.id === item.itemId) ?? null;

                return (
                <div
                  key={item.rowId}
                  className="relative z-10 overflow-visible rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,232,0.82))] p-4"
                >
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,2.2fr)_110px_120px_120px]">
                    <div className="relative z-30 space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted xl:hidden">
                        Item
                      </label>
                      <ItemSelectorField
                        disabled={!isDrawerOpen}
                        emptyMessage="No purchasable items available."
                        errorMessage={itemSelectorQuery.error instanceof Error ? itemSelectorQuery.error.message : null}
                        loading={itemSelectorQuery.isLoading}
                        options={purchaseOrderItems}
                        value={item.itemId}
                        onChange={(value) => updateLineItem(item.rowId, 'itemId', value)}
                        placeholder="Search item"
                      />
                      <div className="rounded-2xl border border-border/60 bg-white/90 px-3 py-2 text-xs text-muted">
                        {selectedMetaItem
                          ? `${selectedMetaItem.description ?? 'No saved item description.'}${selectedMetaItem.unitName ? ` | UOM: ${selectedMetaItem.unitName}` : ''}`
                          : 'Select an item to auto-fill the saved description, UOM, and default purchase price.'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted xl:hidden">
                        Qty
                      </label>
                      <input
                        min="0.001"
                        step="0.001"
                        type="number"
                        value={item.quantityOrdered}
                        onChange={(event) => updateLineItem(item.rowId, 'quantityOrdered', event.target.value)}
                        className="surface-input-soft"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted xl:hidden">
                        Unit Cost
                      </label>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={item.unitCost}
                        onChange={(event) => updateLineItem(item.rowId, 'unitCost', event.target.value)}
                        className="surface-input-soft"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted xl:hidden">
                        UOM
                      </label>
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

                  </div>

                  <div className="mt-2 flex justify-end">
                    <div className="w-full sm:w-[140px]">
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
                  <div className="mt-3 rounded-2xl border border-border/60 bg-white/90 px-3 py-2 text-xs text-muted">
                    {selectedMetaItem ? (
                      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                        <span>Default Price: {currencyFormatter.format(selectedMetaItem.currentInventoryCost ?? selectedMetaItem.sellingPrice ?? 0)}</span>
                        <span>Stock: {Number(selectedMetaItem.branchQuantity ?? selectedMetaItem.warehouseQuantity ?? 0).toFixed(3)}</span>
                        <span>Inventory Cost: {selectedMetaItem.currentInventoryCost === null ? 'n/a' : currencyFormatter.format(selectedMetaItem.currentInventoryCost)}</span>
                        <span>Selling Price: {selectedMetaItem.sellingPrice === null ? 'n/a' : currencyFormatter.format(selectedMetaItem.sellingPrice)}</span>
                        <span>Type: {selectedMetaItem.itemType.replaceAll('_', ' ')}</span>
                        <span>Category: {selectedMetaItem.categoryName ?? 'Uncategorized'}</span>
                        <span>Unit: {selectedMetaItem.unitAbbreviation ?? selectedMetaItem.unitName ?? 'Unit'}</span>
                      </div>
                    ) : (
                      'Live stock, reorder, and receipt context appears here after item selection.'
                    )}
                  </div>
                </div>
              )})}
            </div>
          </section>

          <section className="rounded-3xl border border-border/70 bg-white/80 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Approval And Audit Trail</p>
            <p className="mt-2 text-sm text-muted">
              The saved purchase order keeps the selected approver, creator, approval timestamps, supplier-send activity, and receiving/posting history visible for launch operations.
            </p>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Purchase Order</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
