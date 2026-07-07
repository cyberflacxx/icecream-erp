'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { DataTable, EmptyState, FilterBar, FormDrawer, StatusBadge } from '@/components/ui-library';
import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { Button } from '@/components/ui/button';
import {
  useProcurementMeta,
  useProcurementRequest,
  useRequisitions,
  type RequisitionRow,
} from '@/hooks/procurement';
import { API_ROUTES, PERMISSIONS } from '@/lib/shared';
import { usePermission } from '@/hooks/usePermission';

type RequisitionFormItem = {
  estimatedUnitCost: string;
  itemId: string;
  quantityRequested: string;
  unitOfMeasureId: string;
};

type RequisitionFormState = {
  approverUserId: string;
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
  approver_user_id: string | null;
  purchase_requisition_items: Array<{
    id: string;
    item_id: string;
    unit_of_measure_id: string;
    quantity_requested: number | string;
    estimated_unit_cost: number | string | null;
  }>;
};

const initialFormState: RequisitionFormState = {
  approverUserId: '',
  department: '',
  items: [
    {
      estimatedUnitCost: '0',
      itemId: '',
      quantityRequested: '1',
      unitOfMeasureId: '',
    },
  ],
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
  const selectedItems = formState.items.map(
    (item) => metaQuery.data?.items.find((candidate) => candidate.id === item.itemId) ?? null,
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
        approverUserId: detail.approver_user_id ?? '',
        department: detail.department ?? '',
        items:
          detail.purchase_requisition_items.length > 0
            ? detail.purchase_requisition_items.map((item) => ({
                estimatedUnitCost: String(item.estimated_unit_cost ?? 0),
                itemId: item.item_id,
                quantityRequested: String(item.quantity_requested ?? 1),
                unitOfMeasureId: item.unit_of_measure_id,
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
      const payload = {
        approverUserId: formState.approverUserId || null,
        department: formState.department,
        items,
        neededByDate: formState.neededByDate || null,
        remarks: formState.remarks || null,
      };

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
            options:
              (metaQuery.data?.departments ?? []).map((department) => ({
                label: department,
                value: department,
              })) ?? [],
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
            <label className="space-y-2 text-sm text-muted sm:col-span-2">
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
                Pick a named approver when the client wants direct routing, or leave this blank for normal supervisor flow.
              </p>
            </label>
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

          <div className="space-y-3 rounded-2xl border border-border bg-cream/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Line Items</p>
                <p className="text-xs text-muted">
                  Select the item first so the unit of measure and item context fall into place cleanly.
                </p>
              </div>
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

            {formState.items.map((item, index) => (
              <div key={`${item.itemId}-${index}`} className="rounded-2xl border border-border/70 bg-white/80 p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_120px_140px_140px_auto]">
                  <div className="space-y-2">
                    <select
                      value={item.itemId}
                      onChange={(event) => {
                        const selectedItem = metaQuery.data?.items.find(
                          (candidate) => candidate.id === event.target.value,
                        );
                        setFormState((current) => ({
                          ...current,
                          items: current.items.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  itemId: event.target.value,
                                  unitOfMeasureId: selectedItem?.unitOfMeasureId ?? row.unitOfMeasureId,
                                }
                              : row,
                          ),
                        }));
                      }}
                      className="surface-input-soft"
                    >
                      <option value="">Select item</option>
                      {(metaQuery.data?.items ?? []).map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.code} - {row.name}
                        </option>
                      ))}
                    </select>
                    <div className="rounded-xl border border-border/60 bg-cream/50 px-3 py-2 text-xs text-muted">
                      {selectedItems[index]
                        ? `${selectedItems[index]?.itemType?.replace(/_/g, ' ') ?? 'Item'}${selectedItems[index]?.description ? ` • ${selectedItems[index]?.description}` : ''}`
                        : 'Select an item to show its type and description.'}
                    </div>
                    <div className="rounded-xl border border-border/60 bg-white/90 px-3 py-2 text-xs text-muted">
                      {selectedItems[index] ? (
                        <div className="grid gap-1 sm:grid-cols-2">
                          <span>Current: {selectedItems[index].inventory.currentStock.toFixed(3)}</span>
                          <span>Reorder: {selectedItems[index].inventory.reorderLevel.toFixed(3)}</span>
                          <span>On Order: {selectedItems[index].inventory.quantityOnOrder.toFixed(3)}</span>
                          <span>Received Today: {selectedItems[index].inventory.quantityReceivedToday.toFixed(3)}</span>
                          <span>
                            Last Receipt: {selectedItems[index].inventory.lastReceivedDate ? new Date(selectedItems[index].inventory.lastReceivedDate).toLocaleDateString() : 'None'}
                          </span>
                          <span className={selectedItems[index].inventory.isLowStock ? 'font-semibold text-rose-700' : ''}>
                            Store: {selectedItems[index].inventory.primaryWarehouseName ?? 'No balance'}
                          </span>
                        </div>
                      ) : (
                        'Live stock, reorder, and receipt context appears here after item selection.'
                      )}
                    </div>
                  </div>
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
                  >
                    <option value="">UOM</option>
                    {(metaQuery.data?.units ?? []).map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.abbreviation}
                      </option>
                    ))}
                  </select>
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
            ))}
          </div>

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
