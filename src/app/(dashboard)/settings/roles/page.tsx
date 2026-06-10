'use client';

import { useMemo, useState } from 'react';
import { Shield } from 'lucide-react';

import { DataTable, EmptyState, FilterBar, FormDrawer, LoadingState } from '@/components/ui-library';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Button } from '@/components/ui/button';
import {
  useAssignRolePermissions,
  useCreateRole,
  usePermissions,
  useRoles,
  useUpdateRole
} from '@/hooks/settings/useSettings';

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  userCount: number;
  permissions: Array<{ id: string; code: string; module: string }>;
}

export default function SettingsRolesPage() {
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 30,
    search: ''
  });
  const rolesQuery = useRoles(filters);
  const permissionsQuery = usePermissions();
  const createRole = useCreateRole();
  const [openCreate, setOpenCreate] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const roles = (rolesQuery.data?.data ?? []) as RoleRow[];
  const allPermissions = useMemo(
    () =>
      Object.values((permissionsQuery.data ?? {}) as Record<string, Array<{ id: string; code: string }>>).flat(),
    [permissionsQuery.data],
  );

  if (rolesQuery.isLoading || permissionsQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Roles"
        description="Manage role definitions and assign granular permissions."
        actions={<Button onClick={() => setOpenCreate(true)}>Create Role</Button>}
      />
      <SettingsNav />

      <FilterBar
        filters={[
          {
            key: 'search',
            label: 'Search Roles',
            type: 'search',
            value: filters.search
          }
        ]}
        onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
      />

      <DataTable
        columns={[
          { key: 'name', header: 'Role' },
          { key: 'description', header: 'Description' },
          { key: 'userCount', header: 'Users' },
          {
            key: 'permissions',
            header: 'Permissions',
            render: (row: RoleRow) => row.permissions.length
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row: RoleRow) => (
              <div className="flex gap-2">
                <EditRoleButton role={row} />
                <AssignPermissionsButton role={row} allPermissions={allPermissions} />
              </div>
            )
          }
        ]}
        data={roles}
        emptyState={
          <EmptyState
            icon={<Shield className="h-6 w-6" />}
            title="No roles found"
            description="Create a role to begin access control setup."
          />
        }
      />

      <FormDrawer title="Create Role" open={openCreate} onClose={() => setOpenCreate(false)}>
        <div className="space-y-4">
          <label className="block space-y-2 text-sm text-muted dark:text-darkMuted">
            <span>Role Name</span>
            <input
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
            />
          </label>
          <label className="block space-y-2 text-sm text-muted dark:text-darkMuted">
            <span>Description</span>
            <input
              value={roleDescription}
              onChange={(event) => setRoleDescription(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
            />
          </label>
          <Button
            onClick={async () => {
              await createRole.mutateAsync({
                description: roleDescription,
                name: roleName
              });
              setOpenCreate(false);
              setRoleName('');
              setRoleDescription('');
            }}
          >
            Save Role
          </Button>
        </div>
      </FormDrawer>
    </div>
  );
}

function EditRoleButton({ role }: { role: RoleRow }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? '');
  const updateRole = useUpdateRole(role.id);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <FormDrawer title="Edit Role" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <label className="block space-y-2 text-sm text-muted dark:text-darkMuted">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
            />
          </label>
          <label className="block space-y-2 text-sm text-muted dark:text-darkMuted">
            <span>Description</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
            />
          </label>
          <Button
            onClick={async () => {
              await updateRole.mutateAsync({
                description,
                name
              });
              setOpen(false);
            }}
          >
            Save Changes
          </Button>
        </div>
      </FormDrawer>
    </>
  );
}

function AssignPermissionsButton({
  role,
  allPermissions
}: {
  role: RoleRow;
  allPermissions: Array<{ id: string; code: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(role.permissions.map((permission) => permission.id));
  const assign = useAssignRolePermissions(role.id);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Permissions
      </Button>
      <FormDrawer title={`Permissions: ${role.name}`} open={open} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          {allPermissions.map((permission) => (
            <label key={permission.id} className="flex items-center gap-2 text-sm text-muted dark:text-darkMuted">
              <input
                type="checkbox"
                checked={selected.includes(permission.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, permission.id]
                      : current.filter((id) => id !== permission.id),
                  )
                }
              />
              <span>{permission.code}</span>
            </label>
          ))}
          <Button
            onClick={async () => {
              await assign.mutateAsync({
                permissionIds: selected
              });
              setOpen(false);
            }}
          >
            Save Permissions
          </Button>
        </div>
      </FormDrawer>
    </>
  );
}
