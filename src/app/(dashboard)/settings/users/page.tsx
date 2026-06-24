'use client';

import { useMemo, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';

import { DataTable, EmptyState, FilterBar, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Button } from '@/components/ui/button';
import {
  useAssignableRoles,
  useAssignUserRoles,
  useCreateUser,
  useDeleteUser,
  useSettingsCollection,
  useUpdateUserStatus,
  useUsers,
} from '@/hooks/settings/useSettings';

interface UserRow {
  id: string;
  workId: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  roles: Array<{ id: string; name: string }>;
  branch: { id: string; name: string } | null;
}

const inputClass =
  'h-11 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none focus:border-orange dark:border-darkBorder dark:bg-darkCard dark:text-darkText';

export default function SettingsUsersPage() {
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 20,
    search: '',
    status: '',
  });

  const usersQuery = useUsers(filters);
  const rolesQuery = useAssignableRoles();
  const branchesQuery = useSettingsCollection('/api/settings/branches');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createdWorkId, setCreatedWorkId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    idNumber: '',
    roleId: '',
    branchId: '',
  });

  const createUser = useCreateUser();

  const users = (usersQuery.data?.data ?? []) as UserRow[];
  const roles = useMemo(
    () =>
      (rolesQuery.data ?? []).map((role) => ({
        id: role.id,
        name: role.name,
      })),
    [rolesQuery.data],
  );
  const branches = useMemo(
    () =>
      ((branchesQuery.data ?? []) as Array<Record<string, unknown>>).map((branch) => ({
        id: String(branch.id),
        label: `${String(branch.code ?? '')} - ${String(branch.name ?? '')}`,
      })),
    [branchesQuery.data],
  );

  function resetForm() {
    setForm({ firstName: '', lastName: '', email: '', idNumber: '', roleId: '', branchId: '' });
    setCreatedWorkId(null);
    setErrorMessage(null);
  }

  function handleClose() {
    setDrawerOpen(false);
    resetForm();
  }

  async function handleCreate() {
    setErrorMessage(null);
    if (!form.firstName || !form.lastName || !form.email || !form.idNumber || !form.roleId) {
      setErrorMessage('All required fields must be completed.');
      return;
    }

    try {
      const result = (await createUser.mutateAsync({
        ...form,
        branchId: form.branchId || null,
      })) as { workId?: string };
      setCreatedWorkId(result?.workId ?? null);
      setForm({ firstName: '', lastName: '', email: '', idNumber: '', roleId: '', branchId: '' });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create user.');
    }
  }

  if (usersQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        description="Create users, assign access roles, set branch scope, and disable or remove accounts."
        actions={
          <Button onClick={() => { resetForm(); setDrawerOpen(true); }} size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        }
      />
      <SettingsNav />

      <FilterBar
        filters={[
          {
            key: 'search',
            label: 'Search',
            type: 'search',
            value: filters.search,
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: filters.status,
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
              { label: 'Suspended', value: 'suspended' },
            ],
          },
        ]}
        onFilterChange={(key, value) =>
          setFilters((current) => ({
            ...current,
            [key]: value,
          }))
        }
      />

      <DataTable
        columns={[
          { key: 'workId', header: 'Work ID' },
          { key: 'fullName', header: 'Name' },
          { key: 'email', header: 'Email' },
          {
            key: 'role',
            header: 'Role',
            render: (row: UserRow) => row.role.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
          },
          {
            key: 'branch',
            header: 'Branch',
            render: (row: UserRow) => row.branch?.name ?? 'Global',
          },
          {
            key: 'status',
            header: 'Status',
            render: (row: UserRow) => <StatusBadge status={row.status} />,
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row: UserRow) => (
              <div className="flex flex-wrap gap-2">
                <RoleAssignButton userId={row.id} currentRole={row.role} allRoles={roles} />
                <StatusToggleButton userId={row.id} status={row.status} />
                <DeleteUserButton userId={row.id} fullName={row.fullName} />
              </div>
            ),
          },
        ]}
        data={users}
        emptyState={
          <EmptyState
            icon={<UserPlus className="h-6 w-6" />}
            title="No users found"
            description="Adjust filters or add a user to get started."
          />
        }
      />

      <FormDrawer title="Add User" open={drawerOpen} onClose={handleClose}>
        {createdWorkId ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-900/20">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                User created successfully.
              </p>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Share the work ID below. The initial password is the ID number without dashes or spaces, in lowercase.
              </p>
              <div className="mt-3 rounded-lg bg-white px-4 py-3 dark:bg-darkCard">
                <p className="text-xs text-muted dark:text-darkMuted">Work ID</p>
                <p className="font-mono text-lg font-bold text-orange">{createdWorkId}</p>
              </div>
            </div>
            <Button onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5 text-sm text-muted dark:text-darkMuted">
                <span>First Name</span>
                <input
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  placeholder="e.g. Tawanda"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5 text-sm text-muted dark:text-darkMuted">
                <span>Last Name</span>
                <input
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  placeholder="e.g. Moyo"
                  className={inputClass}
                />
              </label>
            </div>

            <label className="block space-y-1.5 text-sm text-muted dark:text-darkMuted">
              <span>Email Address</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="user@company.co.zw"
                className={inputClass}
              />
            </label>

            <label className="block space-y-1.5 text-sm text-muted dark:text-darkMuted">
              <span>ID Number</span>
              <input
                value={form.idNumber}
                onChange={(event) => setForm((current) => ({ ...current, idNumber: event.target.value }))}
                placeholder="e.g. 63-123456-A-78"
                className={inputClass}
              />
            </label>

            <label className="block space-y-1.5 text-sm text-muted dark:text-darkMuted">
              <span>Role</span>
              <select
                value={form.roleId}
                onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))}
                className={inputClass}
              >
                <option value="">Select a role...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5 text-sm text-muted dark:text-darkMuted">
              <span>Assigned Branch</span>
              <select
                value={form.branchId}
                onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}
                className={inputClass}
              >
                <option value="">No branch / global access</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.label}
                  </option>
                ))}
              </select>
            </label>

            {errorMessage ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {errorMessage}
              </p>
            ) : null}

            <Button onClick={handleCreate} disabled={createUser.isPending} className="w-full">
              {createUser.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        )}
      </FormDrawer>
    </div>
  );
}

function RoleAssignButton({
  userId,
  currentRole,
  allRoles,
}: {
  userId: string;
  currentRole: string;
  allRoles: Array<{ id: string; name: string }>;
}) {
  const assignRole = useAssignUserRoles(userId);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(currentRole);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setSelected(currentRole); setEditing(true); }}>
        Role
      </Button>
      <FormDrawer title="Change Role" open={editing} onClose={() => setEditing(false)}>
        <div className="space-y-3">
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className={inputClass}
          >
            {allRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <Button
            onClick={async () => {
              await assignRole.mutateAsync({ role: selected });
              setEditing(false);
            }}
          >
            Save
          </Button>
        </div>
      </FormDrawer>
    </>
  );
}

function StatusToggleButton({ userId, status }: { userId: string; status: string }) {
  const updateStatus = useUpdateUserStatus(userId);
  const nextStatus = status === 'active' ? 'inactive' : 'active';

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await updateStatus.mutateAsync({ status: nextStatus });
      }}
    >
      {status === 'active' ? 'Deactivate' : 'Activate'}
    </Button>
  );
}

function DeleteUserButton({ userId, fullName }: { userId: string; fullName: string }) {
  const deleteUser = useDeleteUser(userId);

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        const confirmed = window.confirm(`Delete ${fullName}?`);
        if (!confirmed) return;
        await deleteUser.mutateAsync();
      }}
      disabled={deleteUser.isPending}
    >
      <Trash2 className="mr-1 h-3.5 w-3.5" />
      Delete
    </Button>
  );
}
