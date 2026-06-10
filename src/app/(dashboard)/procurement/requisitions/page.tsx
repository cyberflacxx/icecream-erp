'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { DataTable, EmptyState, FilterBar, FormDrawer, StatusBadge } from '@/components/ui-library';
import { PERMISSIONS } from '@/lib/shared';

import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { Button } from '@/components/ui/button';
import {
  useProcurementMeta,
  useProcurementRequest,
  useRequisitions,
  type RequisitionRow
} from '@/hooks/procurement';
import { usePermission } from '@/hooks/usePermission';

const initialFormState = {
  department: '',
  items: [
    {
      estimatedUnitCost: '0',
      itemId: '',
      quantityRequested: '1',
      unitOfMeasureId: ''
    }
  ],
  neededByDate: '',
  remarks: ''
};

function statusVariant(status: string) {
  if (status === 'DRAFT') {
    return 'warning' as const;
  }

  if (status === 'SUBMITTED') {
    return 'info' as const;
  }

  if (status === 'APPROVED') {
    return 'success' as const;
  }

  if (status === 'REJECTED') {
    return 'error' as const;
  }

  return 'neutral' as const;
}

export default function RequisitionsPage() {
  const canCreate = usePermission(PERMISSIONS.purchaseRequisition.create);
  const canApprove = usePermission(PERMISSIONS.purchaseOrder.approve);
  const [filters, setFilters] = useState({
    department: '',
    endDate: '',
    page: 1,
    pageSize: 10,
    startDate: '',
    status: ''
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const request = useProcurementRequest();
  const metaQuery = useProcurementMeta();
  const requisitionsQuery = useRequisitions({
    department: filters.department || undefined,
    endDate: filters.endDate || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
    startDate: filters.startDate || undefined,
    status: filters.status || undefined
  });

  const requisitions = requisitionsQuery.data?.data ?? [];
  const pagination = requisitionsQuery.data?.pagination;

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['procurement']
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
        unitOfMeasureId: item.unitOfMeasureId
      }));

    if (!formState.department || !items.length) {
      setFormError('Department and at least one valid line item are required.');
      return;
    }

    if (items.some((item) => item.quantityRequested <= 0 || Number.isNaN(item.quantityRequested))) {
      setFormError('Each line item quantity must be greater than zero.');
      return;
    }

    try {
      await request('/api/procurement/requisitions', {
        body: JSON.stringify({
          department: formState.department,
          items,
          neededByDate: formState.neededByDate || null,
          remarks: formState.remarks || null
        }),
        method: 'POST'
      });

      setFormState(initialFormState);
      setFormError(null);
      setIsDrawerOpen(false);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create requisition.');
    }
  }

  async function submitRequisition(id: string) {
    await request(`/api/procurement/requisitions/${id}/submit`, {
      body: JSON.stringify({}),
      method: 'POST'
    });
    await refresh();
  }

  async function approveRequisition(id: string) {
    await request(`/api/procurement/requisitions/${id}/approve`, {
      body: JSON.stringify({ remarks: 'Approved from requisitions workspace.' }),
      method: 'POST'
    });
    await refresh();
  }

  async function rejectRequisition(id: string) {
    await request(`/api/procurement/requisitions/${id}/reject`, {
      body: JSON.stringify({ remarks: 'Rejected from requisitions workspace.' }),
      method: 'POST'
    });
    await refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Requisitions"
        description="Capture internal purchase demand, route for approval, and convert approved requests into purchase orders."
        actions={
          canCreate ? (
            <Button type="button" size="sm" onClick={() => setIsDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Requisition
            </Button>
          ) : null
        }
      />

      <ProcurementNav />

      <FilterBar
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'DRAFT', value: 'DRAFT' },
              { label: 'SUBMITTED', value: 'SUBMITTED' },
              { label: 'APPROVED', value: 'APPROVED' },
              { label: 'REJECTED', value: 'REJECTED' }
            ],
            type: 'select',
            value: filters.status
          },
          {
            key: 'department',
            label: 'Department',
            options:
              (metaQuery.data?.departments ?? []).map((department) => ({
                label: department,
                value: department
              })) ?? [],
            type: 'select',
            value: filters.department
          },
          {
            key: 'startDate',
            label: 'Start Date',
            type: 'date',
            value: filters.startDate
          },
          {
            key: 'endDate',
            label: 'End Date',
            type: 'date',
            value: filters.endDate
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

      <DataTable<RequisitionRow>
        data={requisitions}
        loading={requisitionsQuery.isLoading}
        pagination={pagination}
        columns={[
          { key: 'requisitionNumber', header: 'Req #' },
          { key: 'requestedBy', header: 'Requested By' },
          { key: 'department', header: 'Department' },
          {
            key: 'requestDate',
            header: 'Request Date',
            render: (row) => new Date(row.requestDate).toLocaleDateString()
          },
          {
            key: 'neededByDate',
            header: 'Needed By',
            render: (row) =>
              row.neededByDate ? new Date(row.neededByDate).toLocaleDateString() : '-'
          },
          {
            key: 'status',
            header: 'Status Badge',
            render: (row) => <StatusBadge status={row.status} variant={statusVariant(row.status)} />
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const status = row.status;
              const id = row.id;

              if (status === 'DRAFT') {
                return (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => submitRequisition(id)}>
                      Submit
                    </Button>
                    <Button size="sm" variant="outline">
                      Delete
                    </Button>
                  </div>
                );
              }

              if (status === 'SUBMITTED' && canApprove) {
                return (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => approveRequisition(id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rejectRequisition(id)}>
                      Reject
                    </Button>
                  </div>
                );
              }

              if (status === 'APPROVED') {
                return (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/procurement/purchase-orders?requisitionId=${id}`}>Create PO</Link>
                  </Button>
                );
              }

              return <span className="text-sm text-muted">No actions</span>;
            }
          }
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
              page
            }))
          }
        />
      ) : null}

      <FormDrawer title="New Requisition" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
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
                value={formState.department}
                onChange={(event) => setFormState((current) => ({ ...current, department: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Needed By Date</span>
              <input
                type="date"
                value={formState.neededByDate}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, neededByDate: event.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-border bg-cream px-4 text-brown outline-none"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Remarks</span>
            <textarea
              rows={3}
              value={formState.remarks}
              onChange={(event) => setFormState((current) => ({ ...current, remarks: event.target.value }))}
              className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-brown outline-none"
            />
          </label>

          <div className="space-y-3 rounded-2xl border border-border bg-cream/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Line Items</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setFormState((current) => ({
                    ...current,
                    items: [
                      ...current.items,
                      { estimatedUnitCost: '0', itemId: '', quantityRequested: '1', unitOfMeasureId: '' }
                    ]
                  }))
                }
              >
                Add Item
              </Button>
            </div>
            {formState.items.map((item, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[1fr_120px_140px_140px_auto]">
                <select
                  value={item.itemId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, itemId: event.target.value } : row,
                      )
                    }))
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
                >
                  <option value="">Select item</option>
                  {(metaQuery.data?.items ?? []).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.code} - {row.name}
                    </option>
                  ))}
                </select>
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
                      )
                    }))
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
                />
                <select
                  value={item.unitOfMeasureId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      items: current.items.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, unitOfMeasureId: event.target.value } : row,
                      )
                    }))
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
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
                      )
                    }))
                  }
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-brown outline-none"
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
                          : current.items.filter((_, rowIndex) => rowIndex !== index)
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Requisition</Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
