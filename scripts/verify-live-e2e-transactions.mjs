import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env');
const OUTPUT_DIR = path.join(ROOT, 'verification-results');
const JSON_OUTPUT_PATH = path.join(OUTPUT_DIR, 'live-e2e-transactions.json');
const MD_OUTPUT_PATH = path.join(OUTPUT_DIR, 'live-e2e-transactions.md');
const SCHEMA = 'icecream_erp';
const FETCH_TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS || 30000);
const BASE_URL = process.env.ABSOLUTE_ERP_BASE_URL || 'https://icecream-erp-frontend.vercel.app';
const TEST_PASSWORD = process.env.ABSOLUTE_TEST_PASSWORD;
const PREFIX = 'E2E-VERIFY';

if (!TEST_PASSWORD) {
  throw new Error('ABSOLUTE_TEST_PASSWORD is required.');
}

function parseEnvFile(contents) {
  const env = {};
  for (const line of contents.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
  }
  return env;
}

const localEnv = parseEnvFile(await fs.readFile(ENV_PATH, 'utf8'));
const SUPABASE_URL = localEnv.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = localEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const ROLE_CONFIG = {
  superAdmin: { label: 'Super Admin', workId: 'AQI-20261001' },
  procurement: { label: 'Procurement Officer', workId: 'AQI-20261002' },
  storeKeeper: { label: 'Store Keeper', workId: 'AQI-20261003' },
  productionManager: { label: 'Production Manager', workId: 'AQI-20261004' },
  salesRep: { label: 'Sales Representative', workId: 'AQI-20261006' },
  accountant: { label: 'Accountant', workId: 'AQI-20261008' },
  auditor: { label: 'Auditor', workId: 'AQI-20261009' },
};

const state = {
  startedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  roles: {},
  steps: [],
  defects: [],
  createdRecords: {},
  setup: {},
  flowStatus: {
    procurement: false,
    stores: false,
    production: false,
    sales: false,
  },
  observations: [],
};

function nowIso() {
  return new Date().toISOString();
}

function withTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'accept-profile': SCHEMA,
    'content-profile': SCHEMA,
    'content-type': 'application/json',
    ...extra,
  };
}

async function rest(table, { method = 'GET', query = 'select=*', body, prefer } = {}) {
  const headers = supabaseHeaders(prefer ? { prefer } : {});
  const response = await withTimeout(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: response.ok, status: response.status, data, text };
}

async function restSelect(table, query) {
  return rest(table, { query });
}

async function login(roleKey) {
  const role = ROLE_CONFIG[roleKey];
  const response = await withTimeout(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workId: role.workId, password: TEST_PASSWORD }),
    redirect: 'manual',
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Login failed for ${role.label}: ${response.status} ${text}`);
  }
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error(`Login for ${role.label} returned no session cookie.`);
  }
  return setCookie.split(';')[0];
}

async function appRequest(pathname, { roleKey, method = 'GET', body, headers = {} } = {}) {
  const cookie = roleKey ? state.roles[roleKey]?.cookie : null;
  const response = await withTimeout(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
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
    ok: response.ok,
    status: response.status,
    text,
    json,
    location: response.headers.get('location'),
    contentType: response.headers.get('content-type'),
  };
}

function addStep(input) {
  state.steps.push({
    at: nowIso(),
    ...input,
  });
}

function addObservation(message) {
  state.observations.push({ at: nowIso(), message });
}

function addDefect(input) {
  state.defects.push({
    defectId: `DEF-${String(state.defects.length + 1).padStart(4, '0')}`,
    createdAt: nowIso(),
    reproSteps: input.reproSteps ?? [],
    ...input,
  });
}

function recordFailure({
  severity,
  role,
  module,
  step,
  pageOrEndpoint,
  httpStatus,
  expectedResult,
  actualResult,
  rootCauseGuess,
  recommendedFix,
  reproSteps,
}) {
  addDefect({
    severity,
    role,
    module,
    step,
    pageOrEndpoint,
    httpStatus,
    expectedResult,
    actualResult,
    rootCauseGuess,
    recommendedFix,
    reproSteps,
  });
}

function pickFirst(rows, matcher) {
  return rows.find(matcher) ?? null;
}

function findWarehouseByName(rows, patterns) {
  return rows.find((row) => patterns.some((pattern) => pattern.test(String(row.name ?? '')))) ?? null;
}

function createRef(suffix) {
  return `${PREFIX}-${suffix}-${Date.now()}`;
}

function createCompactCode(prefix, maxLength) {
  const timestampToken = Date.now().toString(36).toUpperCase();
  const randomToken = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${timestampToken}-${randomToken}`.slice(0, maxLength);
}

async function authenticateRoles() {
  for (const roleKey of Object.keys(ROLE_CONFIG)) {
    const role = ROLE_CONFIG[roleKey];
    try {
      const cookie = await login(roleKey);
      state.roles[roleKey] = { ...role, cookie };
      const me = await appRequest('/api/auth/me', { roleKey });
      addStep({
        module: 'Authentication',
        role: role.label,
        step: 'Login and auth check',
        pageOrEndpoint: '/api/auth/login -> /api/auth/me',
        httpStatus: me.status,
        result: me.status === 200 ? 'PASS' : 'FAIL',
        details: me.status === 200 ? 'Authenticated successfully.' : me.text,
      });
      if (me.status !== 200) {
        recordFailure({
          severity: 'CRITICAL',
          role: role.label,
          module: 'Authentication',
          step: 'Login and auth check',
          pageOrEndpoint: '/api/auth/me',
          httpStatus: me.status,
          expectedResult: 'Authenticated role can access its profile.',
          actualResult: me.text || 'Authentication check failed.',
          rootCauseGuess: 'Session cookie or auth resolution failed after login.',
          recommendedFix: 'Inspect auth session persistence and role profile lookup.',
          reproSteps: [`POST /api/auth/login with ${role.workId}`, 'GET /api/auth/me with returned cookie'],
        });
      }
    } catch (error) {
      addStep({
        module: 'Authentication',
        role: role.label,
        step: 'Login',
        pageOrEndpoint: '/api/auth/login',
        httpStatus: 0,
        result: 'FAIL',
        details: error instanceof Error ? error.message : String(error),
      });
      recordFailure({
        severity: 'CRITICAL',
        role: role.label,
        module: 'Authentication',
        step: 'Login',
        pageOrEndpoint: '/api/auth/login',
        httpStatus: 0,
        expectedResult: 'Role login succeeds with Work ID and password.',
        actualResult: error instanceof Error ? error.message : String(error),
        rootCauseGuess: 'Role credential, auth route, or session issue.',
        recommendedFix: 'Inspect auth route, sample-account seeding, and live session cookies.',
        reproSteps: [`POST /api/auth/login with ${role.workId}`],
      });
    }
  }
}

async function verifySetup() {
  const [warehousesResult, unitsResult, categoriesResult, accountsResult, usersResult] = await Promise.all([
    restSelect('warehouses', 'select=id,name,code,type,warehouse_type,branch_id,is_active&is_active=eq.true&order=name.asc'),
    restSelect('units_of_measure', 'select=id,name,abbreviation&order=name.asc'),
    restSelect('item_categories', 'select=id,name,description&order=name.asc'),
    restSelect('accounts', 'select=id,code,name,type,is_active&is_active=eq.true&order=code.asc'),
    restSelect('users', 'select=id,work_id,full_name,status&work_id=in.(AQI-20261001,AQI-20261002,AQI-20261003,AQI-20261004,AQI-20261006,AQI-20261008,AQI-20261009)'),
  ]);

  const warehouses = Array.isArray(warehousesResult.data) ? warehousesResult.data : [];
  const units = Array.isArray(unitsResult.data) ? unitsResult.data : [];
  const categories = Array.isArray(categoriesResult.data) ? categoriesResult.data : [];
  const accounts = Array.isArray(accountsResult.data) ? accountsResult.data : [];
  const users = Array.isArray(usersResult.data) ? usersResult.data : [];

  const rawWarehouse = findWarehouseByName(warehouses, [/raw materials/i, /\braw\b/i]);
  const productionWarehouse = findWarehouseByName(warehouses, [/production materials/i, /prod materials/i]);
  const finishedWarehouse = findWarehouseByName(warehouses, [/finished goods/i]);
  const productionFinishedWarehouse = findWarehouseByName(warehouses, [/production finished/i]);
  const generalUnit = pickFirst(units, (row) => /general unit/i.test(String(row.name ?? ''))) ?? units[0] ?? null;
  const rawCategory = pickFirst(categories, (row) => /raw materials/i.test(String(row.name ?? ''))) ?? categories[0] ?? null;
  const finishedCategory = pickFirst(categories, (row) => /finished goods/i.test(String(row.name ?? ''))) ?? categories[0] ?? null;
  const cashOrBankAccount = pickFirst(accounts, (row) => /cash|bank/i.test(`${row.code ?? ''} ${row.name ?? ''}`));

  state.setup = {
    organizationId: users[0]?.organization_id ?? null,
    rawWarehouse,
    productionWarehouse,
    finishedWarehouse,
    productionFinishedWarehouse,
    generalUnit,
    rawCategory,
    finishedCategory,
    cashOrBankAccount,
    users,
  };

  addStep({
    module: 'Setup',
    role: ROLE_CONFIG.superAdmin.label,
    step: 'Master data verification',
    pageOrEndpoint: 'Supabase reference data',
    httpStatus: 200,
    result: 'PASS',
    details: `Warehouses=${warehouses.length}, units=${units.length}, categories=${categories.length}, accounts=${accounts.length}`,
  });

  const reportDefinitions = await appRequest('/api/reports/definitions', { roleKey: 'superAdmin' });
  addStep({
    module: 'Setup',
    role: ROLE_CONFIG.superAdmin.label,
    step: 'Report definitions API',
    pageOrEndpoint: '/api/reports/definitions',
    httpStatus: reportDefinitions.status,
    result: reportDefinitions.status === 200 ? 'PASS' : 'FAIL',
    details: reportDefinitions.status === 200 ? 'Loaded report definitions.' : reportDefinitions.text,
  });

  const missingSetup = [];
  if (!rawWarehouse) missingSetup.push('Raw Materials Warehouse');
  if (!productionWarehouse) missingSetup.push('Production Materials Warehouse');
  if (!finishedWarehouse) missingSetup.push('Main Finished Goods Warehouse');
  if (!generalUnit) missingSetup.push('Unit of Measure');
  if (!rawCategory) missingSetup.push('Raw Materials Category');
  if (!finishedCategory) missingSetup.push('Finished Goods Category');
  if (!cashOrBankAccount) missingSetup.push('Bank or Cash Account');
  if (!productionFinishedWarehouse) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.superAdmin.label,
      module: 'Setup',
      step: 'Warehouse verification',
      pageOrEndpoint: 'warehouses',
      httpStatus: 200,
      expectedResult: 'Dedicated Production Finished Goods Warehouse exists.',
      actualResult: 'No warehouse with a production-finished-goods style name was found.',
      rootCauseGuess: 'Warehouse seed data does not include a dedicated production finished goods location.',
      recommendedFix: 'Add an idempotent seed or setup record for a production finished goods warehouse.',
      reproSteps: ['Query warehouses reference data and look for a production finished goods warehouse.'],
    });
  }
  if (reportDefinitions.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.superAdmin.label,
      module: 'Setup',
      step: 'Report definitions API',
      pageOrEndpoint: '/api/reports/definitions',
      httpStatus: reportDefinitions.status,
      expectedResult: 'Report definitions are available.',
      actualResult: reportDefinitions.text || 'Definitions request failed.',
      rootCauseGuess: 'Report definitions route or registry failed to resolve.',
      recommendedFix: 'Inspect report definitions route and registry wiring.',
      reproSteps: ['GET /api/reports/definitions as super admin'],
    });
  }
  if (missingSetup.length > 0) {
    addObservation(`Missing or weak setup detected: ${missingSetup.join(', ')}`);
  }
}

async function createSupplierAndItems() {
  const supplierRef = createRef('SUP');
  const rawItemRef = createRef('RM');
  const finishedItemRef = createRef('FG');

  const supplierPayload = {
    name: `${supplierRef} Supplier`,
    code: createCompactCode('SUP', 20),
    categoryId: null,
    contactPerson: 'E2E Verifier',
    phone: '+263771000000',
    email: `e2e.${Date.now()}@absoluteicecream.co.zw`,
    address: `${PREFIX} Test Address`,
    paymentTerms: 'Immediate',
    creditLimit: 5000,
    status: 'ACTIVE',
  };

  const supplierResponse = await appRequest('/api/suppliers', {
    roleKey: 'procurement',
    method: 'POST',
    body: supplierPayload,
  });
  addStep({
    module: 'Procurement',
    role: ROLE_CONFIG.procurement.label,
    step: 'Create supplier',
    pageOrEndpoint: '/api/suppliers',
    httpStatus: supplierResponse.status,
    result: supplierResponse.status === 201 ? 'PASS' : 'FAIL',
    details: supplierResponse.status === 201 ? `Supplier created: ${supplierRef}` : supplierResponse.text,
  });
  if (supplierResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.procurement.label,
      module: 'Procurement',
      step: 'Create supplier',
      pageOrEndpoint: '/api/suppliers',
      httpStatus: supplierResponse.status,
      expectedResult: 'Supplier creation succeeds.',
      actualResult: supplierResponse.text || 'Supplier creation failed.',
      rootCauseGuess: 'Supplier validation or live supplier schema compatibility failure.',
      recommendedFix: 'Inspect supplier create route, optional-column compatibility, and category defaults.',
      reproSteps: ['POST /api/suppliers with E2E supplier payload'],
    });
    return false;
  }
  state.createdRecords.supplier = supplierResponse.json;

  const rawPayload = {
    name: `${rawItemRef} Raw Material`,
    code: rawItemRef.slice(0, 24).toUpperCase(),
    categoryId: state.setup.rawCategory?.id,
    unitOfMeasureId: state.setup.generalUnit?.id,
    unitCost: 2.5,
    reorderLevel: 5,
    reorderQuantity: 10,
    isActive: true,
  };
  const rawItemResponse = await appRequest('/api/settings/raw-materials', {
    roleKey: 'superAdmin',
    method: 'POST',
    body: rawPayload,
  });
  addStep({
    module: 'Procurement',
    role: ROLE_CONFIG.superAdmin.label,
    step: 'Create raw material item',
    pageOrEndpoint: '/api/settings/raw-materials',
    httpStatus: rawItemResponse.status,
    result: rawItemResponse.status === 201 ? 'PASS' : 'FAIL',
    details: rawItemResponse.status === 201 ? `Raw item created: ${rawItemRef}` : rawItemResponse.text,
  });
  if (rawItemResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.superAdmin.label,
      module: 'Procurement',
      step: 'Create raw material item',
      pageOrEndpoint: '/api/settings/raw-materials',
      httpStatus: rawItemResponse.status,
      expectedResult: 'Raw material item creation succeeds.',
      actualResult: rawItemResponse.text || 'Raw item creation failed.',
      rootCauseGuess: 'Settings item create route or item schema compatibility failure.',
      recommendedFix: 'Inspect settings item create helper, unit/category validation, and legacy reorder-column fallback.',
      reproSteps: ['POST /api/settings/raw-materials with E2E raw material payload'],
    });
    return false;
  }
  state.createdRecords.rawItem = rawItemResponse.json;

  const finishedPayload = {
    name: `${finishedItemRef} Finished Good`,
    code: finishedItemRef.slice(0, 24).toUpperCase(),
    categoryId: state.setup.finishedCategory?.id,
    unitOfMeasureId: state.setup.generalUnit?.id,
    unitCost: 6.5,
    sellingPrice: 12,
    reorderLevel: 2,
    reorderQuantity: 4,
    isActive: true,
  };
  const finishedItemResponse = await appRequest('/api/settings/products', {
    roleKey: 'superAdmin',
    method: 'POST',
    body: finishedPayload,
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.superAdmin.label,
    step: 'Create finished good item',
    pageOrEndpoint: '/api/settings/products',
    httpStatus: finishedItemResponse.status,
    result: finishedItemResponse.status === 201 ? 'PASS' : 'FAIL',
    details: finishedItemResponse.status === 201 ? `Finished item created: ${finishedItemRef}` : finishedItemResponse.text,
  });
  if (finishedItemResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.superAdmin.label,
      module: 'Production',
      step: 'Create finished good item',
      pageOrEndpoint: '/api/settings/products',
      httpStatus: finishedItemResponse.status,
      expectedResult: 'Finished good item creation succeeds.',
      actualResult: finishedItemResponse.text || 'Finished item creation failed.',
      rootCauseGuess: 'Settings product create route or item schema compatibility failure.',
      recommendedFix: 'Inspect settings products route and item creation helper.',
      reproSteps: ['POST /api/settings/products with E2E finished good payload'],
    });
    return false;
  }
  state.createdRecords.finishedItem = finishedItemResponse.json;
  return true;
}

async function runProcurementFlow() {
  if (!state.createdRecords.supplier?.id || !state.createdRecords.rawItem?.id) return false;

  const requisitionResponse = await appRequest('/api/procurement/requisitions', {
    roleKey: 'procurement',
    method: 'POST',
    body: {
      department: `${PREFIX} Procurement`,
      remarks: `${PREFIX} requisition`,
      items: [
        {
          itemId: state.createdRecords.rawItem.id,
          unitOfMeasureId: state.setup.generalUnit.id,
          quantityRequested: 12,
          estimatedUnitCost: 2.5,
        },
      ],
    },
  });
  addStep({
    module: 'Procurement',
    role: ROLE_CONFIG.procurement.label,
    step: 'Create purchase requisition',
    pageOrEndpoint: '/api/procurement/requisitions',
    httpStatus: requisitionResponse.status,
    result: requisitionResponse.status === 201 ? 'PASS' : 'FAIL',
    details: requisitionResponse.status === 201 ? 'Purchase requisition created.' : requisitionResponse.text,
  });
  if (requisitionResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.procurement.label,
      module: 'Procurement',
      step: 'Create purchase requisition',
      pageOrEndpoint: '/api/procurement/requisitions',
      httpStatus: requisitionResponse.status,
      expectedResult: 'Purchase requisition is created.',
      actualResult: requisitionResponse.text || 'Requisition creation failed.',
      rootCauseGuess: 'Requisition create validation or live items/UOM relation failure.',
      recommendedFix: 'Inspect procurement requisition POST validation and item/UOM lookup.',
      reproSteps: ['POST /api/procurement/requisitions with E2E item payload'],
    });
    return false;
  }
  state.createdRecords.requisition = requisitionResponse.json;

  const submitResponse = await appRequest(`/api/procurement/requisitions/${state.createdRecords.requisition.id}/submit`, {
    roleKey: 'procurement',
    method: 'POST',
  });
  addStep({
    module: 'Procurement',
    role: ROLE_CONFIG.procurement.label,
    step: 'Submit purchase requisition',
    pageOrEndpoint: `/api/procurement/requisitions/${state.createdRecords.requisition.id}/submit`,
    httpStatus: submitResponse.status,
    result: submitResponse.status === 200 ? 'PASS' : 'FAIL',
    details: submitResponse.status === 200 ? 'Requisition submitted.' : submitResponse.text,
  });
  if (submitResponse.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.procurement.label,
      module: 'Procurement',
      step: 'Submit purchase requisition',
      pageOrEndpoint: `/api/procurement/requisitions/${state.createdRecords.requisition.id}/submit`,
      httpStatus: submitResponse.status,
      expectedResult: 'Draft requisition submits for approval.',
      actualResult: submitResponse.text || 'Requisition submit failed.',
      rootCauseGuess: 'Workflow submission or requisition state transition failed.',
      recommendedFix: 'Inspect requisition submit route and workflow approval handoff.',
      reproSteps: ['Create requisition', 'POST requisition submit endpoint'],
    });
    return false;
  }

  const requisitionApproveResponse = await appRequest(`/api/procurement/requisitions/${state.createdRecords.requisition.id}/approve`, {
    roleKey: 'superAdmin',
    method: 'POST',
    body: { remarks: `${PREFIX} approved` },
  });
  addStep({
    module: 'Procurement',
    role: ROLE_CONFIG.superAdmin.label,
    step: 'Approve purchase requisition',
    pageOrEndpoint: `/api/procurement/requisitions/${state.createdRecords.requisition.id}/approve`,
    httpStatus: requisitionApproveResponse.status,
    result: requisitionApproveResponse.status === 200 ? 'PASS' : 'FAIL',
    details: requisitionApproveResponse.status === 200 ? 'Requisition approved.' : requisitionApproveResponse.text,
  });
  if (requisitionApproveResponse.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.superAdmin.label,
      module: 'Procurement',
      step: 'Approve purchase requisition',
      pageOrEndpoint: `/api/procurement/requisitions/${state.createdRecords.requisition.id}/approve`,
      httpStatus: requisitionApproveResponse.status,
      expectedResult: 'Submitted requisition is approved by an authorized user.',
      actualResult: requisitionApproveResponse.text || 'Requisition approval failed.',
      rootCauseGuess: 'Approval permission or requisition state transition issue.',
      recommendedFix: 'Inspect procurement approval permission mapping and requisition approval route.',
      reproSteps: ['Submit requisition', 'POST requisition approve endpoint as approver'],
    });
    return false;
  }

  const purchaseOrderResponse = await appRequest('/api/procurement/purchase-orders', {
    roleKey: 'procurement',
    method: 'POST',
    body: {
      supplierId: state.createdRecords.supplier.id,
      requisitionId: state.createdRecords.requisition.id,
      notes: `${PREFIX} purchase order`,
      items: [
        {
          itemId: state.createdRecords.rawItem.id,
          unitOfMeasureId: state.setup.generalUnit.id,
          quantityOrdered: 12,
          unitCost: 2.5,
        },
      ],
    },
  });
  addStep({
    module: 'Procurement',
    role: ROLE_CONFIG.procurement.label,
    step: 'Create purchase order',
    pageOrEndpoint: '/api/procurement/purchase-orders',
    httpStatus: purchaseOrderResponse.status,
    result: purchaseOrderResponse.status === 201 ? 'PASS' : 'FAIL',
    details: purchaseOrderResponse.status === 201 ? 'Purchase order created.' : purchaseOrderResponse.text,
  });
  if (purchaseOrderResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.procurement.label,
      module: 'Procurement',
      step: 'Create purchase order',
      pageOrEndpoint: '/api/procurement/purchase-orders',
      httpStatus: purchaseOrderResponse.status,
      expectedResult: 'Purchase order creation succeeds from approved requisition.',
      actualResult: purchaseOrderResponse.text || 'Purchase order creation failed.',
      rootCauseGuess: 'PO route validation or requisition state precondition failure.',
      recommendedFix: 'Inspect purchase order create route and requisition status compatibility.',
      reproSteps: ['Approve requisition', 'POST purchase order endpoint with requisitionId'],
    });
    return false;
  }
  state.createdRecords.purchaseOrder = purchaseOrderResponse.json;

  const purchaseOrderApproveResponse = await appRequest(`/api/procurement/purchase-orders/${state.createdRecords.purchaseOrder.id}/approve`, {
    roleKey: 'superAdmin',
    method: 'POST',
  });
  addStep({
    module: 'Procurement',
    role: ROLE_CONFIG.superAdmin.label,
    step: 'Approve purchase order',
    pageOrEndpoint: `/api/procurement/purchase-orders/${state.createdRecords.purchaseOrder.id}/approve`,
    httpStatus: purchaseOrderApproveResponse.status,
    result: purchaseOrderApproveResponse.status === 200 ? 'PASS' : 'FAIL',
    details: purchaseOrderApproveResponse.status === 200 ? 'Purchase order approved.' : purchaseOrderApproveResponse.text,
  });
  if (purchaseOrderApproveResponse.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.superAdmin.label,
      module: 'Procurement',
      step: 'Approve purchase order',
      pageOrEndpoint: `/api/procurement/purchase-orders/${state.createdRecords.purchaseOrder.id}/approve`,
      httpStatus: purchaseOrderApproveResponse.status,
      expectedResult: 'Draft purchase order is approved by an authorized user.',
      actualResult: purchaseOrderApproveResponse.text || 'Purchase order approval failed.',
      rootCauseGuess: 'PO approval permission or state-transition problem.',
      recommendedFix: 'Inspect purchase order approve route and approval permission mapping.',
      reproSteps: ['Create purchase order', 'POST purchase order approve endpoint'],
    });
    return false;
  }

  const purchaseOrderSendResponse = await appRequest(`/api/procurement/purchase-orders/${state.createdRecords.purchaseOrder.id}/send`, {
    roleKey: 'procurement',
    method: 'POST',
  });
  addStep({
    module: 'Procurement',
    role: ROLE_CONFIG.procurement.label,
    step: 'Send purchase order',
    pageOrEndpoint: `/api/procurement/purchase-orders/${state.createdRecords.purchaseOrder.id}/send`,
    httpStatus: purchaseOrderSendResponse.status,
    result: purchaseOrderSendResponse.status === 200 ? 'PASS' : 'FAIL',
    details: purchaseOrderSendResponse.status === 200 ? 'Purchase order sent.' : purchaseOrderSendResponse.text,
  });
  if (purchaseOrderSendResponse.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.procurement.label,
      module: 'Procurement',
      step: 'Send purchase order',
      pageOrEndpoint: `/api/procurement/purchase-orders/${state.createdRecords.purchaseOrder.id}/send`,
      httpStatus: purchaseOrderSendResponse.status,
      expectedResult: 'Approved purchase order transitions to sent status.',
      actualResult: purchaseOrderSendResponse.text || 'Purchase order send failed.',
      rootCauseGuess: 'Supplier email validation or email delivery integration blocked PO send.',
      recommendedFix: 'Allow a safe sent-status transition when email integration is unavailable, or fix live mail configuration.',
      reproSteps: ['Approve purchase order', 'POST purchase order send endpoint'],
    });
  }

  state.createdRecords.purchaseOrderSent = purchaseOrderSendResponse.status === 200;
  return true;
}

async function runStoresFlow() {
  const rawWarehouseId = state.setup.rawWarehouse?.id;
  const productionWarehouseId = state.setup.productionWarehouse?.id;
  if (!rawWarehouseId || !productionWarehouseId || !state.createdRecords.rawItem?.id) return false;

  const rawBefore = await restSelect(
    'stock_balances',
    `select=*&item_id=eq.${state.createdRecords.rawItem.id}&warehouse_id=eq.${rawWarehouseId}&limit=1`,
  );
  const rawBeforeQty = Number(rawBefore.data?.[0]?.quantity_available ?? 0);

  const poItems = state.createdRecords.purchaseOrder?.purchase_order_items ?? [];
  const firstPoItem = Array.isArray(poItems) ? poItems[0] : null;

  const createGrnPayload = state.createdRecords.purchaseOrderSent
    ? {
        purchaseOrderId: state.createdRecords.purchaseOrder.id,
        warehouseId: rawWarehouseId,
        items: [
          {
            itemId: state.createdRecords.rawItem.id,
            poItemId: firstPoItem?.id ?? null,
            quantityExpected: 12,
            quantityReceived: 12,
            quantityRejected: 0,
            unitCost: 2.5,
          },
        ],
      }
    : {
        supplierId: state.createdRecords.supplier.id,
        warehouseId: rawWarehouseId,
        entryMode: 'manual',
        items: [
          {
            itemId: state.createdRecords.rawItem.id,
            quantityExpected: 12,
            quantityReceived: 12,
            quantityRejected: 0,
            unitCost: 2.5,
          },
        ],
      };

  const grnCreateResponse = await appRequest('/api/procurement/grns', {
    roleKey: 'storeKeeper',
    method: 'POST',
    body: createGrnPayload,
  });
  addStep({
    module: 'Stores',
    role: ROLE_CONFIG.storeKeeper.label,
    step: 'Create GRN',
    pageOrEndpoint: '/api/procurement/grns',
    httpStatus: grnCreateResponse.status,
    result: grnCreateResponse.status === 201 ? 'PASS' : 'FAIL',
    details: grnCreateResponse.status === 201 ? 'GRN created.' : grnCreateResponse.text,
  });
  if (grnCreateResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.storeKeeper.label,
      module: 'Stores',
      step: 'Create GRN',
      pageOrEndpoint: '/api/procurement/grns',
      httpStatus: grnCreateResponse.status,
      expectedResult: 'GRN creation succeeds.',
      actualResult: grnCreateResponse.text || 'GRN creation failed.',
      rootCauseGuess: state.createdRecords.purchaseOrderSent
        ? 'GRN preconditions for PO-linked receiving are failing.'
        : 'Manual GRN flow is failing despite valid supplier and item setup.',
      recommendedFix: 'Inspect GRN create route preconditions, PO status handling, and warehouse validation.',
      reproSteps: ['Create or send purchase order', 'POST procurement GRN endpoint with E2E payload'],
    });
    return false;
  }
  state.createdRecords.grn = grnCreateResponse.json;

  const grnReceiveResponse = await appRequest(`/api/procurement/grns/${state.createdRecords.grn.id}/receive`, {
    roleKey: 'storeKeeper',
    method: 'POST',
    body: {
      notes: `${PREFIX} receive`,
      items: [
        {
          itemId: state.createdRecords.rawItem.id,
          poItemId: firstPoItem?.id ?? null,
          quantityReceived: 12,
          quantityRejected: 0,
          damagedQuantity: 0,
        },
      ],
    },
  });
  addStep({
    module: 'Stores',
    role: ROLE_CONFIG.storeKeeper.label,
    step: 'Submit GRN',
    pageOrEndpoint: `/api/procurement/grns/${state.createdRecords.grn.id}/receive`,
    httpStatus: grnReceiveResponse.status,
    result: grnReceiveResponse.status === 200 ? 'PASS' : 'FAIL',
    details: grnReceiveResponse.status === 200 ? 'GRN submitted for approval.' : grnReceiveResponse.text,
  });
  if (grnReceiveResponse.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.storeKeeper.label,
      module: 'Stores',
      step: 'Submit GRN',
      pageOrEndpoint: `/api/procurement/grns/${state.createdRecords.grn.id}/receive`,
      httpStatus: grnReceiveResponse.status,
      expectedResult: 'Draft GRN submits to pending approval.',
      actualResult: grnReceiveResponse.text || 'GRN submission failed.',
      rootCauseGuess: 'GRN item validation or submit-state transition failed.',
      recommendedFix: 'Inspect GRN receive route and goods_received_note_items compatibility.',
      reproSteps: ['Create GRN', 'POST GRN receive/submit endpoint'],
    });
    return false;
  }

  const grnApproveResponse = await appRequest(`/api/procurement/grns/${state.createdRecords.grn.id}/approve`, {
    roleKey: 'superAdmin',
    method: 'POST',
  });
  addStep({
    module: 'Stores',
    role: ROLE_CONFIG.superAdmin.label,
    step: 'Approve GRN',
    pageOrEndpoint: `/api/procurement/grns/${state.createdRecords.grn.id}/approve`,
    httpStatus: grnApproveResponse.status,
    result: grnApproveResponse.status === 200 ? 'PASS' : 'FAIL',
    details: grnApproveResponse.status === 200 ? 'GRN approved.' : grnApproveResponse.text,
  });
  if (grnApproveResponse.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.superAdmin.label,
      module: 'Stores',
      step: 'Approve GRN',
      pageOrEndpoint: `/api/procurement/grns/${state.createdRecords.grn.id}/approve`,
      httpStatus: grnApproveResponse.status,
      expectedResult: 'Submitted GRN is approved.',
      actualResult: grnApproveResponse.text || 'GRN approval failed.',
      rootCauseGuess: 'GRN approval permission or state transition failure.',
      recommendedFix: 'Inspect GRN approve route and state gating.',
      reproSteps: ['Submit GRN', 'POST GRN approve endpoint'],
    });
    return false;
  }

  const grnPostResponse = await appRequest(`/api/procurement/grns/${state.createdRecords.grn.id}/post`, {
    roleKey: 'storeKeeper',
    method: 'POST',
  });
  addStep({
    module: 'Stores',
    role: ROLE_CONFIG.storeKeeper.label,
    step: 'Post GRN',
    pageOrEndpoint: `/api/procurement/grns/${state.createdRecords.grn.id}/post`,
    httpStatus: grnPostResponse.status,
    result: grnPostResponse.status === 200 ? 'PASS' : 'FAIL',
    details: grnPostResponse.status === 200 ? 'GRN posted.' : grnPostResponse.text,
  });
  if (grnPostResponse.status !== 200) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.storeKeeper.label,
      module: 'Stores',
      step: 'Post GRN',
      pageOrEndpoint: `/api/procurement/grns/${state.createdRecords.grn.id}/post`,
      httpStatus: grnPostResponse.status,
      expectedResult: 'Approved GRN posts inventory.',
      actualResult: grnPostResponse.text || 'GRN posting failed.',
      rootCauseGuess: 'Inventory movement creation or GRN item compatibility failure.',
      recommendedFix: 'Inspect GRN posting logic, stock movement guards, and item relation fields.',
      reproSteps: ['Approve GRN', 'POST GRN post endpoint'],
    });
    return false;
  }

  const rawAfter = await restSelect(
    'stock_balances',
    `select=*&item_id=eq.${state.createdRecords.rawItem.id}&warehouse_id=eq.${rawWarehouseId}&limit=1`,
  );
  const rawAfterQty = Number(rawAfter.data?.[0]?.quantity_available ?? 0);
  addStep({
    module: 'Stores',
    role: ROLE_CONFIG.storeKeeper.label,
    step: 'Verify raw warehouse stock increase',
    pageOrEndpoint: 'stock_balances',
    httpStatus: 200,
    result: rawAfterQty > rawBeforeQty ? 'PASS' : 'FAIL',
    details: `Before=${rawBeforeQty}, After=${rawAfterQty}`,
  });
  if (rawAfterQty <= rawBeforeQty) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.storeKeeper.label,
      module: 'Stores',
      step: 'Verify raw warehouse stock increase',
      pageOrEndpoint: 'stock_balances',
      httpStatus: 200,
      expectedResult: 'Posted GRN increases raw materials stock.',
      actualResult: `Raw stock did not increase. Before=${rawBeforeQty}, After=${rawAfterQty}`,
      rootCauseGuess: 'GRN posting completed without applying stock delta.',
      recommendedFix: 'Inspect GRN posting stock balance updates and accepted quantity calculation.',
      reproSteps: ['Post GRN', 'Query stock_balances for raw item and warehouse'],
    });
  }

  const grnMovements = await restSelect(
    'stock_movements',
    `select=id,movement_type,reference_id,reference_type&reference_type=eq.goods_received_note&reference_id=eq.${state.createdRecords.grn.id}`,
  );
  const grnMovementCount = Array.isArray(grnMovements.data) ? grnMovements.data.length : 0;
  addStep({
    module: 'Stores',
    role: ROLE_CONFIG.storeKeeper.label,
    step: 'Verify GRN stock ledger',
    pageOrEndpoint: 'stock_movements',
    httpStatus: 200,
    result: grnMovementCount > 0 ? 'PASS' : 'FAIL',
    details: `Movement count=${grnMovementCount}`,
  });
  if (grnMovementCount === 0) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.storeKeeper.label,
      module: 'Stores',
      step: 'Verify GRN stock ledger',
      pageOrEndpoint: 'stock_movements',
      httpStatus: 200,
      expectedResult: 'GRN posting writes stock movement ledger entries.',
      actualResult: 'No stock movement entries were found for the GRN.',
      rootCauseGuess: 'GRN posting updated balances without recording stock movements.',
      recommendedFix: 'Inspect GRN post route stock movement writes.',
      reproSteps: ['Post GRN', 'Query stock_movements by reference_type=goods_received_note'],
    });
  }

  const productionBefore = await restSelect(
    'stock_balances',
    `select=*&item_id=eq.${state.createdRecords.rawItem.id}&warehouse_id=eq.${productionWarehouseId}&limit=1`,
  );
  const productionBeforeQty = Number(productionBefore.data?.[0]?.quantity_available ?? 0);

  const transferResponse = await appRequest('/api/inventory/transfers', {
    roleKey: 'storeKeeper',
    method: 'POST',
    body: {
      sourceWarehouseId: rawWarehouseId,
      destinationWarehouseId: productionWarehouseId,
      referenceNumber: createRef('TRF').slice(0, 24).toUpperCase(),
      status: 'APPROVED',
      remarks: `${PREFIX} raw to production`,
      items: [
        {
          itemId: state.createdRecords.rawItem.id,
          quantity: 6,
          unitCost: 2.5,
        },
      ],
    },
  });
  addStep({
    module: 'Stores',
    role: ROLE_CONFIG.storeKeeper.label,
    step: 'Create inventory transfer',
    pageOrEndpoint: '/api/inventory/transfers',
    httpStatus: transferResponse.status,
    result: transferResponse.status === 201 ? 'PASS' : 'FAIL',
    details: transferResponse.status === 201 ? 'Transfer created.' : transferResponse.text,
  });
  if (transferResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.storeKeeper.label,
      module: 'Stores',
      step: 'Create inventory transfer',
      pageOrEndpoint: '/api/inventory/transfers',
      httpStatus: transferResponse.status,
      expectedResult: 'Inventory transfer creation succeeds.',
      actualResult: transferResponse.text || 'Transfer create failed.',
      rootCauseGuess: 'Transfer validation or warehouse access blocked creation.',
      recommendedFix: 'Inspect inventory transfer create route, stock checks, and branch scoping.',
      reproSteps: ['POST /api/inventory/transfers with raw->production payload'],
    });
    return false;
  }
  state.createdRecords.transfer = transferResponse.json;

  const transferCompleteResponse = await appRequest(`/api/inventory/transfers/${state.createdRecords.transfer.id}/complete`, {
    roleKey: 'storeKeeper',
    method: 'POST',
  });
  addStep({
    module: 'Stores',
    role: ROLE_CONFIG.storeKeeper.label,
    step: 'Complete inventory transfer',
    pageOrEndpoint: `/api/inventory/transfers/${state.createdRecords.transfer.id}/complete`,
    httpStatus: transferCompleteResponse.status,
    result: transferCompleteResponse.status === 200 ? 'PASS' : 'FAIL',
    details: transferCompleteResponse.status === 200 ? 'Transfer completed.' : transferCompleteResponse.text,
  });
  if (transferCompleteResponse.status !== 200) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.storeKeeper.label,
      module: 'Stores',
      step: 'Complete inventory transfer',
      pageOrEndpoint: `/api/inventory/transfers/${state.createdRecords.transfer.id}/complete`,
      httpStatus: transferCompleteResponse.status,
      expectedResult: 'Approved transfer completes and posts stock movement.',
      actualResult: transferCompleteResponse.text || 'Transfer completion failed.',
      rootCauseGuess: 'Transfer completion stock validation or posting logic failed.',
      recommendedFix: 'Inspect inventory transfer complete route and stock movement guards.',
      reproSteps: ['Create approved transfer', 'POST transfer complete endpoint'],
    });
    return false;
  }

  const duplicateCompleteResponse = await appRequest(`/api/inventory/transfers/${state.createdRecords.transfer.id}/complete`, {
    roleKey: 'storeKeeper',
    method: 'POST',
  });
  addStep({
    module: 'Stores',
    role: ROLE_CONFIG.storeKeeper.label,
    step: 'Prevent duplicate transfer posting',
    pageOrEndpoint: `/api/inventory/transfers/${state.createdRecords.transfer.id}/complete`,
    httpStatus: duplicateCompleteResponse.status,
    result: duplicateCompleteResponse.status >= 400 ? 'PASS' : 'FAIL',
    details: duplicateCompleteResponse.status >= 400 ? 'Duplicate posting blocked.' : duplicateCompleteResponse.text,
  });
  if (duplicateCompleteResponse.status < 400) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.storeKeeper.label,
      module: 'Stores',
      step: 'Prevent duplicate transfer posting',
      pageOrEndpoint: `/api/inventory/transfers/${state.createdRecords.transfer.id}/complete`,
      httpStatus: duplicateCompleteResponse.status,
      expectedResult: 'Completed transfer cannot be posted twice.',
      actualResult: 'Duplicate transfer completion was allowed.',
      rootCauseGuess: 'Transfer completion guard failed to detect completed or already-posted transfer.',
      recommendedFix: 'Inspect transfer completion status and stock movement duplication checks.',
      reproSteps: ['Create transfer', 'Complete transfer', 'POST complete again'],
    });
  }

  const rawPostTransfer = await restSelect(
    'stock_balances',
    `select=*&item_id=eq.${state.createdRecords.rawItem.id}&warehouse_id=eq.${rawWarehouseId}&limit=1`,
  );
  const rawPostTransferQty = Number(rawPostTransfer.data?.[0]?.quantity_available ?? 0);
  const productionAfter = await restSelect(
    'stock_balances',
    `select=*&item_id=eq.${state.createdRecords.rawItem.id}&warehouse_id=eq.${productionWarehouseId}&limit=1`,
  );
  const productionAfterQty = Number(productionAfter.data?.[0]?.quantity_available ?? 0);

  addStep({
    module: 'Stores',
    role: ROLE_CONFIG.storeKeeper.label,
    step: 'Verify transfer balances',
    pageOrEndpoint: 'stock_balances',
    httpStatus: 200,
    result: rawPostTransferQty < rawAfterQty && productionAfterQty > productionBeforeQty ? 'PASS' : 'FAIL',
    details: `Raw before=${rawAfterQty}, raw after=${rawPostTransferQty}, prod before=${productionBeforeQty}, prod after=${productionAfterQty}`,
  });
  if (!(rawPostTransferQty < rawAfterQty && productionAfterQty > productionBeforeQty)) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.storeKeeper.label,
      module: 'Stores',
      step: 'Verify transfer balances',
      pageOrEndpoint: 'stock_balances',
      httpStatus: 200,
      expectedResult: 'Source stock decreases and destination stock increases after transfer.',
      actualResult: `Raw before=${rawAfterQty}, raw after=${rawPostTransferQty}, prod before=${productionBeforeQty}, prod after=${productionAfterQty}`,
      rootCauseGuess: 'Transfer completed without correctly updating source and destination balances.',
      recommendedFix: 'Inspect transfer completion stock balance updates and movement writes.',
      reproSteps: ['Complete transfer', 'Query source and destination stock_balances'],
    });
  }

  return true;
}

async function runProductionFlow() {
  const productionWarehouseId = state.setup.productionWarehouse?.id;
  const finishedWarehouseId = state.setup.finishedWarehouse?.id;
  if (!productionWarehouseId || !finishedWarehouseId || !state.createdRecords.finishedItem?.id || !state.createdRecords.rawItem?.id) {
    return false;
  }

  const recipeResponse = await appRequest('/api/production/recipes', {
    roleKey: 'productionManager',
    method: 'POST',
    body: {
      name: `${PREFIX} Recipe ${Date.now()}`,
      finishedItemId: state.createdRecords.finishedItem.id,
      outputUnitId: state.setup.generalUnit.id,
      expectedOutputQuantity: 4,
      ingredients: [
        {
          itemId: state.createdRecords.rawItem.id,
          unitId: state.setup.generalUnit.id,
          quantityRequired: 4,
        },
      ],
    },
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Create BOM/recipe',
    pageOrEndpoint: '/api/production/recipes',
    httpStatus: recipeResponse.status,
    result: recipeResponse.status === 201 ? 'PASS' : 'FAIL',
    details: recipeResponse.status === 201 ? 'Recipe created.' : recipeResponse.text,
  });
  if (recipeResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.productionManager.label,
      module: 'Production',
      step: 'Create BOM/recipe',
      pageOrEndpoint: '/api/production/recipes',
      httpStatus: recipeResponse.status,
      expectedResult: 'BOM/recipe creation succeeds.',
      actualResult: recipeResponse.text || 'Recipe creation failed.',
      rootCauseGuess: 'Recipe creation validation or production schema mismatch.',
      recommendedFix: 'Inspect recipe POST route, finished-item validation, and recipe item inserts.',
      reproSteps: ['POST /api/production/recipes with E2E finished good and raw material'],
    });
    return false;
  }
  state.createdRecords.recipe = recipeResponse.json;

  const planResponse = await appRequest('/api/production/plans', {
    roleKey: 'productionManager',
    method: 'POST',
    body: {
      planDate: new Date().toISOString().slice(0, 10),
      shift: 'DAY',
      items: [
        {
          recipeId: state.createdRecords.recipe.id,
          plannedQuantity: 4,
          expectedOutput: 4,
        },
      ],
    },
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Create production plan order',
    pageOrEndpoint: '/api/production/plans',
    httpStatus: planResponse.status,
    result: planResponse.status === 201 ? 'PASS' : 'FAIL',
    details: planResponse.status === 201 ? 'Production plan created.' : planResponse.text,
  });
  if (planResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.productionManager.label,
      module: 'Production',
      step: 'Create production plan order',
      pageOrEndpoint: '/api/production/plans',
      httpStatus: planResponse.status,
      expectedResult: 'Production plan creation succeeds.',
      actualResult: planResponse.text || 'Plan creation failed.',
      rootCauseGuess: 'Production plan route validation or table compatibility failure.',
      recommendedFix: 'Inspect production plans POST route and production_plan_items inserts.',
      reproSteps: ['POST /api/production/plans with E2E recipe payload'],
    });
    return false;
  }
  state.createdRecords.plan = planResponse.json;

  const planApproveResponse = await appRequest(`/api/production/plans/${state.createdRecords.plan.id}/approve`, {
    roleKey: 'productionManager',
    method: 'POST',
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Approve production plan order',
    pageOrEndpoint: `/api/production/plans/${state.createdRecords.plan.id}/approve`,
    httpStatus: planApproveResponse.status,
    result: planApproveResponse.status === 200 ? 'PASS' : 'FAIL',
    details: planApproveResponse.status === 200 ? 'Production plan approved.' : planApproveResponse.text,
  });
  if (planApproveResponse.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.productionManager.label,
      module: 'Production',
      step: 'Approve production plan order',
      pageOrEndpoint: `/api/production/plans/${state.createdRecords.plan.id}/approve`,
      httpStatus: planApproveResponse.status,
      expectedResult: 'Production plan approves when stock is sufficient.',
      actualResult: planApproveResponse.text || 'Plan approval failed.',
      rootCauseGuess: 'Material requirement calculation or stock lookup blocked approval.',
      recommendedFix: 'Inspect production plan approval stock requirement calculation.',
      reproSteps: ['Create production plan', 'POST plan approve endpoint'],
    });
  }

  const batchResponse = await appRequest('/api/production/batches', {
    roleKey: 'productionManager',
    method: 'POST',
    body: {
      recipeId: state.createdRecords.recipe.id,
      warehouseId: productionWarehouseId,
      plannedQuantity: 4,
      expectedOutput: 4,
      productionDate: new Date().toISOString().slice(0, 10),
      shift: 'DAY',
    },
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Create production batch',
    pageOrEndpoint: '/api/production/batches',
    httpStatus: batchResponse.status,
    result: batchResponse.status === 201 ? 'PASS' : 'FAIL',
    details: batchResponse.status === 201 ? 'Production batch created.' : batchResponse.text,
  });
  if (batchResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.productionManager.label,
      module: 'Production',
      step: 'Create production batch',
      pageOrEndpoint: '/api/production/batches',
      httpStatus: batchResponse.status,
      expectedResult: 'Production batch creation succeeds.',
      actualResult: batchResponse.text || 'Batch creation failed.',
      rootCauseGuess: 'Production batch create route or warehouse/recipe validation failed.',
      recommendedFix: 'Inspect production batch POST route, warehouse validation, and output row creation.',
      reproSteps: ['POST /api/production/batches with E2E recipe and production warehouse'],
    });
    return false;
  }
  state.createdRecords.batch = batchResponse.json;

  const materialsRequestResponse = await appRequest(`/api/production/batches/${state.createdRecords.batch.id}/request-materials`, {
    roleKey: 'productionManager',
    method: 'POST',
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Request materials',
    pageOrEndpoint: `/api/production/batches/${state.createdRecords.batch.id}/request-materials`,
    httpStatus: materialsRequestResponse.status,
    result: materialsRequestResponse.status === 200 ? 'PASS' : 'FAIL',
    details: materialsRequestResponse.status === 200 ? 'Materials requested.' : materialsRequestResponse.text,
  });

  const materialsApproveResponse = await appRequest(`/api/production/batches/${state.createdRecords.batch.id}/approve-materials`, {
    roleKey: 'productionManager',
    method: 'POST',
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Approve materials',
    pageOrEndpoint: `/api/production/batches/${state.createdRecords.batch.id}/approve-materials`,
    httpStatus: materialsApproveResponse.status,
    result: materialsApproveResponse.status === 200 ? 'PASS' : 'FAIL',
    details: materialsApproveResponse.status === 200 ? 'Materials approved.' : materialsApproveResponse.text,
  });

  const reserveMaterialsResponse = await appRequest(`/api/production/batches/${state.createdRecords.batch.id}/reserve-materials`, {
    roleKey: 'productionManager',
    method: 'POST',
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Release/reserve materials',
    pageOrEndpoint: `/api/production/batches/${state.createdRecords.batch.id}/reserve-materials`,
    httpStatus: reserveMaterialsResponse.status,
    result: reserveMaterialsResponse.status === 200 ? 'PASS' : 'FAIL',
    details: reserveMaterialsResponse.status === 200 ? 'Materials reserved.' : reserveMaterialsResponse.text,
  });
  if (reserveMaterialsResponse.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.productionManager.label,
      module: 'Production',
      step: 'Release/reserve materials',
      pageOrEndpoint: `/api/production/batches/${state.createdRecords.batch.id}/reserve-materials`,
      httpStatus: reserveMaterialsResponse.status,
      expectedResult: 'Production materials are reserved after approval.',
      actualResult: reserveMaterialsResponse.text || 'Material reservation failed.',
      rootCauseGuess: 'Production warehouse stock reservation failed or batch state progression broke.',
      recommendedFix: 'Inspect reserve-materials route and stock reservation logic.',
      reproSteps: ['Create batch', 'Request materials', 'Approve materials', 'POST reserve-materials'],
    });
    return false;
  }

  const productionBefore = await restSelect(
    'stock_balances',
    `select=*&item_id=eq.${state.createdRecords.rawItem.id}&warehouse_id=eq.${productionWarehouseId}&limit=1`,
  );
  const productionBeforeQty = Number(productionBefore.data?.[0]?.quantity_available ?? 0);

  const issueResponse = await appRequest('/api/production/warehouse/issue', {
    roleKey: 'productionManager',
    method: 'POST',
    body: { batchId: state.createdRecords.batch.id },
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Issue materials to production',
    pageOrEndpoint: '/api/production/warehouse/issue',
    httpStatus: issueResponse.status,
    result: issueResponse.status === 200 ? 'PASS' : 'FAIL',
    details: issueResponse.status === 200 ? 'Materials issued.' : issueResponse.text,
  });
  if (issueResponse.status !== 200) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.productionManager.label,
      module: 'Production',
      step: 'Issue materials to production',
      pageOrEndpoint: '/api/production/warehouse/issue',
      httpStatus: issueResponse.status,
      expectedResult: 'Issued materials move batch into production and deduct stock.',
      actualResult: issueResponse.text || 'Material issue failed.',
      rootCauseGuess: 'Batch issue route failed due to stock, status, or batch-material generation.',
      recommendedFix: 'Inspect batch start/issue route and production warehouse stock checks.',
      reproSteps: ['Reserve materials', 'POST /api/production/warehouse/issue with batchId'],
    });
    return false;
  }

  const productionAfterIssue = await restSelect(
    'stock_balances',
    `select=*&item_id=eq.${state.createdRecords.rawItem.id}&warehouse_id=eq.${productionWarehouseId}&limit=1`,
  );
  const productionAfterIssueQty = Number(productionAfterIssue.data?.[0]?.quantity_available ?? 0);
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Verify production materials stock deduction',
    pageOrEndpoint: 'stock_balances',
    httpStatus: 200,
    result: productionAfterIssueQty < productionBeforeQty ? 'PASS' : 'FAIL',
    details: `Before=${productionBeforeQty}, After=${productionAfterIssueQty}`,
  });
  if (productionAfterIssueQty >= productionBeforeQty) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.productionManager.label,
      module: 'Production',
      step: 'Verify production materials stock deduction',
      pageOrEndpoint: 'stock_balances',
      httpStatus: 200,
      expectedResult: 'Issuing materials reduces production warehouse stock.',
      actualResult: `Production stock did not reduce. Before=${productionBeforeQty}, After=${productionAfterIssueQty}`,
      rootCauseGuess: 'Material issue route completed without updating production stock balances.',
      recommendedFix: 'Inspect production issue stock balance updates and movement writes.',
      reproSteps: ['Issue materials to production', 'Query production warehouse stock balance'],
    });
  }

  const outputsResult = await restSelect(
    'production_batch_outputs',
    `select=id,item_id,expected_quantity,actual_quantity&batch_id=eq.${state.createdRecords.batch.id}`,
  );
  const outputRow = Array.isArray(outputsResult.data) ? outputsResult.data[0] : null;
  const outputResponse = await appRequest(`/api/production/batches/${state.createdRecords.batch.id}/output`, {
    roleKey: 'productionManager',
    method: 'POST',
    body: {
      outputs: [
        {
          id: outputRow?.id,
          actualQuantity: 4,
          wastageQuantity: 0,
        },
      ],
    },
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Record production output',
    pageOrEndpoint: `/api/production/batches/${state.createdRecords.batch.id}/output`,
    httpStatus: outputResponse.status,
    result: outputResponse.status === 200 ? 'PASS' : 'FAIL',
    details: outputResponse.status === 200 ? 'Production output recorded.' : outputResponse.text,
  });
  if (outputResponse.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.productionManager.label,
      module: 'Production',
      step: 'Record production output',
      pageOrEndpoint: `/api/production/batches/${state.createdRecords.batch.id}/output`,
      httpStatus: outputResponse.status,
      expectedResult: 'Production output save succeeds.',
      actualResult: outputResponse.text || 'Output save failed.',
      rootCauseGuess: 'Production output row or batch lookup failed.',
      recommendedFix: 'Inspect production output route and batch output row creation.',
      reproSteps: ['Create batch', 'POST batch output endpoint'],
    });
    return false;
  }

  const submitQualityResponse = await appRequest(`/api/production/batches/${state.createdRecords.batch.id}/submit-quality`, {
    roleKey: 'productionManager',
    method: 'POST',
  });
  addStep({
    module: 'Quality',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Submit batch for quality',
    pageOrEndpoint: `/api/production/batches/${state.createdRecords.batch.id}/submit-quality`,
    httpStatus: submitQualityResponse.status,
    result: submitQualityResponse.status === 200 ? 'PASS' : 'FAIL',
    details: submitQualityResponse.status === 200 ? 'Batch moved to quality check.' : submitQualityResponse.text,
  });

  const approveReleaseResponse = await appRequest(`/api/quality/production/${state.createdRecords.batch.id}/approve-release`, {
    roleKey: 'superAdmin',
    method: 'POST',
    body: {
      status: 'PASSED',
      passedQuantity: 4,
      failedQuantity: 0,
      notes: `${PREFIX} quality pass`,
    },
  });
  addStep({
    module: 'Quality',
    role: ROLE_CONFIG.superAdmin.label,
    step: 'Approve quality release',
    pageOrEndpoint: `/api/quality/production/${state.createdRecords.batch.id}/approve-release`,
    httpStatus: approveReleaseResponse.status,
    result: approveReleaseResponse.status === 200 ? 'PASS' : 'FAIL',
    details: approveReleaseResponse.status === 200 ? 'Quality release approved.' : approveReleaseResponse.text,
  });
  if (approveReleaseResponse.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.superAdmin.label,
      module: 'Quality',
      step: 'Approve quality release',
      pageOrEndpoint: `/api/quality/production/${state.createdRecords.batch.id}/approve-release`,
      httpStatus: approveReleaseResponse.status,
      expectedResult: 'QC approval succeeds for pending production batch.',
      actualResult: approveReleaseResponse.text || 'QC approval failed.',
      rootCauseGuess: 'Quality result bridge route or production batch quality state is broken.',
      recommendedFix: 'Inspect quality approve-release proxy and production quality-result route.',
      reproSteps: ['Submit batch for quality', 'POST quality approve-release endpoint'],
    });
    return false;
  }

  const completeBatchResponse = await appRequest(`/api/production/batches/${state.createdRecords.batch.id}/complete`, {
    roleKey: 'productionManager',
    method: 'POST',
    body: {
      actualMaterials: [
        {
          itemId: state.createdRecords.rawItem.id,
          quantityActual: 4,
        },
      ],
    },
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Release finished goods',
    pageOrEndpoint: `/api/production/batches/${state.createdRecords.batch.id}/complete`,
    httpStatus: completeBatchResponse.status,
    result: completeBatchResponse.status === 200 ? 'PASS' : 'FAIL',
    details: completeBatchResponse.status === 200 ? 'Batch completed and finished goods released.' : completeBatchResponse.text,
  });
  if (completeBatchResponse.status !== 200) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.productionManager.label,
      module: 'Production',
      step: 'Release finished goods',
      pageOrEndpoint: `/api/production/batches/${state.createdRecords.batch.id}/complete`,
      httpStatus: completeBatchResponse.status,
      expectedResult: 'Completed QC batch releases finished goods.',
      actualResult: completeBatchResponse.text || 'Finished goods release failed.',
      rootCauseGuess: 'Batch completion route failed on material issue finalization or finished goods stock posting.',
      recommendedFix: 'Inspect production batch close route and finished goods stock balance creation.',
      reproSteps: ['Approve quality release', 'POST production batch complete endpoint'],
    });
    return false;
  }

  const finishedBeforeMain = await restSelect(
    'stock_balances',
    `select=*&item_id=eq.${state.createdRecords.finishedItem.id}&warehouse_id=eq.${finishedWarehouseId}&limit=1`,
  );
  const finishedBeforeMainQty = Number(finishedBeforeMain.data?.[0]?.quantity_available ?? 0);

  const transferFinishedResponse = await appRequest('/api/production/warehouse/transfer-to-main', {
    roleKey: 'productionManager',
    method: 'POST',
    body: {
      batchId: state.createdRecords.batch.id,
      destinationWarehouseId: finishedWarehouseId,
      receivedBy: 'E2E Verifier',
    },
  });
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Transfer finished goods to main warehouse',
    pageOrEndpoint: '/api/production/warehouse/transfer-to-main',
    httpStatus: transferFinishedResponse.status,
    result: transferFinishedResponse.status === 201 ? 'PASS' : 'FAIL',
    details: transferFinishedResponse.status === 201 ? 'Finished goods transferred to main warehouse.' : transferFinishedResponse.text,
  });
  if (transferFinishedResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.productionManager.label,
      module: 'Production',
      step: 'Transfer finished goods to main warehouse',
      pageOrEndpoint: '/api/production/warehouse/transfer-to-main',
      httpStatus: transferFinishedResponse.status,
      expectedResult: 'Completed batch finished goods transfer to main warehouse succeeds.',
      actualResult: transferFinishedResponse.text || 'Finished goods transfer failed.',
      rootCauseGuess: 'Finished goods transfer route failed to resolve batch outputs or warehouse access.',
      recommendedFix: 'Inspect production transfer-to-main route and stock transfer insert logic.',
      reproSteps: ['Complete batch', 'POST transfer-to-main endpoint with batchId and finished warehouse'],
    });
    return false;
  }

  const finishedAfterMain = await restSelect(
    'stock_balances',
    `select=*&item_id=eq.${state.createdRecords.finishedItem.id}&warehouse_id=eq.${finishedWarehouseId}&limit=1`,
  );
  const finishedAfterMainQty = Number(finishedAfterMain.data?.[0]?.quantity_available ?? 0);
  addStep({
    module: 'Production',
    role: ROLE_CONFIG.productionManager.label,
    step: 'Verify main finished goods stock increase',
    pageOrEndpoint: 'stock_balances',
    httpStatus: 200,
    result: finishedAfterMainQty > finishedBeforeMainQty ? 'PASS' : 'FAIL',
    details: `Before=${finishedBeforeMainQty}, After=${finishedAfterMainQty}`,
  });
  if (finishedAfterMainQty <= finishedBeforeMainQty) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.productionManager.label,
      module: 'Production',
      step: 'Verify main finished goods stock increase',
      pageOrEndpoint: 'stock_balances',
      httpStatus: 200,
      expectedResult: 'Main finished goods stock increases after transfer.',
      actualResult: `Before=${finishedBeforeMainQty}, After=${finishedAfterMainQty}`,
      rootCauseGuess: 'Finished goods transfer completed without posting destination stock.',
      recommendedFix: 'Inspect production finished goods transfer stock balance writes.',
      reproSteps: ['Transfer finished goods to main warehouse', 'Query main finished goods stock balance'],
    });
  }

  return true;
}

async function runSalesFlow() {
  const finishedWarehouseId = state.setup.finishedWarehouse?.id;
  if (!finishedWarehouseId || !state.createdRecords.finishedItem?.id) return false;

  const customerResponse = await appRequest('/api/sales/customers', {
    roleKey: 'salesRep',
    method: 'POST',
    body: {
      name: `${createRef('CUS')} Customer`,
      email: `e2e.customer.${Date.now()}@absoluteicecream.co.zw`,
      phone: '+263772000000',
      paymentTerms: 'Cash',
      creditLimit: 200,
      status: 'ACTIVE',
    },
  });
  addStep({
    module: 'Sales',
    role: ROLE_CONFIG.salesRep.label,
    step: 'Create customer',
    pageOrEndpoint: '/api/sales/customers',
    httpStatus: customerResponse.status,
    result: customerResponse.status === 201 ? 'PASS' : 'FAIL',
    details: customerResponse.status === 201 ? 'Customer created.' : customerResponse.text,
  });
  if (customerResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.salesRep.label,
      module: 'Sales',
      step: 'Create customer',
      pageOrEndpoint: '/api/sales/customers',
      httpStatus: customerResponse.status,
      expectedResult: 'Customer creation succeeds.',
      actualResult: customerResponse.text || 'Customer creation failed.',
      rootCauseGuess: 'Customer create validation or live customer schema compatibility issue.',
      recommendedFix: 'Inspect customer create route and balance snapshot mapping.',
      reproSteps: ['POST /api/sales/customers with E2E payload'],
    });
    return false;
  }
  state.createdRecords.customer = customerResponse.json;

  const finishedBefore = await restSelect(
    'stock_balances',
    `select=*&item_id=eq.${state.createdRecords.finishedItem.id}&warehouse_id=eq.${finishedWarehouseId}&limit=1`,
  );
  const finishedBeforeQty = Number(finishedBefore.data?.[0]?.quantity_available ?? 0);

  const quotationResponse = await appRequest('/api/sales/quotations', {
    roleKey: 'salesRep',
    method: 'POST',
    body: {
      customerId: state.createdRecords.customer.id,
      notes: `${PREFIX} quotation`,
      discountAmount: 0,
      taxAmount: 0,
      items: [
        {
          itemId: state.createdRecords.finishedItem.id,
          quantity: 1,
          unitPrice: 12,
        },
      ],
    },
  });
  addStep({
    module: 'Sales',
    role: ROLE_CONFIG.salesRep.label,
    step: 'Create quotation',
    pageOrEndpoint: '/api/sales/quotations',
    httpStatus: quotationResponse.status,
    result: quotationResponse.status === 201 ? 'PASS' : 'FAIL',
    details: quotationResponse.status === 201 ? 'Quotation created.' : quotationResponse.text,
  });

  if (quotationResponse.status === 201) {
    state.createdRecords.quotation = quotationResponse.json;
    const quotationApproveResponse = await appRequest(`/api/sales/quotations/${state.createdRecords.quotation.id}/approve`, {
      roleKey: 'salesRep',
      method: 'POST',
    });
    addStep({
      module: 'Sales',
      role: ROLE_CONFIG.salesRep.label,
      step: 'Approve quotation',
      pageOrEndpoint: `/api/sales/quotations/${state.createdRecords.quotation.id}/approve`,
      httpStatus: quotationApproveResponse.status,
      result: quotationApproveResponse.status === 200 ? 'PASS' : 'FAIL',
      details: quotationApproveResponse.status === 200 ? 'Quotation approved.' : quotationApproveResponse.text,
    });
  }

  const salesOrderResponse = await appRequest('/api/sales/orders', {
    roleKey: 'salesRep',
    method: 'POST',
    body: {
      customerId: state.createdRecords.customer.id,
      warehouseId: finishedWarehouseId,
      notes: `${PREFIX} order`,
      discountAmount: 0,
      taxAmount: 0,
      items: [
        {
          itemId: state.createdRecords.finishedItem.id,
          quantityOrdered: 1,
          unitPrice: 12,
        },
      ],
    },
  });
  addStep({
    module: 'Sales',
    role: ROLE_CONFIG.salesRep.label,
    step: 'Create sales order',
    pageOrEndpoint: '/api/sales/orders',
    httpStatus: salesOrderResponse.status,
    result: salesOrderResponse.status === 201 ? 'PASS' : 'FAIL',
    details: salesOrderResponse.status === 201 ? 'Sales order created.' : salesOrderResponse.text,
  });
  if (salesOrderResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.salesRep.label,
      module: 'Sales',
      step: 'Create sales order',
      pageOrEndpoint: '/api/sales/orders',
      httpStatus: salesOrderResponse.status,
      expectedResult: 'Sales order creation succeeds.',
      actualResult: salesOrderResponse.text || 'Sales order creation failed.',
      rootCauseGuess: 'Sales order validation or warehouse/item access failed.',
      recommendedFix: 'Inspect sales order create route and finished-goods warehouse access.',
      reproSteps: ['POST /api/sales/orders with finished goods item and main FG warehouse'],
    });
    return false;
  }
  state.createdRecords.salesOrder = salesOrderResponse.json;

  const orderConfirmResponse = await appRequest(`/api/sales/orders/${state.createdRecords.salesOrder.id}/confirm`, {
    roleKey: 'salesRep',
    method: 'POST',
  });
  addStep({
    module: 'Sales',
    role: ROLE_CONFIG.salesRep.label,
    step: 'Confirm sales order',
    pageOrEndpoint: `/api/sales/orders/${state.createdRecords.salesOrder.id}/confirm`,
    httpStatus: orderConfirmResponse.status,
    result: orderConfirmResponse.status === 200 ? 'PASS' : 'FAIL',
    details: orderConfirmResponse.status === 200 ? 'Sales order confirmed.' : orderConfirmResponse.text,
  });

  const invoiceResponse = await appRequest('/api/sales/invoices', {
    roleKey: 'salesRep',
    method: 'POST',
    body: {
      customerId: state.createdRecords.customer.id,
      salesOrderId: state.createdRecords.salesOrder.id,
      discountAmount: 0,
      taxAmount: 0,
    },
  });
  addStep({
    module: 'Sales',
    role: ROLE_CONFIG.salesRep.label,
    step: 'Create invoice',
    pageOrEndpoint: '/api/sales/invoices',
    httpStatus: invoiceResponse.status,
    result: invoiceResponse.status === 201 ? 'PASS' : 'FAIL',
    details: invoiceResponse.status === 201 ? 'Invoice created.' : invoiceResponse.text,
  });
  if (invoiceResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.salesRep.label,
      module: 'Sales',
      step: 'Create invoice',
      pageOrEndpoint: '/api/sales/invoices',
      httpStatus: invoiceResponse.status,
      expectedResult: 'Sales invoice creation succeeds.',
      actualResult: invoiceResponse.text || 'Invoice creation failed.',
      rootCauseGuess: 'Invoice create route or sales-order linkage failed.',
      recommendedFix: 'Inspect invoice POST route and legacy invoice schema fallbacks.',
      reproSteps: ['Create and confirm sales order', 'POST /api/sales/invoices with salesOrderId'],
    });
    return false;
  }
  state.createdRecords.invoice = invoiceResponse.json;

  const invoiceApproveResponse = await appRequest(`/api/sales/invoices/${state.createdRecords.invoice.id}/approve`, {
    roleKey: 'salesRep',
    method: 'POST',
  });
  addStep({
    module: 'Sales',
    role: ROLE_CONFIG.salesRep.label,
    step: 'Approve invoice',
    pageOrEndpoint: `/api/sales/invoices/${state.createdRecords.invoice.id}/approve`,
    httpStatus: invoiceApproveResponse.status,
    result: invoiceApproveResponse.status === 200 ? 'PASS' : 'FAIL',
    details: invoiceApproveResponse.status === 200 ? 'Invoice approved.' : invoiceApproveResponse.text,
  });
  if (invoiceApproveResponse.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.salesRep.label,
      module: 'Sales',
      step: 'Approve invoice',
      pageOrEndpoint: `/api/sales/invoices/${state.createdRecords.invoice.id}/approve`,
      httpStatus: invoiceApproveResponse.status,
      expectedResult: 'Invoice approval reserves stock successfully.',
      actualResult: invoiceApproveResponse.text || 'Invoice approval failed.',
      rootCauseGuess: 'Finished goods stock reservation or customer credit check failed.',
      recommendedFix: 'Inspect invoice approve route, stock lookup, and reserveInvoiceStock.',
      reproSteps: ['Create invoice', 'POST invoice approve endpoint'],
    });
    return false;
  }

  const invoiceItemsResponse = await restSelect(
    'invoice_items',
    `select=id,item_id,quantity&invoice_id=eq.${state.createdRecords.invoice.id}`,
  );
  const invoiceItem = Array.isArray(invoiceItemsResponse.data) ? invoiceItemsResponse.data[0] : null;

  const dispatchResponse = await appRequest('/api/sales/dispatches', {
    roleKey: 'salesRep',
    method: 'POST',
    body: {
      invoiceId: state.createdRecords.invoice.id,
      warehouseId: finishedWarehouseId,
      items: [
        {
          invoiceItemId: invoiceItem?.id,
          itemId: state.createdRecords.finishedItem.id,
          quantityDispatched: 1,
          quantityInvoiced: 1,
        },
      ],
    },
  });
  addStep({
    module: 'Sales',
    role: ROLE_CONFIG.salesRep.label,
    step: 'Create dispatch note',
    pageOrEndpoint: '/api/sales/dispatches',
    httpStatus: dispatchResponse.status,
    result: dispatchResponse.status === 201 ? 'PASS' : 'FAIL',
    details: dispatchResponse.status === 201 ? 'Dispatch created.' : dispatchResponse.text,
  });
  if (dispatchResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.salesRep.label,
      module: 'Sales',
      step: 'Create dispatch note',
      pageOrEndpoint: '/api/sales/dispatches',
      httpStatus: dispatchResponse.status,
      expectedResult: 'Approved invoice can create a dispatch note.',
      actualResult: dispatchResponse.text || 'Dispatch creation failed.',
      rootCauseGuess: 'Dispatch route failed due to invoice status or invoice item linkage.',
      recommendedFix: 'Inspect sales dispatch create route and invoice status gating.',
      reproSteps: ['Approve invoice', 'POST /api/sales/dispatches with invoice item'],
    });
    return false;
  }
  state.createdRecords.dispatch = dispatchResponse.json;

  const dispatchPostResponse = await appRequest(`/api/sales/dispatches/${state.createdRecords.dispatch.id}/post`, {
    roleKey: 'salesRep',
    method: 'POST',
  });
  addStep({
    module: 'Sales',
    role: ROLE_CONFIG.salesRep.label,
    step: 'Post dispatch note',
    pageOrEndpoint: `/api/sales/dispatches/${state.createdRecords.dispatch.id}/post`,
    httpStatus: dispatchPostResponse.status,
    result: dispatchPostResponse.status === 200 ? 'PASS' : 'FAIL',
    details: dispatchPostResponse.status === 200 ? 'Dispatch posted.' : dispatchPostResponse.text,
  });
  if (dispatchPostResponse.status !== 200) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.salesRep.label,
      module: 'Sales',
      step: 'Post dispatch note',
      pageOrEndpoint: `/api/sales/dispatches/${state.createdRecords.dispatch.id}/post`,
      httpStatus: dispatchPostResponse.status,
      expectedResult: 'Dispatch posting deducts finished goods stock.',
      actualResult: dispatchPostResponse.text || 'Dispatch posting failed.',
      rootCauseGuess: 'Dispatch posting workflow lock, stock update, or posting log insertion failed.',
      recommendedFix: 'Inspect dispatch post route, stock balance deduction, and posting_logs/document_locks dependencies.',
      reproSteps: ['Create dispatch', 'POST dispatch post endpoint'],
    });
    return false;
  }

  const finishedAfter = await restSelect(
    'stock_balances',
    `select=*&item_id=eq.${state.createdRecords.finishedItem.id}&warehouse_id=eq.${finishedWarehouseId}&limit=1`,
  );
  const finishedAfterQty = Number(finishedAfter.data?.[0]?.quantity_available ?? 0);
  addStep({
    module: 'Sales',
    role: ROLE_CONFIG.salesRep.label,
    step: 'Verify finished goods stock reduction',
    pageOrEndpoint: 'stock_balances',
    httpStatus: 200,
    result: finishedAfterQty < finishedBeforeQty ? 'PASS' : 'FAIL',
    details: `Before=${finishedBeforeQty}, After=${finishedAfterQty}`,
  });
  if (finishedAfterQty >= finishedBeforeQty) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.salesRep.label,
      module: 'Sales',
      step: 'Verify finished goods stock reduction',
      pageOrEndpoint: 'stock_balances',
      httpStatus: 200,
      expectedResult: 'Posted dispatch reduces main finished goods stock.',
      actualResult: `Before=${finishedBeforeQty}, After=${finishedAfterQty}`,
      rootCauseGuess: 'Dispatch post completed without deducting finished goods stock.',
      recommendedFix: 'Inspect sales dispatch post route stock balance update logic.',
      reproSteps: ['Approve invoice', 'Post dispatch', 'Query finished goods warehouse stock balance'],
    });
  }

  const paymentResponse = await appRequest('/api/sales/payments', {
    roleKey: 'salesRep',
    method: 'POST',
    body: {
      customerId: state.createdRecords.customer.id,
      invoiceId: state.createdRecords.invoice.id,
      amount: 12,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'CASH',
      referenceNumber: createRef('PAY').slice(0, 24).toUpperCase(),
      remarks: `${PREFIX} payment`,
    },
  });
  addStep({
    module: 'Sales',
    role: ROLE_CONFIG.salesRep.label,
    step: 'Record customer payment',
    pageOrEndpoint: '/api/sales/payments',
    httpStatus: paymentResponse.status,
    result: paymentResponse.status === 201 ? 'PASS' : 'FAIL',
    details: paymentResponse.status === 201 ? 'Payment recorded.' : paymentResponse.text,
  });
  if (paymentResponse.status !== 201) {
    recordFailure({
      severity: 'CRITICAL',
      role: ROLE_CONFIG.salesRep.label,
      module: 'Sales',
      step: 'Record customer payment',
      pageOrEndpoint: '/api/sales/payments',
      httpStatus: paymentResponse.status,
      expectedResult: 'Customer payment records successfully.',
      actualResult: paymentResponse.text || 'Payment recording failed.',
      rootCauseGuess: 'Payment route failed on invoice lookup or payment amount validation.',
      recommendedFix: 'Inspect sales payments route and invoice balance update logic.',
      reproSteps: ['Post dispatch / approved invoice exists', 'POST /api/sales/payments'],
    });
    return false;
  }
  state.createdRecords.payment = paymentResponse.json;

  const customerAfter = await restSelect(
    'customers',
    `select=id,current_balance&id=eq.${state.createdRecords.customer.id}&limit=1`,
  );
  const customerBalance = Number(customerAfter.data?.[0]?.current_balance ?? 0);
  addStep({
    module: 'Sales',
    role: ROLE_CONFIG.salesRep.label,
    step: 'Verify customer balance update',
    pageOrEndpoint: 'customers',
    httpStatus: 200,
    result: customerBalance === 0 ? 'PASS' : 'FAIL',
    details: `Current balance=${customerBalance}`,
  });
  if (customerBalance !== 0) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.salesRep.label,
      module: 'Sales',
      step: 'Verify customer balance update',
      pageOrEndpoint: 'customers',
      httpStatus: 200,
      expectedResult: 'Customer balance is cleared after full payment.',
      actualResult: `Current balance remained ${customerBalance}.`,
      rootCauseGuess: 'Payment update did not fully reconcile invoice and customer balance.',
      recommendedFix: 'Inspect sales payment route customer balance update logic.',
      reproSteps: ['Create invoice', 'Record full payment', 'Query customer current_balance'],
    });
  }

  return true;
}

async function runFinanceAndReportsFlow({ shouldExpectJournals }) {
  const financeTransactions = await appRequest('/api/finance/transactions', { roleKey: 'accountant' });
  addStep({
    module: 'Finance',
    role: ROLE_CONFIG.accountant.label,
    step: 'Load finance transaction trace',
    pageOrEndpoint: '/api/finance/transactions',
    httpStatus: financeTransactions.status,
    result: financeTransactions.status === 200 ? 'PASS' : 'FAIL',
    details: financeTransactions.status === 200 ? 'Finance transactions loaded.' : financeTransactions.text,
  });

  if (shouldExpectJournals) {
    const journalEntries = await restSelect('journal_entries', 'select=*&limit=20&order=created_at.desc');
    const journalCount = Array.isArray(journalEntries.data) ? journalEntries.data.length : 0;
    addStep({
      module: 'Finance',
      role: ROLE_CONFIG.accountant.label,
      step: 'Verify journal entries exist',
      pageOrEndpoint: 'journal_entries',
      httpStatus: journalEntries.status,
      result: journalCount > 0 ? 'PASS' : 'FAIL',
      details: `Journal entry count=${journalCount}`,
    });
    if (journalCount === 0) {
      recordFailure({
        severity: 'CRITICAL',
        role: ROLE_CONFIG.accountant.label,
        module: 'Finance',
        step: 'Verify journal entries exist',
        pageOrEndpoint: 'journal_entries',
        httpStatus: journalEntries.status,
        expectedResult: 'Posted procurement, inventory, production, sales, and payment activity produces finance journals.',
        actualResult: 'No journal entries were found after the E2E transaction flow.',
        rootCauseGuess: 'Operational posting routes do not create finance journals in the live system.',
        recommendedFix: 'Implement or reconnect finance journal posting for procurement, inventory, production, sales, and payments.',
        reproSteps: ['Run the E2E operational flow', 'Query journal_entries'],
      });
    }
  } else {
    addObservation('Skipped journal-entry existence assertion because the operational transaction flow did not complete.');
  }

  for (const reportType of ['SUPPLIER_PURCHASE', 'INVENTORY_VALUATION', 'DAILY_PRODUCTION', 'TRIAL_BALANCE', 'INCOME_STATEMENT', 'FINANCIAL_POSITION']) {
    const response = await appRequest(`/api/reports?reportType=${reportType}`, { roleKey: 'superAdmin' });
    addStep({
      module: 'Reports',
      role: ROLE_CONFIG.superAdmin.label,
      step: `Load report ${reportType}`,
      pageOrEndpoint: `/api/reports?reportType=${reportType}`,
      httpStatus: response.status,
      result: response.status === 200 ? 'PASS' : 'FAIL',
      details: response.status === 200 ? 'Report loaded.' : response.text,
    });
    if (response.status !== 200) {
      recordFailure({
        severity: reportType.startsWith('TRIAL') || reportType.startsWith('INCOME') || reportType.startsWith('FINANCIAL') ? 'HIGH' : 'MEDIUM',
        role: ROLE_CONFIG.superAdmin.label,
        module: 'Reports',
        step: `Load report ${reportType}`,
        pageOrEndpoint: `/api/reports?reportType=${reportType}`,
        httpStatus: response.status,
        expectedResult: 'Report loads without internal server error.',
        actualResult: response.text || 'Report request failed.',
        rootCauseGuess: 'Report route or underlying source query failed.',
        recommendedFix: 'Inspect report route and source query null-safety for the failing report.',
        reproSteps: [`GET /api/reports?reportType=${reportType}`],
      });
    }
  }
}

async function runAuditFlow() {
  const auditorAuditLogs = await appRequest('/api/settings/audit-logs?page=1&pageSize=100', { roleKey: 'auditor' });
  addStep({
    module: 'Audit',
    role: ROLE_CONFIG.auditor.label,
    step: 'Load audit log view',
    pageOrEndpoint: '/api/settings/audit-logs',
    httpStatus: auditorAuditLogs.status,
    result: auditorAuditLogs.status === 200 ? 'PASS' : 'FAIL',
    details: auditorAuditLogs.status === 200 ? 'Auditor audit view loaded.' : auditorAuditLogs.text,
  });
  if (auditorAuditLogs.status !== 200) {
    recordFailure({
      severity: 'HIGH',
      role: ROLE_CONFIG.auditor.label,
      module: 'Audit',
      step: 'Load audit log view',
      pageOrEndpoint: '/api/settings/audit-logs',
      httpStatus: auditorAuditLogs.status,
      expectedResult: 'Auditor can access read-only audit logs.',
      actualResult: auditorAuditLogs.text || 'Auditor audit view failed.',
      rootCauseGuess: 'Auditor permission mapping for audit logs is broken.',
      recommendedFix: 'Inspect auditor role permissions for settings/audit read access.',
      reproSteps: ['Login as auditor', 'GET /api/settings/audit-logs'],
    });
  }

  const auditChecks = [
    { action: 'SUPPLIER_CREATED', entityId: state.createdRecords.supplier?.id, label: 'Supplier creation' },
    { action: 'GRN_POSTED', entityId: state.createdRecords.grn?.id, label: 'GRN posting' },
    { action: 'INVENTORY_TRANSFER_COMPLETED', entityId: state.createdRecords.transfer?.id, label: 'Inventory transfer' },
    { action: 'PRODUCTION_RECIPE_CREATED', entityId: state.createdRecords.recipe?.id, label: 'BOM creation' },
    { action: 'PRODUCTION_PLAN_CREATED', entityId: state.createdRecords.plan?.id, label: 'Production plan creation' },
    { action: 'PRODUCTION_MATERIALS_ISSUED', entityId: state.createdRecords.batch?.id, label: 'Material issue' },
    { action: 'PRODUCTION_BATCH_COMPLETED', entityId: state.createdRecords.batch?.id, label: 'Finished goods release' },
    { action: 'SALES_DISPATCH_POSTED', entityId: state.createdRecords.dispatch?.id, label: 'Sales dispatch posting' },
    { action: 'SALES_PAYMENT_RECORDED', entityId: state.createdRecords.payment?.id, label: 'Payment posting' },
  ];

  for (const auditCheck of auditChecks) {
    if (!auditCheck.entityId) continue;
    const response = await restSelect(
      'audit_logs',
      `select=id,action,entity_id,entity_type,created_at&action=eq.${auditCheck.action}&entity_id=eq.${auditCheck.entityId}&limit=1`,
    );
    const exists = Array.isArray(response.data) && response.data.length > 0;
    addStep({
      module: 'Audit',
      role: ROLE_CONFIG.auditor.label,
      step: `Verify audit log for ${auditCheck.label}`,
      pageOrEndpoint: 'audit_logs',
      httpStatus: response.status,
      result: exists ? 'PASS' : 'FAIL',
      details: exists ? 'Audit log found.' : 'Audit log missing.',
    });
    if (!exists) {
      recordFailure({
        severity: 'HIGH',
        role: ROLE_CONFIG.auditor.label,
        module: 'Audit',
        step: `Verify audit log for ${auditCheck.label}`,
        pageOrEndpoint: 'audit_logs',
        httpStatus: response.status,
        expectedResult: `${auditCheck.label} creates an audit trail entry.`,
        actualResult: `No audit log found for action ${auditCheck.action}.`,
        rootCauseGuess: 'Operational route completed without writing audit_logs.',
        recommendedFix: 'Add or restore audit logging for the affected workflow action.',
        reproSteps: ['Run the E2E flow', `Query audit_logs for action ${auditCheck.action} and entity id ${auditCheck.entityId}`],
      });
    }
  }
}

function buildSummary() {
  const counts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  for (const defect of state.defects) {
    counts[defect.severity] = (counts[defect.severity] ?? 0) + 1;
  }
  return {
    finishedAt: nowIso(),
    totalSteps: state.steps.length,
    passedSteps: state.steps.filter((step) => step.result === 'PASS').length,
    failedSteps: state.steps.filter((step) => step.result === 'FAIL').length,
    defectCounts: counts,
  };
}

function toMarkdown(result) {
  const lines = [];
  lines.push('# Live E2E Transaction Verification');
  lines.push('');
  lines.push(`- Base URL: \`${result.baseUrl}\``);
  lines.push(`- Started: \`${result.startedAt}\``);
  lines.push(`- Finished: \`${result.summary.finishedAt}\``);
  lines.push(`- Steps: \`${result.summary.totalSteps}\``);
  lines.push(`- Passed: \`${result.summary.passedSteps}\``);
  lines.push(`- Failed: \`${result.summary.failedSteps}\``);
  lines.push('');
  lines.push('## Defect Counts');
  lines.push('');
  for (const [severity, count] of Object.entries(result.summary.defectCounts)) {
    lines.push(`- ${severity}: ${count}`);
  }
  lines.push('');
  lines.push('## Created Records');
  lines.push('');
  for (const [key, value] of Object.entries(result.createdRecords)) {
    if (!value) continue;
    lines.push(`- ${key}: \`${typeof value === 'object' && value.id ? value.id : JSON.stringify(value)}\``);
  }
  lines.push('');
  lines.push('## Step Results');
  lines.push('');
  lines.push('| Module | Role | Step | Endpoint | Status | Result | Details |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const step of result.steps) {
    lines.push(`| ${step.module} | ${step.role} | ${step.step} | \`${step.pageOrEndpoint}\` | ${step.httpStatus} | ${step.result} | ${String(step.details ?? '').replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  lines.push('## Defect Matrix');
  lines.push('');
  if (result.defects.length === 0) {
    lines.push('No defects were recorded.');
  } else {
    lines.push('| ID | Severity | Role | Module | Step | Endpoint | HTTP | Expected | Actual | Root Cause Guess | Recommended Fix |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const defect of result.defects) {
      lines.push(`| ${defect.defectId} | ${defect.severity} | ${defect.role} | ${defect.module} | ${defect.step} | \`${defect.pageOrEndpoint}\` | ${defect.httpStatus} | ${String(defect.expectedResult).replace(/\|/g, '\\|')} | ${String(defect.actualResult).replace(/\|/g, '\\|')} | ${String(defect.rootCauseGuess).replace(/\|/g, '\\|')} | ${String(defect.recommendedFix).replace(/\|/g, '\\|')} |`);
    }
  }
  lines.push('');
  lines.push('## Observations');
  lines.push('');
  if (result.observations.length === 0) {
    lines.push('- None');
  } else {
    for (const observation of result.observations) {
      lines.push(`- ${observation.message}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function writeOutputs() {
  const summary = buildSummary();
  const roles = Object.fromEntries(
    Object.entries(state.roles).map(([roleKey, role]) => [
      roleKey,
      {
        label: role.label,
        workId: role.workId,
      },
    ]),
  );
  const result = {
    ...state,
    roles,
    summary,
  };
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(JSON_OUTPUT_PATH, JSON.stringify(result, null, 2));
  await fs.writeFile(MD_OUTPUT_PATH, toMarkdown(result));
  return result;
}

async function main() {
  await authenticateRoles();
  await verifySetup();

  const procurementReady = await createSupplierAndItems();
  let procurementComplete = false;
  let storesComplete = false;
  let productionComplete = false;
  let salesComplete = false;
  if (procurementReady) {
    procurementComplete = await runProcurementFlow();
    state.flowStatus.procurement = procurementComplete;

    if (procurementComplete) {
      storesComplete = await runStoresFlow();
      state.flowStatus.stores = storesComplete;
    }

    if (storesComplete) {
      productionComplete = await runProductionFlow();
      state.flowStatus.production = productionComplete;
    }

    if (productionComplete) {
      salesComplete = await runSalesFlow();
      state.flowStatus.sales = salesComplete;
    }
  }

  await runFinanceAndReportsFlow({ shouldExpectJournals: salesComplete });
  await runAuditFlow();

  const result = await writeOutputs();
  console.log(JSON.stringify({
    jsonOutput: JSON_OUTPUT_PATH,
    markdownOutput: MD_OUTPUT_PATH,
    defectCounts: result.summary.defectCounts,
    failedSteps: result.summary.failedSteps,
    createdRecords: Object.fromEntries(
      Object.entries(result.createdRecords).map(([key, value]) => [key, value?.id ?? value ?? null]),
    ),
  }, null, 2));

  if (result.summary.failedSteps > 0 || result.defects.some((defect) => defect.severity === 'CRITICAL')) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  addDefect({
    severity: 'CRITICAL',
    role: 'System',
    module: 'Verifier',
    step: 'Execution',
    pageOrEndpoint: 'scripts/verify-live-e2e-transactions.mjs',
    httpStatus: 0,
    expectedResult: 'Verifier completes and writes output files.',
    actualResult: error instanceof Error ? error.message : String(error),
    rootCauseGuess: 'Verifier implementation error or unrecoverable upstream failure.',
    recommendedFix: 'Inspect verifier stack trace and failing upstream dependency.',
    reproSteps: ['Run node scripts/verify-live-e2e-transactions.mjs'],
  });
  const result = await writeOutputs().catch(() => null);
  if (result) {
    console.log(JSON.stringify({
      jsonOutput: JSON_OUTPUT_PATH,
      markdownOutput: MD_OUTPUT_PATH,
      fatal: error instanceof Error ? error.message : String(error),
    }, null, 2));
  }
  process.exitCode = 1;
});
