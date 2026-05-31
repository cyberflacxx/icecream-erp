'use client';

import { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';

import { DataTable, EmptyState, FilterBar, FormDrawer, LoadingState, StatusBadge } from '@absolute-ice-cream/ui';

import { PageHeader } from '@/components/dashboard/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Button } from '@/components/ui/button';
import {
  useAssignUserRoles,
  useInviteUser,
  useRoles,
  useUpdateUserStatus,
  useUsers
} from '@/hooks/settings/useSettings';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  status: string;
  roles: Array<{ id: string; name: string }>;
  branch: { id: string; name: string } | null;
}

export default function SettingsUsersPage() {
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 20,
    search: '',
    status: ''
  });
  const usersQuery = useUsers(filters);
  const rolesQuery = useRoles({
    page: 1,
    pageSize: 100
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleIds, setInviteRoleIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const inviteUser = useInviteUser();
  const users = (usersQuery.data?.data ?? []) as UserRow[];
  const roles = useMemo(
    () =>
      ((rolesQuery.data?.data ?? []) as Array<{ id: string; name: string }>).map((role) => ({
        id: role.id,
        name: role.name
      })),
    [rolesQuery.data],
  );

  if (usersQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        description="Manage user access, role assignments, and user status."
        actions={
          <Button onClick={() => setDrawerOpen(true)} size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite User
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
            value: filters.search
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: filters.status,
            options: [
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Inactive', value: 'INACTIVE' },
              { label: 'Suspended', value: 'SUSPENDED' }
            ]
          }
        ]}
        onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
      />

      <DataTable
        columns={[
          { key: 'fullName', header: 'User' },
          { key: 'email', header: 'Email' },
          {
            key: 'roles',
            header: 'Roles',
            render: (row: UserRow) => row.roles.map((role) => role.name).join(', ') || 'None'
          },
          {
            key: 'branch',
            header: 'Branch',
            render: (row: UserRow) => row.branch?.name ?? 'Global'
          },
          {
            key: 'status',
            header: 'Status',
            render: (row: UserRow) => <StatusBadge status={row.status} />
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row: UserRow) => (
              <div className="flex flex-wrap gap-2">
                <RoleAssignButton userId={row.id} roleIds={row.roles.map((role) => role.id)} allRoles={roles} />
                <StatusToggleButton userId={row.id} status={row.status} />
              </div>
            )
          }
        ]}
        data={users}
        emptyState={
          <EmptyState
            icon={<UserPlus className="h-6 w-6" />}
            title="No users found"
            description="Adjust filters or invite users to get started."
          />
        }
      />

      <FormDrawer title="Invite User" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="space-y-4">
          <label className="block space-y-2 text-sm text-muted dark:text-darkMuted">
            <span>Email</span>
            <input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-cream px-3 text-brown outline-none dark:border-darkBorder dark:bg-darkCard dark:text-darkText"
            />
          </label>
          <div className="space-y-2 text-sm text-muted dark:text-darkMuted">
            <span>Assign Roles</span>
            <div className="space-y-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={inviteRoleIds.includes(role.id)}
                    onChange={(event) =>
                      setInviteRoleIds((current) =>
                        event.target.checked
                          ? [...current, role.id]
                          : current.filter((id) => id !== role.id),
                      )
                    }
                  />
                  <span>{role.name}</span>
                </label>
              ))}
            </div>
          </div>
          <Button
            onClick={async () => {
              try {
                await inviteUser.mutateAsync({
                  email: inviteEmail,
                  roleIds: inviteRoleIds,
                  sendEmail: true
                });
                setMessage('Invitation sent successfully.');
                setDrawerOpen(false);
                setInviteEmail('');
                setInviteRoleIds([]);
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Failed to send invitation.');
              }
            }}
          >
            Send Invitation
          </Button>
          {message ? <p className="text-sm text-muted dark:text-darkMuted">{message}</p> : null}
        </div>
      </FormDrawer>
    </div>
  );
}

function RoleAssignButton({
  userId,
  roleIds,
  allRoles
}: {
  userId: string;
  roleIds: string[];
  allRoles: Array<{ id: string; name: string }>;
}) {
  const assignRoles = useAssignUserRoles(userId);
  const [editing, setEditing] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState(roleIds);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        Assign Roles
      </Button>
      <FormDrawer title="Assign Roles" open={editing} onClose={() => setEditing(false)}>
        <div className="space-y-3">
          {allRoles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm text-muted dark:text-darkMuted">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role.id)}
                onChange={(event) =>
                  setSelectedRoles((current) =>
                    event.target.checked
                      ? [...current, role.id]
                      : current.filter((id) => id !== role.id),
                  )
                }
              />
              <span>{role.name}</span>
            </label>
          ))}
          <Button
            onClick={async () => {
              await assignRoles.mutateAsync({
                roleIds: selectedRoles
              });
              setEditing(false);
            }}
          >
            Save Roles
          </Button>
        </div>
      </FormDrawer>
    </>
  );
}

function StatusToggleButton({ userId, status }: { userId: string; status: string }) {
  const updateStatus = useUpdateUserStatus(userId);
  const nextStatus = status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await updateStatus.mutateAsync({
          status: nextStatus
        });
      }}
    >
      {status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
    </Button>
  );
}
