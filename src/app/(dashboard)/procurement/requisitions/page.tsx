'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { DataTable, EmptyState, FilterBar, FormDrawer, StatusBadge } from '@/components/ui-library';
import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { TransactionShortcuts } from '@/components/procurement/transaction-shortcuts';
import { Button } from '@/components/ui/button';
import {
  useProcurementMeta,
  useProcurementRequest,
  useRequisitions,
  type RequisitionRow,
} from '@/hooks/procurement';
import { buildRequisitionDraftPayload } from '@/lib/procurement-requisitions';
import { API_ROUTES, PERMISSIONS } from '@/lib/shared';
import { usePermission } from '@/hooks/usePermission';

type RequisitionFormItem = {
  estimatedUnitCost: string;
  itemId: string;
  quantityRequested: string;
  rowId: string;
  unitOfMeasureId: string;
};

type RequisitionFormState = {
  approverEmail: string;
  approverName: string;
  approverUserId: string;
  approvalNotes: string;
  department: string;
  items: RequisitionFormItem[];
  neededByDate: string;
  remarks: string;
};

type RequisitionDetailResponse = {
  id: string;
  department: string;
  needed_by_date: string | null;
  remarks: string | null;
  approver_name?: string | null;
  approverName?: string | null;
  approver_email?: string | null;
  approverEmail?: string | null;
  approver_user_id: string | null;
  approval_notes?: string | null;
  approvalNotes?: string | null;
  purchase_requisition_items: Array<{
    id: string;
    item_id: string;
    itemId?: string | null;
    unit_of_measure_id: string;
    unitOfMeasureId?: string | null;
    quantity_requested: number | string;
    estimated_unit_cost: number | string | null;
  }>;
};

const initialFormState: RequisitionFormState = {
  approverEmail: '',
  approverName: '',
  approverUserId: '',
  approvalNotes: '',
  department: '',
  items: [buildEmptyLine()],
  neededByDate: '',
  remarks: '',
};

function statusVariant(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === 'draft') return 'warning' as const;
  if (normalized === 'submitted') return 'info' as const;
  if (['approved', 'level1_approved', 'po_created'].includes(normalized)) return 'success' as const;
  if (normalized === 'rejected') return 'error' as const;

  return 'neutral' as const;
}

function isApprovedStatus(status: string) {
  return ['approved', 'level1_approved', 'po_created'].includes(status.toLowerCase());
}

function formatDateLabel(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString();
}

function formatItemTypeLabel(value: string | null | undefined) {
  if (!value) return 'Item';
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatQuantityLabel(value: number | null | undefined) {
  return Number(value ?? 0).toFixed(3);
}

function getWorkflowCopy(row: RequisitionRow) {
  const normalizedStatus = (row.approvalStatus || row.status).toLowerCase();

  if (normalizedStatus === 'rejected') {
    return row.rejectedBy
      ? `Rejected by ${row.rejectedBy}${row.rejectedAt ? ` on ${formatDateLabel(row.rejectedAt)}` : ''}`
      : 'Rejected and waiting for revision.';
  }

  if (isApprovedStatus(normalizedStatus)) {
    return row.approvedBy
      ? `Approved by ${row.approvedBy}${row.approvedAt ? ` on ${formatDateLabel(row.approvedAt)}` : ''}`
      : 'Approved and ready for PO conversion.';
  }

  if (normalizedStatus === 'submitted') {
    return row.approverName
      ? `Waiting on ${row.approverName}`
      : 'Submitted and waiting for assigned approver.';
  }

  return row.approverName ? `Draft assigned to ${row.approverName}` : 'Draft waiting to be submitted.';
}

function buildEmptyLine(): RequisitionFormItem {
  return {
    estimatedUnitCost: '0',
    itemId: '',
    quantityRequested: '1',
    rowId:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `req-item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    unitOfMeasureId: '',
  };
}

export default function RequisitionsPage() {
  const canCreate = usePermission([PERMISSIONS.purchaseRequisition.create, 'procurement.write']);
  const canApprove = usePermission([PERMISSIONS.purchaseRequisition.approve, 'procurement.approve']);
  const [filters, setFilters] = useState({
    department: '',
    endDate: '',
    page: 1,
    pageSize: 10,
    startDate: '',
    status: '',
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRequisitionId, setEditingRequisitionId] = useState<string | null>(null);
  const [formState, setFormState] = useState<RequisitionFormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const request = useProcurementRequest();
  const metaQuery = useProcurementMeta();
  const requisitionsQuery = useRequisitions({
    department: filters.department || undefined,
    endDate: filters.endDate || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
    startDate: filters.startDate || undefined,
    status: filters.status || undefined,
  });

  const requisitions = requisitionsQuery.data?.data ?? [];
  const pagination = requisitionsQuery.data?.pagination;
  const itemOptions = metaQuery.data?.items ?? [];
  const unitOptions = metaQuery.data?.units ?? [];
  const itemLoadFailed = metaQuery.isError && itemOptions.length === 0;
  const unitLoadFailed = metaQuery.isError && unitOptions.length === 0;
  const selectedItems = formState.items.map(
    (item) => itemOptions.find((candidate) => candidate.id === item.itemId) ?? null,
  );

  function resetForm() {
    setEditingRequisitionId(null);
    setFormState(initialFormState);
    setFormError(null);
  }

  function openCreateDrawer() {
    resetForm();
    setIsDrawerOpen(true);
  }

  async function openEditDrawer(row: RequisitionRow) {
    setWorkspaceError(null);
    setFormError(null);
    setIsLoadingDraft(true);

    try {
      const detail = await request<RequisitionDetailResponse>(API_ROUTES.PROCUREMENT.REQUISITION(row.id));

      setEditingRequisitionId(row.id);
      setFormState({
        approverEmail: detail.approverEmail ?? detail.approver_email ?? '',
        approverName: detail.approverName ?? detail.approver_name ?? '',
        approverUserId: detail.approver_user_id ?? '',
        approvalNotes: detail.approvalNotes ?? detail.approval_notes ?? '',
        department: detail.department ?? '',
        items:
          detail.purchase_requisition_items.length > 0
            ? detail.purchase_requisition_items.map((item) => ({
                estimatedUnitCost: String(item.estimated_unit_cost ?? 0),
                itemId: item.itemId ?? item.item_id,
                quantityRequested: String(item.quantity_requested ?? 1),
                rowId: item.id,
                unitOfMeasureId: item.unitOfMeasureId ?? item.unit_of_measure_id,
              }))
            : [buildEmptyLine()],
        neededByDate: detail.needed_by_date ? String(detail.needed_by_date).slice(0, 10) : '',
        remarks: detail.remarks ?? '',
      });
      setIsDrawerOpen(true);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Failed to load requisition draft.');
    } finally {
      setIsLoadingDraft(false);
    }
  }

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['procurement'],
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const items = formState.items
      .filter((item) => item.itemId && item.unitOfMeasureId)
      .map((item) => ({
        estimatedUnitCost: Number(item.estimatedUnitCost),
        itemId: item.itemId,
        quantityRequested: Number(item.quantityRequested),
        unitOfMeasureId: item.unitOfMeasureId,
      }));

    if (!formState.department || !items.length) {
      setFormError('Department and at least one valid line item are required.');
      return;
    }

    if (items.some((item) => item.quantityRequested <= 0 || Number.isNaN(item.quantityRequested))) {
      setFormError('Each line item quantity must be greater than zero.');
      return;
    }

    if (items.some((item) => item.estimatedUnitCost < 0 || Number.isNaN(item.estimatedUnitCost))) {
      setFormError('Estimated unit cost cannot be negative.');
      return;
    }

    try {
      const payload = buildRequisitionDraftPayload({
        approverEmail: formState.approverEmail || null,
        approverName: formState.approverName || null,
        approverUserId: formState.approverUserId || null,
        approvalNotes: formState.approvalNotes || null,
        department: formState.department,
        items,
        neededByDate: formState.neededByDate || null,
        remarks: formState.remarks || null,
      });

      if (editingRequisitionId) {
        await request(API_ROUTES.PROCUREMENT.REQUISITION(editingRequisitionId), {
          body: JSON.stringify(payload),
          method: 'PATCH',
        });
      } else {
        await request(API_ROUTES.PROCUREMENT.REQUISITIONS, {
          body: JSON.stringify(payload),
          method: 'POST',
        });
      }

      resetForm();
      setWorkspaceError(null);
      setIsDrawerOpen(false);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save requisition.');
    }
  }

  async function runRowAction(id: string, action: 'approve' | 'reject' | 'submit') {
    setWorkspaceError(null);
    setActiveActionId(id);

    try {
      if (action === 'submit') {
        await request(`${API_ROUTES.PROCUREMENT.REQUISITION(id)}/submit`, {
          body: JSON.stringify({}),
          method: 'POST',
        });
      } else {
        const remarks =
          window.prompt(
            action === 'approve'
              ? 'Optional approval note for this requisition:'
              : 'Reason for rejecting this requisition:',
            action === 'approve'
              ? 'Approved from requisitions workspace.'
              : 'Rejected from requisitions workspace.',
          ) ?? '';

        if (action === 'reject' && !remarks.trim()) {
          throw new Error('A rejection reason is required.');
        }

        await request(`${API_ROUTES.PROCUREMENT.REQUISITION(id)}/${action}`, {
          body: JSON.stringify({ remarks: remarks.trim() || null }),
          method: 'POST',
        });
      }

      await refresh();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : `Failed to ${action} requisition.`);
    } finally {
      setActiveActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Requisitions"
        description="Capture internal purchase demand, route every request to the right approver, and keep the approval story visible from draft to PO."
        actions={
          canCreate ? (
            <Button type="button" size="sm" onClick={openCreateDrawer}>
              <Plus className="mr-2 h-4 w-4" />
              New Requisition
            </Button>
          ) : null
        }
      />

      <ProcurementNav />

      {workspaceError ? (
        <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {workspaceError}
        </div>
      ) : null}

      <FilterBar
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Draft', value: 'draft' },
              { label: 'Submitted', value: 'submitted' },
              { label: 'Approved', value: 'level1_approved' },
              { label: 'PO Created', value: 'po_created' },
              { label: 'Rejected', value: 'rejected' },
            ],
            type: 'select',
            value: filters.status,
          },
          {
            key: 'department',
            label: 'Department',
            options: (metaQuery.data?.departments ?? []).map((department) => ({
              label: department,
              value: department,
            })),
            type: 'select',
            value: filters.department,
          },
          {
            key: 'startDate',
            label: 'Start Date',
            type: 'date',
            value: filters.startDate,
          },
          {
            key: 'endDate',
            label: 'End Date',
            type: 'date',
            value: filters.endDate,
          },
        ]}
        onFilterChange={(key, value) =>
          setFilters((current) => ({
            ...current,
            [key]: value,
            page: 1,
          }))
        }
      />

      <DataTable<RequisitionRow>
        data={requisitions}
        loading={requisitionsQuery.isLoading}
        pagination={pagination}
        columns={[
          {
            key: 'requisitionNumber',
            header: 'Requisition',
            render: (row) => (
              <div className="space-y-1">
                <p className="font-medium text-foreground">{row.requisitionNumber}</p>
                <p className="text-xs text-muted">
                  Requested {formatDateLabel(row.requestDate) ?? '-'}
                  {row.neededByDate ? ` • Needed ${formatDateLabel(row.neededByDate)}` : ''}
                </p>
              </div>
            ),
          },
          {
            key: 'requestedBy',
            header: 'Requester',
            render: (row) => (
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{row.requestedBy}</p>
                <p className="text-xs text-muted">{row.department}</p>
              </div>
            ),
          },
          {
            key: 'approverName',
            header: 'Approval Route',
            render: (row) => (
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{row.approverName ?? 'Auto route to supervisor'}</p>
                <p className="text-xs text-muted">{getWorkflowCopy(row)}</p>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <div className="space-y-2">
                <StatusBadge
                  status={row.approvalStatus || row.status}
                  variant={statusVariant(row.approvalStatus || row.status)}
                />
                {row.remarks ? <p className="max-w-[240px] text-xs text-muted">{row.remarks}</p> : null}
              </div>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const status = row.status.toLowerCase();
              const isBusy = activeActionId === row.id;

              if (status === 'draft') {
                return (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void openEditDrawer(row)}
                      disabled={isLoadingDraft || isBusy}
                    >
                      Edit Draft
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void runRowAction(row.id, 'submit')}
                      disabled={isBusy}
                    >
                      {isBusy ? 'Submitting...' : 'Submit for Approval'}
                    </Button>
                  </div>
                );
              }

              if (status === 'submitted' && canApprove) {
                return (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void runRowAction(row.id, 'approve')}
                      disabled={isBusy}
                    >
                      {isBusy ? 'Working...' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void runRowAction(row.id, 'reject')}
                      disabled={isBusy}
                    >
                      {isBusy ? 'Working...' : 'Reject'}
                    </Button>
                  </div>
                );
              }

              if (isApprovedStatus(status)) {
                return (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/procurement/purchase-orders?requisitionId=${row.id}`}>Create PO</Link>
                  </Button>
                );
              }

              return <span className="text-sm text-muted">No actions</span>;
            },
          },
        ]}
        emptyState={
          <EmptyState
            icon={<Plus className="h-6 w-6" />}
            title="No requisitions found"
            description="Create the first requisition to begin procurement approvals."
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
              page,
            }))
          }
        />
      ) : null}

      <FormDrawer
        title={editingRequisitionId ? 'Edit Requisition Draft' : 'New Requisition'}
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          resetForm();
        }}
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Requisition Details</p>
              <p className="mt-1 text-xs text-muted">Capture the department need, due date, and internal context before you build the request lines.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-muted">
                <span>Department</span>
                <input
                  required
                  list="procurement-requisition-departments"
                  value={formState.department}
                  onChange={(event) => setFormState((current) => ({ ...current, department: event.target.value }))}
                  className="surface-input-soft"
                  placeholder="Production, Stores, Branch Operations..."
                />
                <datalist id="procurement-requisition-departments">
                  {(metaQuery.data?.departments ?? []).map((department) => (
                    <option key={department} value={department} />
                  ))}
                </datalist>
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Needed By Date</span>
                <input
                  type="date"
                  value={formState.neededByDate}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, neededByDate: event.target.value }))
                  }
                  className="surface-input-soft"
                />
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Approval Details</p>
              <p className="mt-1 text-xs text-muted">Assign an approver directly when the client wants named routing, or leave this blank for normal supervisor flow.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-muted md:col-span-2">
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
                      {approver.fullName}
                      {approver.role ? ` (${approver.role.replace(/_/g, ' ')})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted">
                  Pick a named approver when available, or leave this blank and capture manual approval contact details below.
                </p>
              </label>
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
              <label className="space-y-2 text-sm text-muted md:col-span-2">
                <span>Approval notes</span>
                <textarea
                  rows={2}
                  value={formState.approvalNotes}
                  onChange={(event) => setFormState((current) => ({ ...current, approvalNotes: event.target.value }))}
                  className="surface-textarea-soft"
                  placeholder="Escalation path, approval context, or fallback approver instructions."
                />
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border/70 bg-white/80 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Notes And Attachments</p>
              <p className="mt-1 text-xs text-muted">Use remarks to explain urgency, quality expectations, or supplier guidance for the approver and buyer.</p>
            </div>
            <label className="space-y-2 text-sm text-muted">
              <span>Remarks</span>
              <textarea
                rows={3}
                value={formState.remarks}
                onChange={(event) => setFormState((current) => ({ ...current, remarks: event.target.value }))}
                className="surface-textarea-soft"
                placeholder="Add context for what is needed, urgency, or supplier guidance."
              />
            </label>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-cream/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Requested Items</p>
                <p className="text-sm text-muted">
                  Select an item first. Unit of measure and item details will populate from the item master.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <TransactionShortcuts
                  allowSupplier={false}
                  onItemCreated={(createdItem) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === current.items.length - 1 && !row.itemId
                          ? {
                              ...row,
                              estimatedUnitCost: String(createdItem.unitCost ?? 0),
                              itemId: createdItem.id,
                              unitOfMeasureId: createdItem.unitOfMeasureId,
                            }
                          : row,
                      ),
                    }))
                  }
                  onUomCreated={(createdUnit) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === current.items.length - 1 && !row.unitOfMeasureId
                          ? { ...row, unitOfMeasureId: createdUnit.id }
                          : row,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setFormState((current) => ({
                      ...current,
                      items: [...current.items, buildEmptyLine()],
                    }))
                  }
                >
                  Add Item
                </Button>
              </div>
            </div>

            {formState.items.map((item, index) => {
              const selectedItem = selectedItems[index];

              return (
                <article
                  key={item.rowId}
                  className="space-y-4 rounded-3xl border border-border/70 bg-white/90 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        Item
                      </label>
                      <select
                        value={item.itemId}
                        onChange={(event) => {
                          const nextSelectedItem = itemOptions.find((candidate) => candidate.id === event.target.value);
                          setFormState((current) => ({
                            ...current,
                            items: current.items.map((row, rowIndex) =>
                              rowIndex === index
                                ? {
                                    ...row,
                                    itemId: event.target.value,
                                    unitOfMeasureId: nextSelectedItem?.unitOfMeasureId ?? row.unitOfMeasureId,
                                  }
                                : row,
                            ),
                          }));
                        }}
                        className="surface-input-soft min-w-0"
                        disabled={metaQuery.isLoading || itemLoadFailed || itemOptions.length === 0}
                      >
                        <option value="">
                          {metaQuery.isLoading
                            ? 'Loading items...'
                            : itemLoadFailed
                              ? 'Items unavailable'
                              : itemOptions.length === 0
                                ? 'No items found'
                                : 'Select item'}
                        </option>
                        {item.itemId && !itemOptions.some((candidate) => candidate.id === item.itemId) ? (
                          <option value={item.itemId}>Saved item selection</option>
                        ) : null}
                        {itemOptions.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.label ?? (row.code ? `${row.code} - ${row.name}` : row.name)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {selectedItem?.code ? (
                        <span className="rounded-full border border-border/70 bg-cream/70 px-3 py-1 text-xs font-semibold text-brown">
                          {selectedItem.code}
                        </span>
                      ) : null}
                      {selectedItem?.itemType ? (
                        <span className="rounded-full border border-border/70 bg-white px-3 py-1 text-xs text-muted">
                          {formatItemTypeLabel(selectedItem.itemType)}
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setFormState((current) => ({
                            ...current,
                            items:
                              current.items.length === 1
                                ? current.items
                                : current.items.filter((_, rowIndex) => rowIndex !== index),
                          }))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>

                  {itemLoadFailed ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white px-3 py-3 text-sm text-muted">
                      <span>Unable to load items right now. Please refresh and try again.</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void metaQuery.refetch()}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : !metaQuery.isLoading && itemOptions.length === 0 ? (
                    <div className="rounded-2xl border border-border/60 bg-white px-3 py-3 text-sm text-muted">
                      No items found. Create an item first.
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-2 text-sm text-muted">
                      <span>Quantity</span>
                      <input
                        min="0.001"
                        step="0.001"
                        type="number"
                        value={item.quantityRequested}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            items: current.items.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, quantityRequested: event.target.value } : row,
                            ),
                          }))
                        }
                        className="surface-input-soft"
                        placeholder="Qty"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-muted">
                      <span>Unit of Measure</span>
                      <select
                        value={item.unitOfMeasureId}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            items: current.items.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, unitOfMeasureId: event.target.value } : row,
                            ),
                          }))
                        }
                        className="surface-input-soft"
                        disabled={metaQuery.isLoading || unitLoadFailed || unitOptions.length === 0}
                      >
                        <option value="">
                          {metaQuery.isLoading
                            ? 'Loading units...'
                            : unitLoadFailed
                              ? 'Units unavailable'
                              : unitOptions.length === 0
                                ? 'No units found'
                                : 'Select UOM'}
                        </option>
                        {unitOptions.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.label ?? row.symbol ?? row.code ?? row.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-muted">
                      <span>Estimated Unit Price</span>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={item.estimatedUnitCost}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            items: current.items.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, estimatedUnitCost: event.target.value } : row,
                            ),
                          }))
                        }
                        className="surface-input-soft"
                        placeholder="Unit Cost"
                      />
                    </label>
                  </div>

                  {unitLoadFailed ? (
                    <div className="rounded-2xl border border-border/60 bg-white px-3 py-3 text-sm text-muted">
                      Unable to load units of measurement right now. Please refresh and try again.
                    </div>
                  ) : !metaQuery.isLoading && unitOptions.length === 0 ? (
                    <div className="rounded-2xl border border-border/60 bg-white px-3 py-3 text-sm text-muted">
                      No units of measurement found. Create units first.
                    </div>
                  ) : null}

                  <section className="space-y-3 rounded-2xl border border-border/60 bg-cream/40 p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange">Item Details</p>
                      <p className="mt-1 text-sm text-muted">
                        {selectedItem
                          ? 'Review the selected item description, unit, and warehouse context before saving the requisition.'
                          : 'Select an item to view stock, unit, and warehouse details.'}
                      </p>
                    </div>

                    {selectedItem ? (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div className="min-w-0 rounded-2xl border border-border/60 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Description</p>
                          <p className="mt-2 break-words text-sm text-foreground">
                            {selectedItem.description || 'Not set'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Item Type</p>
                          <p className="mt-2 text-sm text-foreground">{formatItemTypeLabel(selectedItem.itemType)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Unit Of Measure</p>
                          <p className="mt-2 text-sm text-foreground">
                            {selectedItem.unitOfMeasureName ?? selectedItem.uomName ?? selectedItem.unit_of_measure_name ?? 'Not set'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Estimated Price</p>
                          <p className="mt-2 text-sm text-foreground">{item.estimatedUnitCost || '0'}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Stock On Hand</p>
                          <p className="mt-2 text-sm text-foreground">{formatQuantityLabel(selectedItem.inventory.currentStock)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">On Order</p>
                          <p className="mt-2 text-sm text-foreground">{formatQuantityLabel(selectedItem.inventory.quantityOnOrder)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Received Today</p>
                          <p className="mt-2 text-sm text-foreground">{formatQuantityLabel(selectedItem.inventory.quantityReceivedToday)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Reorder Level</p>
                          <p className="mt-2 text-sm text-foreground">{formatQuantityLabel(selectedItem.inventory.reorderLevel)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Store / Warehouse</p>
                          <p className={`mt-2 break-words text-sm ${selectedItem.inventory.isLowStock ? 'font-semibold text-rose-700' : 'text-foreground'}`}>
                            {selectedItem.inventory.primaryWarehouseName ?? 'Not set'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white px-3 py-3 md:col-span-2 xl:col-span-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Last Receipt</p>
                          <p className="mt-2 text-sm text-foreground">
                            {selectedItem.inventory.lastReceivedDate
                              ? new Date(selectedItem.inventory.lastReceivedDate).toLocaleDateString()
                              : 'Not set'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border bg-white px-4 py-4 text-sm text-muted">
                        Select an item to view stock, unit, and warehouse details.
                      </div>
                    )}
                  </section>
                </article>
              );
            })}
          </section>

          <section className="rounded-2xl border border-border/70 bg-white/80 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Audit Trail</p>
            <p className="mt-2 text-sm text-muted">
              Created by, approval history, and later status changes appear on the requisition row after the draft is saved.
            </p>
          </section>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDrawerOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoadingDraft}>
              {editingRequisitionId ? 'Save Draft Changes' : 'Create Requisition'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
