import fs from 'fs';

const rawEnv = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');

function getEnv(key) {
  const match = rawEnv.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].replace(/^"|"$/g, '').trim() : '';
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Absolute@2026!';
const BASE_URL = process.env.SMOKE_BASE_URL || 'https://www.absolute-erp.com';
const SCHEMA = 'icecream_erp';
const FETCH_TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS || 30000);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables in .env');
}

const restHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'accept-profile': SCHEMA,
  'content-profile': SCHEMA,
  'content-type': 'application/json',
};

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

const sampleAccounts = [
  {
    role: 'Super Admin',
    workId: 'AQI-20261001',
    pages: [
      '/dashboard',
      '/reports',
      '/settings',
      '/settings/access',
      '/settings/approvals',
      '/settings/audit-logs',
      '/settings/security-settings',
      '/settings/sessions',
      '/workflows',
    ],
  },
  {
    role: 'Procurement Officer',
    workId: 'AQI-20261002',
    pages: [
      '/dashboard',
      '/procurement',
      '/procurement/purchase-orders',
      '/procurement/requisitions',
      '/procurement/goods-received',
      '/procurement/suppliers',
    ],
  },
  {
    role: 'Store Keeper',
    workId: 'AQI-20261003',
    pages: [
      '/dashboard',
      '/inventory',
      '/inventory/stock-balances',
      '/inventory/stock-movements',
      '/inventory/warehouses',
      '/inventory/stores',
    ],
  },
  {
    role: 'Production Manager',
    workId: 'AQI-20261004',
    pages: [
      '/dashboard',
      '/production',
      '/production/plans',
      '/production/recipes',
      '/production/reports',
      '/workflows/approvals',
    ],
  },
  {
    role: 'Production Worker',
    workId: 'AQI-20261005',
    pages: [
      '/dashboard',
      '/production',
      '/production/requests',
      '/reports',
    ],
  },
  {
    role: 'Sales Representative',
    workId: 'AQI-20261006',
    pages: [
      '/dashboard',
      '/sales',
      '/sales/orders',
      '/sales/customers',
      '/sales/invoices',
      '/reports',
    ],
  },
  {
    role: 'Branch Manager',
    workId: 'AQI-20261007',
    pages: [
      '/dashboard',
      '/branches',
      '/sales',
      '/inventory',
      '/reports',
    ],
  },
  {
    role: 'Accountant',
    workId: 'AQI-20261008',
    pages: [
      '/dashboard',
      '/finance',
      '/finance/reports',
      '/budget',
      '/cost-accounting',
      '/reports/history',
    ],
  },
  {
    role: 'Auditor',
    workId: 'AQI-20261009',
    pages: [
      '/dashboard',
      '/reports',
      '/reports/history',
      '/settings/audit-logs',
    ],
  },
];

async function rest(table, { method = 'GET', query = 'select=*', body, prefer } = {}) {
  const headers = { ...restHeaders };
  if (prefer) headers.prefer = prefer;

  const response = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
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
    throw new Error(`${table}: ${message}`);
  }

  return data;
}

async function restInsert(table, payload) {
  const rows = await rest(table, {
    method: 'POST',
    query: 'select=*',
    body: Array.isArray(payload) ? payload : [payload],
    prefer: 'return=representation',
  });
  return Array.isArray(rows) ? rows[0] ?? null : rows;
}

async function restDelete(table, filters) {
  await rest(table, {
    method: 'DELETE',
    query: ['select=*', ...filters].join('&'),
    prefer: 'return=representation',
  });
}

async function restSelect(table, filters) {
  return await rest(table, {
    query: ['select=*', ...filters].join('&'),
  });
}

async function login(workId, password) {
  const response = await fetchWithTimeout(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workId, password }),
    redirect: 'manual',
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Login failed for ${workId}: ${response.status} ${text}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error(`Login for ${workId} did not return a session cookie.`);
  }

  return setCookie.split(';')[0];
}

async function appRequest(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetchWithTimeout(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  return {
    status: response.status,
    location: response.headers.get('location'),
    text,
    json,
  };
}

function pushCheck(results, check, status, details = {}) {
  results.push({ check, status, ...details });
}

async function verifyRolePages() {
  const results = [];

  for (const account of sampleAccounts) {
    console.error(`checking ${account.role} login`);
    const cookie = await login(account.workId, DEMO_PASSWORD);
    const authMe = await appRequest('/api/auth/me', { cookie });
    pushCheck(results, `${account.role} auth`, authMe.status);
    if (authMe.status !== 200) {
      throw new Error(`${account.role} auth check failed: ${authMe.status} ${authMe.text}`);
    }

    for (const page of account.pages) {
      console.error(`checking ${account.role} ${page}`);
      const response = await appRequest(page, { cookie });
      pushCheck(results, `${account.role} ${page}`, response.status, { location: response.location });
      if (response.status !== 200) {
        throw new Error(`${account.role} page ${page} failed: ${response.status} ${response.text.slice(0, 300)}`);
      }
    }
  }

  return results;
}

async function verifyWorkflowSurface() {
  const results = [];
  console.error('checking super-admin workflow surface');
  const cookie = await login('AQI-20261001', DEMO_PASSWORD);

  const [organization] = await rest('organizations', { query: 'select=id,name&order=created_at.asc&limit=1' });
  const [branch] = await rest('branches', { query: 'select=id,code,name&order=created_at.asc&limit=1' });
  const [warehouse] = await rest('warehouses', { query: 'select=id,code,name&order=created_at.asc&limit=1' });
  const [role] = await rest('roles', { query: 'select=id,name&name=eq.Super%20Admin&limit=1' });
  const [sampleUser] = await rest('users', { query: 'select=id,work_id&work_id=eq.AQI-20261001&limit=1' });
  const [batch] = await rest('production_batches', { query: 'select=id,batch_number&order=created_at.asc&limit=1' });

  if (!organization?.id || !branch?.id || !warehouse?.id || !role?.id || !sampleUser?.id) {
    throw new Error('Missing production prerequisite records for workflow verification.');
  }

  const superAdminPages = [
    '/reports',
    '/reports/history',
    '/settings',
    '/settings/access',
    '/settings/approvals',
    '/settings/audit-logs',
    '/settings/export-history',
    '/settings/master-data',
    '/settings/permissions',
    '/settings/roles',
    '/settings/security-events',
    '/settings/security-settings',
    '/settings/sessions',
    '/settings/users',
    '/inventory/approvals',
    '/workflows',
    '/workflows/approvals',
    '/notifications',
    '/production/plans',
    '/production/recipes',
    '/sales/customers',
  ];

  for (const page of superAdminPages) {
    console.error(`checking super-admin ${page}`);
    const response = await appRequest(page, { cookie });
    pushCheck(results, `super-admin ${page}`, response.status, { location: response.location });
    if (response.status !== 200) {
      throw new Error(`Super admin page ${page} failed: ${response.status} ${response.text.slice(0, 300)}`);
    }
  }

  const apiChecks = [
    '/api/reports?reportType=DAILY_PRODUCTION',
    '/api/reports/definitions',
    '/api/reports/export-history',
    '/api/security/settings',
    '/api/security/sessions',
    '/api/security/approvals',
    '/api/security/approval-rules',
    '/api/security/branch-assignments',
    '/api/security/warehouse-assignments',
    '/api/settings/audit-logs',
    '/api/production/boms',
    '/api/production/plan-orders',
    '/api/production/warehouse/balances',
    '/api/production/warehouse/movements',
    '/api/production/reports/orders',
    '/api/production/reports/wastage',
    '/api/production/reports/finished-goods',
    '/api/production/reports/goods-receipts',
    '/api/production/reports/inventory-movements',
    '/api/production/reports/daily',
    '/api/production/reports/weekly',
    '/api/production/reports/monthly',
    '/api/production/reports/efficiency',
  ];

  if (batch?.id) {
    apiChecks.push(`/api/quality/production/${batch.id}`);
  }

  for (const path of apiChecks) {
    console.error(`checking super-admin ${path}`);
    const response = await appRequest(path, { cookie });
    pushCheck(results, `super-admin ${path}`, response.status);
    if (response.status !== 200) {
      throw new Error(`Super admin API ${path} failed: ${response.status} ${response.text.slice(0, 300)}`);
    }
  }

  const securitySettings = await appRequest('/api/security/settings', { cookie });
  const currentTimeout = Number(securitySettings.json?.sessionTimeoutMinutes ?? 15);
  const patchSecurity = await appRequest('/api/security/settings', {
    method: 'PATCH',
    body: { sessionTimeoutMinutes: currentTimeout },
    cookie,
  });
  pushCheck(results, 'security settings patch', patchSecurity.status);
  if (patchSecurity.status !== 200) {
    throw new Error(`Security settings PATCH failed: ${patchSecurity.status} ${patchSecurity.text}`);
  }

  let savedFilterId = null;
  let workflowId = null;
  let exportId = null;
  let requestId = null;
  let branchAssignmentId = null;
  let warehouseAssignmentId = null;

  try {
    const savedFilter = await appRequest('/api/reports/saved-filters', {
      method: 'POST',
      body: {
        category: 'inventory',
        reportType: 'stock-balance',
        filterName: `Smoke ${Date.now()}`,
        filters: { branchId: branch.id },
        visibility: 'private',
      },
      cookie,
    });
    pushCheck(results, 'saved filter create', savedFilter.status);
    if (savedFilter.status !== 201) {
      throw new Error(`Saved filter create failed: ${savedFilter.status} ${savedFilter.text}`);
    }
    savedFilterId = savedFilter.json?.id ?? null;

    const savedFilterPatch = await appRequest(`/api/reports/saved-filters/${savedFilterId}`, {
      method: 'PATCH',
      body: { filterName: `Smoke Updated ${Date.now()}` },
      cookie,
    });
    pushCheck(results, 'saved filter patch', savedFilterPatch.status);
    if (savedFilterPatch.status !== 200) {
      throw new Error(`Saved filter patch failed: ${savedFilterPatch.status} ${savedFilterPatch.text}`);
    }

    const existingBranchAssignments = await restSelect('user_branch_assignments', [
      `user_profile_id=eq.${sampleUser.id}`,
      `branch_id=eq.${branch.id}`,
      'is_active=eq.true',
      'limit=1',
    ]);

    if (existingBranchAssignments.length === 0) {
      const branchAssignment = await appRequest('/api/security/branch-assignments', {
        method: 'POST',
        body: {
          userProfileId: sampleUser.id,
          branchId: branch.id,
          roleName: 'Smoke Verification',
        },
        cookie,
      });
      pushCheck(results, 'branch assignment create', branchAssignment.status);
      if (branchAssignment.status !== 201) {
        throw new Error(`Branch assignment create failed: ${branchAssignment.status} ${branchAssignment.text}`);
      }
      branchAssignmentId = branchAssignment.json?.id ?? null;
    } else {
      pushCheck(results, 'branch assignment create', 200, { note: 'existing assignment reused' });
    }

    const existingWarehouseAssignments = await restSelect('user_warehouse_assignments', [
      `user_profile_id=eq.${sampleUser.id}`,
      `warehouse_id=eq.${warehouse.id}`,
      'is_active=eq.true',
      'limit=1',
    ]);

    if (existingWarehouseAssignments.length === 0) {
      const warehouseAssignment = await appRequest('/api/security/warehouse-assignments', {
        method: 'POST',
        body: {
          userProfileId: sampleUser.id,
          warehouseId: warehouse.id,
          accessLevel: 'FULL',
        },
        cookie,
      });
      pushCheck(results, 'warehouse assignment create', warehouseAssignment.status);
      if (warehouseAssignment.status !== 201) {
        throw new Error(`Warehouse assignment create failed: ${warehouseAssignment.status} ${warehouseAssignment.text}`);
      }
      warehouseAssignmentId = warehouseAssignment.json?.id ?? null;
    } else {
      pushCheck(results, 'warehouse assignment create', 200, { note: 'existing assignment reused' });
    }

    const approvalRule = await appRequest('/api/security/approval-rules', {
      method: 'POST',
      body: {
        module: 'inventory',
        documentType: 'stock_transfer',
        action: 'APPROVE',
        requiredRoleId: role.id,
        minimumAmount: 0,
      },
      cookie,
    });
    pushCheck(results, 'approval rule create', approvalRule.status);
    if (approvalRule.status !== 201) {
      throw new Error(`Approval rule create failed: ${approvalRule.status} ${approvalRule.text}`);
    }
    workflowId = approvalRule.json?.id ?? null;

    const approvalRulePatch = await appRequest(`/api/security/approval-rules/${workflowId}`, {
      method: 'PATCH',
      body: { isActive: false },
      cookie,
    });
    pushCheck(results, 'approval rule patch', approvalRulePatch.status);
    if (approvalRulePatch.status !== 200) {
      throw new Error(`Approval rule patch failed: ${approvalRulePatch.status} ${approvalRulePatch.text}`);
    }

    const reportExport = await restInsert('report_exports', {
      user_profile_id: sampleUser.id,
      report_category: 'inventory',
      report_type: 'stock-balance',
      branch_id: branch.id,
      export_format: 'CSV',
      file_name: `smoke-export-${Date.now()}.csv`,
      filters: { branchId: branch.id },
      status: 'EXPORTED',
      exported_at: new Date().toISOString(),
      exported_by: sampleUser.id,
    });
    exportId = reportExport?.id ?? null;
    pushCheck(results, 'report export insert', exportId ? 201 : 500);
    if (!exportId) {
      throw new Error('Report export insert did not return an id.');
    }

    const approvalRequest = await restInsert('approval_requests', {
      organization_id: organization.id,
      workflow_id: workflowId,
      module_name: 'inventory',
      document_type: 'stock_transfer',
      document_reference: `SMOKE-${Date.now()}`,
      entity_type: 'stock_transfer',
      entity_id: `smoke-${Date.now()}`,
      requested_by: sampleUser.id,
      approver_role_id: role.id,
      approver_role_name: role.name,
      current_step: 1,
      status: 'PENDING',
      submitted_at: new Date().toISOString(),
      submitted_by: sampleUser.id,
    });
    requestId = approvalRequest?.id ?? null;
    pushCheck(results, 'approval request insert', requestId ? 201 : 500);
    if (!requestId) {
      throw new Error('Approval request insert did not return an id.');
    }

    const inventoryApprovals = await appRequest('/api/inventory/approvals?status=PENDING', { cookie });
    pushCheck(results, 'inventory approvals get', inventoryApprovals.status);
    if (inventoryApprovals.status !== 200) {
      throw new Error(`Inventory approvals failed: ${inventoryApprovals.status} ${inventoryApprovals.text}`);
    }
  } finally {
    if (savedFilterId) {
      await appRequest(`/api/reports/saved-filters/${savedFilterId}`, {
        method: 'DELETE',
        cookie,
      }).catch(() => {});
    }
    if (branchAssignmentId) {
      await restDelete('user_branch_assignments', [`id=eq.${branchAssignmentId}`]).catch(() => {});
    }
    if (warehouseAssignmentId) {
      await restDelete('user_warehouse_assignments', [`id=eq.${warehouseAssignmentId}`]).catch(() => {});
    }
    if (requestId) {
      await restDelete('approval_requests', [`id=eq.${requestId}`]).catch(() => {});
    }
    if (workflowId) {
      await restDelete('approval_workflows', [`id=eq.${workflowId}`]).catch(() => {});
    }
    if (exportId) {
      await restDelete('report_exports', [`id=eq.${exportId}`]).catch(() => {});
    }
  }

  return results;
}

async function main() {
  const story = 'The user is building a production-ready Ice Cream ERP flow that runs from demo-role login and dashboard navigation -> protected Next.js API routes -> the live icecream_erp Supabase schema -> rendered pages and persisted workflow state on the current Vercel production alias.';

  const roleResults = await verifyRolePages();
  const workflowResults = await verifyWorkflowSurface();

  console.log(JSON.stringify({
    baseUrl: BASE_URL,
    demoPassword: DEMO_PASSWORD,
    story,
    roleResults,
    workflowResults,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
