import fs from 'fs';

const rawEnv = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');

function getEnv(key) {
  const match = rawEnv.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].replace(/^"|"$/g, '').trim() : '';
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Absolute@2026!';
const SCHEMA = 'icecream_erp';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables in .env');
}

const restHeaders = {
  apikey: SUPABASE_ANON_KEY,
  authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'accept-profile': SCHEMA,
  'content-profile': SCHEMA,
  'content-type': 'application/json',
};

const sampleAccounts = [
  {
    roleLabel: 'Super Admin',
    workId: 'AQI-20261001',
    firstName: 'System',
    lastName: 'Owner',
    email: 'sample.superadmin@absoluteicecream.co.zw',
    idNumber: '63-610001-A01',
    storedRole: 'super_admin',
    branchIndex: null,
    branchAssignmentRoleName: null,
    exactRoleName: 'Super Admin',
    permissionTemplateRoleName: 'Super Admin',
    permissionExtraCodes: [],
  },
  {
    roleLabel: 'Procurement Officer',
    workId: 'AQI-20261002',
    firstName: 'Patience',
    lastName: 'Buyer',
    email: 'sample.procurement@absoluteicecream.co.zw',
    idNumber: '63-610002-A02',
    storedRole: 'manager',
    branchIndex: 0,
    branchAssignmentRoleName: 'Procurement Officer',
    exactRoleName: 'Procurement Officer',
    permissionTemplateRoleName: 'Procurement Lead',
    permissionExtraCodes: [],
  },
  {
    roleLabel: 'Store Keeper',
    workId: 'AQI-20261003',
    firstName: 'Tawanda',
    lastName: 'Store',
    email: 'sample.storekeeper@absoluteicecream.co.zw',
    idNumber: '63-610003-A03',
    storedRole: 'manager',
    branchIndex: 0,
    branchAssignmentRoleName: 'Store Keeper',
    exactRoleName: 'Store Keeper',
    permissionTemplateRoleName: 'Inventory Lead',
    permissionExtraCodes: [],
  },
  {
    roleLabel: 'Production Manager',
    workId: 'AQI-20261004',
    firstName: 'Nyasha',
    lastName: 'Plant',
    email: 'sample.productionmanager@absoluteicecream.co.zw',
    idNumber: '63-610004-A04',
    storedRole: 'manager',
    branchIndex: 0,
    branchAssignmentRoleName: 'Production Manager',
    exactRoleName: 'Production Manager',
    permissionTemplateRoleName: 'Production Manager',
    permissionExtraCodes: [],
  },
  {
    roleLabel: 'Production Worker',
    workId: 'AQI-20261005',
    firstName: 'Tino',
    lastName: 'Operator',
    email: 'sample.productionworker@absoluteicecream.co.zw',
    idNumber: '63-610005-A05',
    storedRole: 'staff',
    branchIndex: 0,
    branchAssignmentRoleName: null,
    exactRoleName: 'Production Worker',
    permissionTemplateRoleName: 'Staff',
    permissionExtraCodes: [],
  },
  {
    roleLabel: 'Sales Representative',
    workId: 'AQI-20261006',
    firstName: 'Rudo',
    lastName: 'Sales',
    email: 'sample.salesrep@absoluteicecream.co.zw',
    idNumber: '63-610006-A06',
    storedRole: 'staff',
    branchIndex: 1,
    branchAssignmentRoleName: 'Sales Representative',
    exactRoleName: 'Sales Representative',
    permissionTemplateRoleName: 'Sales Lead',
    permissionExtraCodes: [],
  },
  {
    roleLabel: 'Branch Manager',
    workId: 'AQI-20261007',
    firstName: 'Tapiwa',
    lastName: 'Branch',
    email: 'sample.branchmanager@absoluteicecream.co.zw',
    idNumber: '63-610007-A07',
    storedRole: 'branch_manager',
    branchIndex: 2,
    branchAssignmentRoleName: 'Branch Manager',
    exactRoleName: 'Branch Manager',
    permissionTemplateRoleName: 'Branch Manager',
    permissionExtraCodes: [],
  },
  {
    roleLabel: 'Accountant',
    workId: 'AQI-20261008',
    firstName: 'Farai',
    lastName: 'Books',
    email: 'sample.accountant@absoluteicecream.co.zw',
    idNumber: '63-610008-A08',
    storedRole: 'manager',
    branchIndex: 0,
    branchAssignmentRoleName: 'Accountant',
    exactRoleName: 'Accountant',
    permissionTemplateRoleName: 'Finance Lead',
    permissionExtraCodes: [],
  },
  {
    roleLabel: 'Auditor',
    workId: 'AQI-20261009',
    firstName: 'Munya',
    lastName: 'Audit',
    email: 'sample.auditor@absoluteicecream.co.zw',
    idNumber: '63-610009-A09',
    storedRole: 'staff',
    branchIndex: 0,
    branchAssignmentRoleName: null,
    exactRoleName: 'Auditor',
    permissionTemplateRoleName: 'Finance Lead',
    permissionExtraCodes: ['settings.read', 'view_audit_logs'],
  },
];

async function rest(table, { method = 'GET', query = 'select=*', body, prefer } = {}) {
  const headers = { ...restHeaders };
  if (prefer) headers.prefer = prefer;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data?.message ? data.message : text || `${response.status} ${response.statusText}`;
    const error = new Error(`${table}: ${message}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return { data, headers: response.headers };
}

async function selectRows(table, query) {
  return (await rest(table, { query })).data ?? [];
}

async function maybeSingle(table, query) {
  const rows = await selectRows(table, `${query}&limit=1`);
  return rows[0] ?? null;
}

async function insertRows(table, rows, onConflict) {
  const prefer = onConflict ? 'return=representation,resolution=merge-duplicates' : 'return=representation';
  const query = onConflict ? `on_conflict=${encodeURIComponent(onConflict)}` : 'select=*';
  const body = Array.isArray(rows) ? rows : [rows];
  return (await rest(table, { method: 'POST', query, body, prefer })).data ?? [];
}

async function patchRows(table, filters, body) {
  const query = ['select=*', ...filters].join('&');
  return (await rest(table, { method: 'PATCH', query, body, prefer: 'return=representation' })).data ?? [];
}

async function deleteRows(table, filters) {
  const query = ['select=*', ...filters].join('&');
  return (await rest(table, { method: 'DELETE', query, prefer: 'return=representation' })).data ?? [];
}

async function listAuthUsers() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=500`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || 'Failed to list auth users');
  }
  return data.users ?? [];
}

async function createAuthUser({ email, password, emailConfirm = true }) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: emailConfirm,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || 'Failed to create auth user');
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data.user ?? data;
}

async function updateAuthUser(userId, updates) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || 'Failed to update auth user');
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data.user ?? data;
}

function workIdToEmail(workId) {
  return `${workId.toLowerCase()}@ice.erp`;
}

function roleDescription(roleName) {
  return `${roleName} demo access role`;
}

async function ensureOrganizationAndBranches() {
  const organization = await maybeSingle('organizations', 'select=id,name&order=created_at.asc');
  if (!organization?.id) {
    throw new Error('No organization found. Seed the base ERP data first.');
  }

  const branches = await selectRows('branches', 'select=id,code,name&order=created_at.asc');
  if (branches.length < 3) {
    throw new Error('At least 3 branches are required before seeding sample accounts.');
  }

  return { organization, branches };
}

async function ensureRoles(organizationId) {
  const [roles, permissions, rolePermissions] = await Promise.all([
    selectRows('roles', 'select=id,name,description,is_system_role&order=name.asc'),
    selectRows('permissions', 'select=id,code,name,module&order=code.asc'),
    selectRows('role_permissions', 'select=id,role_id,permission_id'),
  ]);

  const roleByName = new Map(roles.map((role) => [String(role.name).toLowerCase(), role]));
  const permissionByCode = new Map(permissions.map((permission) => [String(permission.code), permission]));
  const permissionIdsByRoleId = new Map();

  for (const row of rolePermissions) {
    const key = String(row.role_id);
    const permissionSet = permissionIdsByRoleId.get(key) ?? new Set();
    permissionSet.add(String(row.permission_id));
    permissionIdsByRoleId.set(key, permissionSet);
  }

  const rolePlans = sampleAccounts.map((account) => ({
    exactRoleName: account.exactRoleName,
    templateRoleName: account.permissionTemplateRoleName,
    extraPermissionCodes: account.permissionExtraCodes,
  }));

  for (const plan of rolePlans) {
    if (!roleByName.has(plan.exactRoleName.toLowerCase())) {
      const [createdRole] = await insertRows('roles', {
        organization_id: organizationId,
        name: plan.exactRoleName,
        description: roleDescription(plan.exactRoleName),
        is_system_role: false,
      }, 'organization_id,name');
      roleByName.set(plan.exactRoleName.toLowerCase(), createdRole);
      roles.push(createdRole);
    }

    const exactRole = roleByName.get(plan.exactRoleName.toLowerCase());
    const templateRole = roleByName.get(plan.templateRoleName.toLowerCase());
    if (!exactRole?.id || !templateRole?.id) {
      throw new Error(`Role mapping is incomplete for ${plan.exactRoleName} -> ${plan.templateRoleName}`);
    }

    const existingPermissionIds = permissionIdsByRoleId.get(String(exactRole.id)) ?? new Set();
    const templatePermissionIds = permissionIdsByRoleId.get(String(templateRole.id)) ?? new Set();
    const desiredPermissionIds = new Set(templatePermissionIds);

    for (const code of plan.extraPermissionCodes) {
      const permission = permissionByCode.get(code);
      if (permission?.id) desiredPermissionIds.add(String(permission.id));
    }

    const missingPermissionRows = [...desiredPermissionIds]
      .filter((permissionId) => !existingPermissionIds.has(permissionId))
      .map((permissionId) => ({
        role_id: exactRole.id,
        permission_id: permissionId,
      }));

    if (missingPermissionRows.length > 0) {
      await insertRows('role_permissions', missingPermissionRows, 'role_id,permission_id');
      permissionIdsByRoleId.set(
        String(exactRole.id),
        new Set([...existingPermissionIds, ...missingPermissionRows.map((row) => String(row.permission_id))]),
      );
    }
  }

  return roleByName;
}

async function ensureAuthUsers() {
  const authUsers = await listAuthUsers();
  const authByEmail = new Map(authUsers.map((user) => [String(user.email ?? '').toLowerCase(), user]));

  for (const account of sampleAccounts) {
    const authEmail = workIdToEmail(account.workId);
    let authUser = authByEmail.get(authEmail.toLowerCase());

    if (!authUser) {
      authUser = await createAuthUser({
        email: authEmail,
        password: DEMO_PASSWORD,
      });
      authByEmail.set(authEmail.toLowerCase(), authUser);
    } else {
      await updateAuthUser(String(authUser.id), {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
    }
  }

  return authByEmail;
}

async function ensureDemoUsers({ branches, roleByName, authByEmail }) {
  const users = await selectRows('users', 'select=id,auth_id,work_id,email,role,branch_id,status,full_name,first_name,last_name,id_number,phone');
  const usersByWorkId = new Map(users.map((user) => [String(user.work_id), user]));
  const allAssignments = await selectRows('user_branch_assignments', 'select=id,user_profile_id,branch_id,role_name,is_active,effective_date,created_by,updated_by');
  const userRoles = await selectRows('user_roles', 'select=id,user_profile_id,role_id');

  const createdOrUpdated = [];

  for (const account of sampleAccounts) {
    const authEmail = workIdToEmail(account.workId);
    const authUser = authByEmail.get(authEmail.toLowerCase());
    if (!authUser?.id) {
      throw new Error(`No auth user resolved for ${account.workId}`);
    }

    const branch = account.branchIndex == null ? null : branches[account.branchIndex] ?? null;
    const targetRole = roleByName.get(account.exactRoleName.toLowerCase());
    if (!targetRole?.id) {
      throw new Error(`No role id resolved for ${account.exactRoleName}`);
    }

    let user = usersByWorkId.get(account.workId);

    const desiredUserPayload = {
      auth_id: authUser.id,
      work_id: account.workId,
      email: account.email,
      full_name: `${account.firstName} ${account.lastName}`,
      first_name: account.firstName,
      last_name: account.lastName,
      phone: null,
      role: account.storedRole,
      branch_id: branch?.id ?? null,
      status: 'active',
      id_number: account.idNumber,
    };

    if (!user) {
      [user] = await insertRows('users', desiredUserPayload);
      users.push(user);
      usersByWorkId.set(account.workId, user);
    } else {
      const updates = {};
      for (const [key, value] of Object.entries(desiredUserPayload)) {
        if ((user[key] ?? null) !== value) {
          updates[key] = value;
        }
      }
      if (Object.keys(updates).length > 0) {
        const [updatedUser] = await patchRows('users', [`id=eq.${user.id}`], updates);
        user = updatedUser ?? { ...user, ...updates };
        usersByWorkId.set(account.workId, user);
      }
    }

    const currentRoleRows = userRoles.filter((row) => String(row.user_profile_id) === String(user.id));
    const staleRoleRows = currentRoleRows.filter((row) => String(row.role_id) !== String(targetRole.id));
    if (staleRoleRows.length > 0) {
      await deleteRows('user_roles', [`user_profile_id=eq.${user.id}`, `role_id=not.eq.${targetRole.id}`]);
      for (const staleRow of staleRoleRows) {
        const index = userRoles.findIndex((row) => String(row.id) === String(staleRow.id));
        if (index >= 0) userRoles.splice(index, 1);
      }
    }

    if (!currentRoleRows.some((row) => String(row.role_id) === String(targetRole.id))) {
      const [createdUserRole] = await insertRows('user_roles', {
        user_profile_id: user.id,
        role_id: targetRole.id,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
      }, 'user_profile_id,role_id');
      userRoles.push(createdUserRole);
    }

    const currentAssignments = allAssignments.filter((row) => String(row.user_profile_id) === String(user.id));
    const targetAssignment = branch
      ? currentAssignments.find((row) => String(row.branch_id) === String(branch.id))
      : null;

    for (const assignment of currentAssignments) {
      if (!assignment.is_active) continue;
      if (targetAssignment && String(assignment.id) === String(targetAssignment.id)) continue;
      await patchRows('user_branch_assignments', [`id=eq.${assignment.id}`], {
        is_active: false,
        updated_by: user.id,
      });
      assignment.is_active = false;
    }

    if (branch) {
      if (targetAssignment) {
        const assignmentUpdates = {};
        if (targetAssignment.is_active !== true) assignmentUpdates.is_active = true;
        if ((targetAssignment.role_name ?? null) !== account.branchAssignmentRoleName) {
          assignmentUpdates.role_name = account.branchAssignmentRoleName;
        }
        if (Object.keys(assignmentUpdates).length > 0) {
          const [updatedAssignment] = await patchRows('user_branch_assignments', [`id=eq.${targetAssignment.id}`], {
            ...assignmentUpdates,
            effective_date: new Date().toISOString().slice(0, 10),
            updated_by: user.id,
          });
          Object.assign(targetAssignment, updatedAssignment ?? assignmentUpdates);
        }
      } else {
        const [createdAssignment] = await insertRows('user_branch_assignments', {
          user_profile_id: user.id,
          branch_id: branch.id,
          role_name: account.branchAssignmentRoleName,
          effective_date: new Date().toISOString().slice(0, 10),
          is_active: true,
          created_by: user.id,
          updated_by: user.id,
        });
        allAssignments.push(createdAssignment);
      }
    }

    createdOrUpdated.push({
      role: account.roleLabel,
      workId: account.workId,
      email: account.email,
      authEmail,
      assignedRole: account.exactRoleName,
      branch: branch?.name ?? null,
    });
  }

  return createdOrUpdated;
}

async function main() {
  const { organization, branches } = await ensureOrganizationAndBranches();
  const roleByName = await ensureRoles(String(organization.id));
  const authByEmail = await ensureAuthUsers();
  const demoUsers = await ensureDemoUsers({ branches, roleByName, authByEmail });

  console.log(JSON.stringify({
    demoPassword: DEMO_PASSWORD,
    organization: organization.name,
    seededAccounts: demoUsers,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (error?.payload) {
    console.error(JSON.stringify(error.payload, null, 2));
  }
  process.exitCode = 1;
});
