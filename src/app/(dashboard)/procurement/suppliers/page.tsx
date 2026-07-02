'use client';

import Link from 'next/link';
import { Download, Paperclip, Plus, Power, PowerOff, Truck, Upload } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';
import { z } from 'zod';

import { DataTable, EmptyState, FilterBar, FormDrawer, StatusBadge } from '@/components/ui-library';
import { importFromCsv } from '@/lib/export';
import { API_ROUTES, PERMISSIONS } from '@/lib/shared';

import { PageHeader } from '@/components/dashboard/page-header';
import { PaginationControls } from '@/components/inventory/pagination-controls';
import { ProcurementNav } from '@/components/procurement/procurement-nav';
import { createClient, hasSupabaseClientEnv } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  useCreateSupplier,
  useProcurementRequest,
  useSupplierCategories,
  useSuppliers,
  useUpdateSupplier,
  type SupplierRow
} from '@/hooks/procurement';
import { usePermission } from '@/hooks/usePermission';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  minimumFractionDigits: 2,
  style: 'currency'
});

const supplierFormSchema = z.object({
  address: z.string().optional(),
  categoryId: z.string().optional(),
  code: z.string().optional(),
  contactPerson: z.string().optional(),
  creditLimit: z.coerce.number().nonnegative(),
  documentName: z.string().optional(),
  documentUrl: z.string().url().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  name: z.string().min(1),
  paymentTerms: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']),
  taxNumber: z.string().optional()
});

const initialFormState = {
  address: '',
  categoryId: '',
  code: '',
  contactPerson: '',
  creditLimit: '0',
  documentName: '',
  documentUrl: '',
  email: '',
  name: '',
  paymentTerms: '',
  phone: '',
  status: 'ACTIVE',
  taxNumber: ''
};

export default function SuppliersPage() {
  const canCreate = usePermission([PERMISSIONS.supplier.create, 'procurement.supplier.write', 'procurement.write']);
  const canUpdate = usePermission([PERMISSIONS.supplier.update, 'procurement.supplier.write', 'procurement.write']);
  const canImport = usePermission(['procurement.supplier.import', 'procurement.supplier.write', 'procurement.write']);
  const request = useProcurementRequest();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState({
    categoryId: '',
    page: 1,
    pageSize: 10,
    search: '',
    status: ''
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null);
  const [formState, setFormState] = useState(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  const suppliersQuery = useSuppliers({
    categoryId: filters.categoryId || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
    search: filters.search || undefined,
    status: filters.status || undefined
  });
  const categoriesQuery = useSupplierCategories();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier(editingSupplier?.id);

  const suppliers = suppliersQuery.data?.data ?? [];
  const pagination = suppliersQuery.data?.pagination;

  function openCreateDrawer() {
    setEditingSupplier(null);
    setFormState(initialFormState);
    setFormError(null);
    setIsDrawerOpen(true);
  }

  function openEditDrawer(row: SupplierRow) {
    setEditingSupplier(row);
    setFormState({
      address: row.address ?? '',
      categoryId: row.category?.id ?? '',
      code: row.code,
      contactPerson: row.contactPerson ?? '',
      creditLimit: String(row.creditLimit ?? 0),
      documentName: row.documentName ?? '',
      documentUrl: row.documentUrl ?? '',
      email: row.email ?? '',
      name: row.name,
      paymentTerms: row.paymentTerms ?? '',
      phone: row.phone ?? '',
      status: row.status,
      taxNumber: row.taxNumber ?? ''
    });
    setFormError(null);
    setIsDrawerOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = supplierFormSchema.safeParse(formState);

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please review the form.');
      return;
    }

    const payload = {
      address: parsed.data.address || null,
      categoryId: parsed.data.categoryId || undefined,
      code: parsed.data.code || undefined,
      contactPerson: parsed.data.contactPerson || null,
      creditLimit: parsed.data.creditLimit,
      documentName: parsed.data.documentName || null,
      documentUrl: parsed.data.documentUrl || null,
      email: parsed.data.email || null,
      name: parsed.data.name,
      paymentTerms: parsed.data.paymentTerms || null,
      phone: parsed.data.phone || null,
      status: parsed.data.status,
      taxNumber: parsed.data.taxNumber || null
    };

    try {
      if (editingSupplier) {
        await updateSupplier.mutateAsync(payload);
      } else {
        await createSupplier.mutateAsync(payload);
      }

      setIsDrawerOpen(false);
      setEditingSupplier(null);
      setFormState(initialFormState);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save supplier.');
    }
  }

  async function handleDocumentUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!hasSupabaseClientEnv()) {
      setFormError('Supabase storage is not configured here. Paste the supplier document URL manually.');
      return;
    }

    setIsUploadingDocument(true);
    setFormError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('You must be signed in to upload supplier documents.');

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const filePath = `icecream_erp/suppliers/${user.id}/${Date.now()}-${safeFileName}`;
      const { error: uploadError } = await supabase.storage
        .from('procurement-documents')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from('procurement-documents').getPublicUrl(filePath);

      setFormState((current) => ({
        ...current,
        documentName: file.name,
        documentUrl: publicUrl,
      }));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to upload supplier document.');
    } finally {
      setIsUploadingDocument(false);
      if (documentInputRef.current) {
        documentInputRef.current.value = '';
      }
    }
  }

  async function handleToggleStatus(row: SupplierRow) {
    setImportError(null);
    setImportMessage(null);

    try {
      await request(
        row.status === 'ACTIVE'
          ? API_ROUTES.PROCUREMENT.SUPPLIER_DEACTIVATE(row.id)
          : API_ROUTES.PROCUREMENT.SUPPLIER_ACTIVATE(row.id),
        { method: 'POST' },
      );
      await suppliersQuery.refetch();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to update supplier status.');
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    setImportMessage(null);

    try {
      const rows = await importFromCsv(file);
      const response = await request<{ created: number }>(API_ROUTES.PROCUREMENT.IMPORT_SUPPLIERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, rows }),
      });

      setImportMessage(`Supplier import completed. ${response.created} suppliers created.`);
      await suppliersQuery.refetch();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Supplier import failed.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage supplier master data, contacts, payment terms, and exposure balances for procurement."
        actions={
          <div className="flex flex-wrap gap-2">
            {canImport ? (
              <>
                <Button asChild type="button" size="sm" variant="outline">
                  <a href={API_ROUTES.PROCUREMENT.IMPORT_SUPPLIERS_TEMPLATE}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                  </a>
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isImporting ? 'Importing...' : 'Import CSV'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </>
            ) : null}
            {canCreate ? (
              <Button type="button" size="sm" onClick={openCreateDrawer}>
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
            ) : null}
          </div>
        }
      />

      <ProcurementNav />

      {importMessage ? (
        <div className="rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
          {importMessage}
        </div>
      ) : null}

      {importError ? (
        <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {importError}
        </div>
      ) : null}

      <FilterBar
        filters={[
          {
            key: 'search',
            label: 'Search',
            placeholder: 'Code, name, or contact',
            type: 'search',
            value: filters.search
          },
          {
            key: 'categoryId',
            label: 'Category',
            options:
              (categoriesQuery.data ?? []).map((category) => ({
                label: category.name,
                value: category.id
              })) ?? [],
            type: 'select',
            value: filters.categoryId
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Inactive', value: 'INACTIVE' },
              { label: 'Blacklisted', value: 'BLACKLISTED' }
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

      <DataTable<SupplierRow>
        data={suppliers}
        loading={suppliersQuery.isLoading}
        pagination={pagination}
        columns={[
          { key: 'code', header: 'Code' },
          { key: 'name', header: 'Name' },
          {
            key: 'category',
            header: 'Category',
            render: (row) => row.category?.name ?? 'General'
          },
          {
            key: 'contactPerson',
            header: 'Contact',
            render: (row) => row.contactPerson || '-'
          },
          {
            key: 'phone',
            header: 'Phone',
            render: (row) => row.phone || '-'
          },
          {
            key: 'creditLimit',
            header: 'Credit Limit',
            render: (row) => currencyFormatter.format(row.creditLimit)
          },
          {
            key: 'paymentTerms',
            header: 'Payment Terms',
            render: (row) => row.paymentTerms || '-'
          },
          {
            key: 'document',
            header: 'Document',
            render: (row) =>
              row.documentUrl ? (
                <a
                  href={row.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-orange underline-offset-4 hover:underline"
                >
                  {row.documentName || 'Open document'}
                </a>
              ) : (
                '-'
              )
          },
          {
            key: 'balance',
            header: 'Balance',
            render: (row) => currencyFormatter.format(row.currentBalance)
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={row.status} />
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/procurement/suppliers/${row.id}`}>View</Link>
                </Button>
                {canUpdate ? (
                  <Button size="sm" variant="outline" onClick={() => openEditDrawer(row)}>
                    Edit
                  </Button>
                ) : null}
                {canUpdate ? (
                  <Button size="sm" variant="outline" onClick={() => void handleToggleStatus(row)}>
                    {row.status === 'ACTIVE' ? (
                      <>
                        <PowerOff className="mr-2 h-4 w-4" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Power className="mr-2 h-4 w-4" />
                        Activate
                      </>
                    )}
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/procurement/suppliers/${row.id}?tab=purchase_orders`}>Purchase History</Link>
                </Button>
              </div>
            )
          }
        ]}
        emptyState={
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="No suppliers found"
            description="Create your supplier master records to start requisition and purchase order workflows."
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

      <FormDrawer
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-muted">
              <span>Code</span>
              <input
                value={formState.code}
                onChange={(event) => setFormState((current) => ({ ...current, code: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Name</span>
              <input
                required
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Category</span>
              <select
                value={formState.categoryId}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, categoryId: event.target.value }))
                }
                className="surface-input-soft"
              >
                <option value="">General / uncategorized</option>
                {(categoriesQuery.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Contact Person</span>
              <input
                value={formState.contactPerson}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, contactPerson: event.target.value }))
                }
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Phone</span>
              <input
                value={formState.phone}
                onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Email</span>
              <input
                type="email"
                value={formState.email}
                onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Tax Number</span>
              <input
                value={formState.taxNumber}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, taxNumber: event.target.value }))
                }
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Payment Terms</span>
              <input
                value={formState.paymentTerms}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, paymentTerms: event.target.value }))
                }
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Credit Limit</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={formState.creditLimit}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, creditLimit: event.target.value }))
                }
                className="surface-input-soft"
              />
            </label>
            <label className="space-y-2 text-sm text-muted">
              <span>Status</span>
              <select
                value={formState.status}
                onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}
                className="surface-input-soft"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="BLACKLISTED">BLACKLISTED</option>
              </select>
            </label>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-cream/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">Supplier Document</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => documentInputRef.current?.click()}
                disabled={isUploadingDocument}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploadingDocument ? 'Uploading...' : 'Upload Document'}
              </Button>
              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleDocumentUpload}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-muted">
                <span>Document Name</span>
                <input
                  value={formState.documentName}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, documentName: event.target.value }))
                  }
                  className="surface-input-soft"
                />
              </label>
              <label className="space-y-2 text-sm text-muted">
                <span>Document URL</span>
                <input
                  value={formState.documentUrl}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, documentUrl: event.target.value }))
                  }
                  placeholder="https://..."
                  className="surface-input-soft"
                />
              </label>
            </div>
            {formState.documentUrl ? (
              <a
                href={formState.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-orange underline-offset-4 hover:underline"
              >
                <Paperclip className="h-4 w-4" />
                {formState.documentName || 'Open current document'}
              </a>
            ) : null}
          </div>

          <label className="space-y-2 text-sm text-muted">
            <span>Address</span>
            <textarea
              rows={3}
              value={formState.address}
              onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))}
              className="surface-textarea-soft"
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSupplier.isPending || updateSupplier.isPending}>
              {createSupplier.isPending || updateSupplier.isPending ? 'Saving...' : 'Save Supplier'}
            </Button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
