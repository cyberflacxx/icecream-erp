import fs from 'fs';

const rawEnv = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');

const PRODUCTION_SMOKE_SETUP_FAILED = 'PRODUCTION_SMOKE_SETUP_FAILED';

function getEnv(key) {
  const match = rawEnv.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].replace(/^"|"$/g, '').trim() : '';
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const SCHEMA = 'icecream_erp';
const FETCH_TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS || 30000);
const TRANSFER_QUANTITY = Number(process.env.PRODUCTION_RECEIVE_QTY || 1);
const PRODUCTION_WORK_ID = process.env.PRODUCTION_SMOKE_WORK_ID || process.env.SMOKE_WORK_ID || '';
const PRODUCTION_PASSWORD = process.env.PRODUCTION_SMOKE_PASSWORD || process.env.SMOKE_PASSWORD || '';
const LOCAL_SMOKE_ENABLED = process.env.PRODUCTION_SMOKE_LOCAL === '1' || process.env.PRODUCTION_SMOKE_LOCAL === 'true';
const BASE_URL =
  process.env.PRODUCTION_SMOKE_BASE_URL ||
  process.env.ABSOLUTE_ERP_BASE_URL ||
  (LOCAL_SMOKE_ENABLED ? 'http://127.0.0.1:3000' : '');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables in .env');
}

if (!PRODUCTION_WORK_ID || !PRODUCTION_PASSWORD) {
  throw new Error('Production receive smoke requires PRODUCTION_SMOKE_WORK_ID/PRODUCTION_SMOKE_PASSWORD or SMOKE_WORK_ID/SMOKE_PASSWORD.');
}

if (!BASE_URL) {
  throw new Error('Production receive smoke requires PRODUCTION_SMOKE_BASE_URL or ABSOLUTE_ERP_BASE_URL. Set PRODUCTION_SMOKE_LOCAL=1 only when intentionally running local.');
}

const restHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'accept-profile': SCHEMA,
  'content-profile': SCHEMA,
  'content-type': 'application/json',
};

function toNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function isOkStatus(status) {
  return status >= 200 && status < 300;
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

async function rest(table, { query = 'select=*', method = 'GET', body, prefer } = {}) {
  const headers = { ...restHeaders };
  if (prefer) headers.prefer = prefer;

  const response = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = typeof data === 'object' && data?.message ? data.message : text || `${response.status} ${response.statusText}`;
    throw new Error(`${table}: ${message}`);
  }

  return data;
}

async function login() {
  console.log(`Using production smoke work ID: ${PRODUCTION_WORK_ID}`);
  const response = await fetchWithTimeout(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PRODUCTION_PASSWORD, workId: PRODUCTION_WORK_ID }),
    redirect: 'manual',
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Login failed for ${PRODUCTION_WORK_ID}: ${response.status} ${text}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Login did not return a session cookie.');
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

  return { json, route: path, status: response.status, text };
}

function normalizeWarehouseValue(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function normalizeWarehouseTypeForLive(value) {
  const warehouseType = normalizeWarehouseValue(value);

  switch (warehouseType) {
    case 'PRODUCTION_MATERIAL':
    case 'PRODUCTION_MATERIALS':
    case 'PRODUCTION_MATERIALS_STORE':
    case 'PRODUCTION_WAREHOUSE':
      return 'PRODUCTION';
    case 'RAW_MATERIALS_STORE':
      return 'RAW_MATERIALS';
    default:
      return warehouseType;
  }
}

function getExistingWarehouseTypes(warehouses) {
  const types = new Set();

  for (const warehouse of warehouses ?? []) {
    const warehouseType = normalizeWarehouseTypeForLive(
      warehouse?.warehouseType ?? warehouse?.warehouse_type ?? warehouse?.type,
    );
    if (warehouseType) {
      types.add(warehouseType);
    }
  }

  return [...types];
}

function resolveWarehouseTypeForLive(kind, existingTypes) {
  const normalizedTypes = new Set(
    (existingTypes ?? []).map((type) => normalizeWarehouseTypeForLive(type)).filter(Boolean),
  );
  const preferredTypes =
    kind === 'production'
      ? ['PRODUCTION', 'WIP', 'GENERAL']
      : ['RAW_MATERIALS', 'RAW_MATERIAL', 'GENERAL'];

  for (const preferredType of preferredTypes) {
    if (normalizedTypes.has(preferredType)) {
      return preferredType;
    }
  }

  return null;
}

function resolveWarehouseTypeCandidatesForLive(kind, existingTypes) {
  const preferredTypes =
    kind === 'production'
      ? ['PRODUCTION', 'WIP', 'GENERAL']
      : ['RAW_MATERIALS', 'RAW_MATERIAL', 'GENERAL'];
  const resolvedType = resolveWarehouseTypeForLive(kind, existingTypes);

  return [...new Set([resolvedType, ...preferredTypes].filter(Boolean))];
}

function matchesWarehouse(value, fragments) {
  const normalized = normalizeWarehouseValue(value);
  return fragments.some((fragment) => normalized.includes(fragment));
}

function readWarehouseType(warehouse) {
  return normalizeWarehouseTypeForLive(
    warehouse?.warehouseType ?? warehouse?.warehouse_type ?? warehouse?.type,
  );
}

function isProductionWarehouse(warehouse) {
  const warehouseType = readWarehouseType(warehouse);

  return (
    warehouseType === 'PRODUCTION' ||
    warehouseType === 'WIP' ||
    matchesWarehouse(warehouse?.code, ['PROD', 'PRODUCTION']) ||
    matchesWarehouse(warehouse?.name, ['PRODUCTION', 'WIP'])
  );
}

function isRawWarehouse(warehouse) {
  const warehouseType = readWarehouseType(warehouse);

  return (
    warehouseType === 'RAW_MATERIALS' ||
    warehouseType === 'RAW_MATERIAL' ||
    matchesWarehouse(warehouse?.code, ['RAW', 'STORE', 'STORES']) ||
    matchesWarehouse(warehouse?.name, ['RAW', 'STORE', 'STORES'])
  );
}

function summarizeWarehouse(warehouse) {
  return {
    code: String(warehouse?.code ?? ''),
    id: String(warehouse?.id ?? ''),
    name: String(warehouse?.name ?? ''),
    type:
      readWarehouseType(warehouse) ||
      String(warehouse?.warehouseType ?? warehouse?.warehouse_type ?? warehouse?.type ?? ''),
  };
}

function createSetupContext() {
  return {
    destinationCandidates: [],
    itemId: null,
    itemCode: null,
    sourceCandidates: [],
    sourceStockFound: false,
    totalWarehouses: 0,
    warehouseCreateAttempts: [],
    warehouses: [],
    selectedDestinationWarehouseId: null,
    selectedSourceWarehouseId: null,
  };
}

function buildSetupFailure(stage, message, details = {}, setupContext = null) {
  const error = new Error(message);
  error.code = PRODUCTION_SMOKE_SETUP_FAILED;
  error.stage = stage;
  error.details = details;
  error.setupContext = setupContext;
  return error;
}

function buildPermissionFailure(route, responseText, status) {
  const error = new Error('Login succeeded, but this account cannot perform production receiving or setup.');
  error.permissionFailure = {
    responseBody: responseText,
    route,
    status,
  };
  return error;
}

function logStructuredValue(label, value) {
  const normalizedValue =
    value == null
      ? value
      : typeof value === 'string'
        ? value
        : JSON.stringify(value, null, 2);
  console.error(`${label}: ${normalizedValue}`);
}

function logSetupDiagnostics(setupContext, details = {}) {
  logStructuredValue('totalWarehouses', setupContext?.totalWarehouses ?? 0);
  logStructuredValue('warehouses', setupContext?.warehouses ?? []);
  logStructuredValue('destinationCandidates', setupContext?.destinationCandidates ?? []);
  logStructuredValue('sourceCandidates', setupContext?.sourceCandidates ?? []);
  logStructuredValue('sourceStockFound', Boolean(setupContext?.sourceStockFound));
  logStructuredValue('selectedItemId', setupContext?.itemId ?? null);
  logStructuredValue('selectedItemCode', setupContext?.itemCode ?? null);
  logStructuredValue('selectedSourceWarehouseId', setupContext?.selectedSourceWarehouseId ?? null);
  logStructuredValue('selectedDestinationWarehouseId', setupContext?.selectedDestinationWarehouseId ?? null);
  if ((setupContext?.warehouseCreateAttempts ?? []).length > 0) {
    logStructuredValue('warehouseCreateAttempts', setupContext.warehouseCreateAttempts);
  }
  if (Object.keys(details ?? {}).length > 0) {
    logStructuredValue('details', details);
  }
}

function describeWarehouseTypes(existingTypes) {
  return existingTypes.length > 0 ? existingTypes.join(', ') : '(none)';
}

function formatSmokeTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function mapSmokeItem(item) {
  return {
    code: String(item?.code ?? ''),
    id: String(item?.id ?? ''),
    name: String(item?.name ?? item?.code ?? 'Production Smoke Raw Material'),
    unitCost: toNumber(item?.unitCost ?? item?.unit_cost, 0),
  };
}

async function ensureAllowedAppResponse(response, failurePath) {
  if (response.status === 401 || response.status === 403) {
    throw buildPermissionFailure(failurePath ?? response.route, response.text, response.status);
  }
}

async function loadPickerWarehouses(cookie, setupContext) {
  const response = await appRequest('/api/inventory/warehouses?picker=true', { cookie });
  await ensureAllowedAppResponse(response, '/api/inventory/warehouses?picker=true');

  if (!isOkStatus(response.status)) {
    throw buildSetupFailure(
      'WAREHOUSE_OR_SOURCE_STOCK_MISSING',
      response.text || `Warehouse picker failed with status ${response.status}.`,
      {
        responseBody: response.text,
        route: response.route,
        status: response.status,
      },
      setupContext,
    );
  }

  const warehouses = Array.isArray(response.json?.data)
    ? response.json.data
    : Array.isArray(response.json)
      ? response.json
      : [];

  setupContext.totalWarehouses = warehouses.length;
  setupContext.warehouses = warehouses.map((warehouse) => summarizeWarehouse(warehouse));

  return warehouses;
}

async function loadInventoryMeta(cookie) {
  const response = await appRequest('/api/inventory/meta', { cookie });
  await ensureAllowedAppResponse(response, '/api/inventory/meta');

  if (!isOkStatus(response.status)) {
    throw new Error(response.text || `Inventory meta failed with status ${response.status}.`);
  }

  return response.json ?? {};
}

async function searchInventoryItems(cookie, search) {
  const response = await appRequest(`/api/inventory/items?search=${encodeURIComponent(search)}&pageSize=100`, {
    cookie,
  });
  await ensureAllowedAppResponse(response, '/api/inventory/items');

  if (!isOkStatus(response.status)) {
    throw new Error(response.text || `Inventory items search failed with status ${response.status}.`);
  }

  return Array.isArray(response.json?.data) ? response.json.data : [];
}

function selectSmokeUnit(units) {
  return (
    units.find((unit) => ['KG', 'KGS', 'EA', 'PCS'].includes(String(unit?.abbreviation ?? '').toUpperCase())) ??
    units[0] ??
    null
  );
}

async function createSmokeWarehouse({ cookie, existingTypes, kind, setupContext }) {
  const warehouseTypeCandidates = resolveWarehouseTypeCandidatesForLive(kind, existingTypes);

  if (warehouseTypeCandidates.length === 0) {
    throw buildSetupFailure(
      'WAREHOUSE_OR_SOURCE_STOCK_MISSING',
      `Could not resolve live-compatible warehouse type. Existing types: ${describeWarehouseTypes(existingTypes)}`,
      { existingTypes, kind },
      setupContext,
    );
  }

  const suffix = String(Date.now()).slice(-6);
  const code = kind === 'production' ? `SMOKE_PROD_${suffix}` : `SMOKE_RAW_${suffix}`;
  const name =
    kind === 'production'
      ? `Smoke Production Warehouse ${suffix}`
      : `Smoke Raw Materials Warehouse ${suffix}`;

  for (const warehouseType of warehouseTypeCandidates) {
    const response = await appRequest('/api/inventory/warehouses', {
      method: 'POST',
      body: {
        code,
        name,
        type: warehouseType,
      },
      cookie,
    });
    await ensureAllowedAppResponse(response, '/api/inventory/warehouses');

    if (isOkStatus(response.status)) {
      return {
        code: String(response.json?.code ?? code),
        id: String(response.json?.id ?? ''),
        name: String(response.json?.name ?? name),
        type: String(response.json?.type ?? warehouseType),
        warehouse_type: String(
          response.json?.warehouse_type ?? response.json?.warehouseType ?? response.json?.type ?? warehouseType,
        ),
        warehouseType: String(
          response.json?.warehouseType ?? response.json?.warehouse_type ?? response.json?.type ?? warehouseType,
        ),
      };
    }

    if (response.json?.code === 'WAREHOUSE_TYPE_INVALID') {
      setupContext.warehouseCreateAttempts.push({
        attemptedType: warehouseType,
        kind,
        normalizedType: response.json?.normalizedType ?? null,
        status: response.status,
      });
      console.error(
        `Warehouse type retry for ${kind}: attemptedType=${warehouseType} normalizedType=${String(response.json?.normalizedType ?? '')}`,
      );
      continue;
    }

    throw buildSetupFailure(
      'WAREHOUSE_OR_SOURCE_STOCK_MISSING',
      response.text || `Smoke warehouse create failed with status ${response.status}.`,
      {
        responseBody: response.text,
        route: response.route,
        status: response.status,
      },
      setupContext,
    );
  }

  throw buildSetupFailure(
    'WAREHOUSE_OR_SOURCE_STOCK_MISSING',
    `Could not resolve live-compatible warehouse type. Existing types: ${describeWarehouseTypes(existingTypes)}`,
    {
      attempts: setupContext.warehouseCreateAttempts.filter((attempt) => attempt.kind === kind),
      existingTypes,
      kind,
    },
    setupContext,
  );
}

async function findOrCreateSmokeRawMaterialItem(cookie, setupContext) {
  const smokeCode = `PROD-SMOKE-RM-${formatSmokeTimestamp()}`;
  const existingItems = await searchInventoryItems(cookie, smokeCode);
  const exactMatch = existingItems.find(
    (item) => normalizeWarehouseValue(item?.code) === normalizeWarehouseValue(smokeCode),
  );

  if (exactMatch) {
    const mappedItem = mapSmokeItem(exactMatch);
    setupContext.itemId = mappedItem.id;
    setupContext.itemCode = mappedItem.code;
    return mappedItem;
  }

  const meta = await loadInventoryMeta(cookie);
  const units = Array.isArray(meta?.unitsOfMeasure) ? meta.unitsOfMeasure : [];
  const unit = selectSmokeUnit(units);

  if (!unit?.id) {
    throw buildSetupFailure(
      'SOURCE_STOCK_SEED_UNAVAILABLE',
      'No unit of measure is available to create the production smoke raw material item.',
      {
        route: '/api/inventory/meta',
        unitsOfMeasureCount: units.length,
      },
      setupContext,
    );
  }

  const response = await appRequest('/api/inventory/items', {
    method: 'POST',
    body: {
      code: smokeCode,
      itemType: 'RAW_MATERIAL',
      name: `Production Smoke Raw Material ${smokeCode}`,
      reorderLevel: 0,
      reorderQuantity: 0,
      trackExpiry: false,
      unitCost: 1,
      unitOfMeasureId: String(unit.id),
    },
    cookie,
  });
  await ensureAllowedAppResponse(response, '/api/inventory/items');

  if (!isOkStatus(response.status)) {
    throw buildSetupFailure(
      'SOURCE_STOCK_SEED_UNAVAILABLE',
      response.text || `Smoke raw material item create failed with status ${response.status}.`,
      {
        responseBody: response.text,
        route: response.route,
        status: response.status,
      },
      setupContext,
    );
  }

  const mappedItem = mapSmokeItem(response.json);
  setupContext.itemId = mappedItem.id;
  setupContext.itemCode = mappedItem.code;
  return mappedItem;
}

async function ensureSourceStock({ cookie, item, sourceWarehouse, setupContext }) {
  const currentBalance = await getBalance(item.id, sourceWarehouse.id);
  const currentAvailable = toNumber(
    currentBalance?.quantity_available ?? currentBalance?.quantity_on_hand,
    0,
  );

  if (currentAvailable >= TRANSFER_QUANTITY) {
    setupContext.sourceStockFound = true;
    return currentBalance;
  }

  const requiredSeedQuantity = Math.max(TRANSFER_QUANTITY - currentAvailable, TRANSFER_QUANTITY);
  const seedUnitCost = toNumber(item.unitCost, 0);
  const seedTotalValue = requiredSeedQuantity * seedUnitCost;
  const response = await appRequest('/api/inventory/adjustments', {
    method: 'POST',
    body: {
      itemId: item.id,
      quantity: requiredSeedQuantity,
      reason: `Production smoke seed ${new Date().toISOString()}`,
      totalValue: seedTotalValue,
      transactionAt: new Date().toISOString(),
      type: 'ADJUSTMENT_IN',
      unitCost: seedUnitCost,
      warehouseId: sourceWarehouse.id,
    },
    cookie,
  });
  await ensureAllowedAppResponse(response, '/api/inventory/adjustments');

  if (!isOkStatus(response.status)) {
    throw buildSetupFailure(
      'SOURCE_STOCK_SEED_UNAVAILABLE',
      response.text || `Source stock seed failed with status ${response.status}.`,
      {
        itemCode: item.code,
        itemId: item.id,
        responseBody: response.text,
        route: response.route,
        sourceWarehouseId: sourceWarehouse.id,
        status: response.status,
      },
      setupContext,
    );
  }

  const seededBalance = await getBalance(item.id, sourceWarehouse.id);
  const seededAvailable = toNumber(
    seededBalance?.quantity_available ?? seededBalance?.quantity_on_hand,
    0,
  );

  if (seededAvailable < TRANSFER_QUANTITY) {
    throw buildSetupFailure(
      'SOURCE_STOCK_SEED_UNAVAILABLE',
      'Source stock seed did not produce enough available stock for production receive.',
      {
        itemCode: item.code,
        itemId: item.id,
        seededAvailable,
        sourceWarehouseId: sourceWarehouse.id,
      },
      setupContext,
    );
  }

  setupContext.sourceStockFound = true;
  pass('Source stock seeded');
  return seededBalance;
}

async function prepareReceiveScenario(cookie) {
  const setupContext = createSetupContext();
  const warehouses = await loadPickerWarehouses(cookie, setupContext);
  const existingTypes = getExistingWarehouseTypes(warehouses);

  setupContext.sourceCandidates = warehouses
    .filter((warehouse) => isRawWarehouse(warehouse))
    .map((warehouse) => summarizeWarehouse(warehouse));
  setupContext.destinationCandidates = warehouses
    .filter((warehouse) => isProductionWarehouse(warehouse))
    .map((warehouse) => summarizeWarehouse(warehouse));

  let sourceWarehouse = warehouses.find((warehouse) => isRawWarehouse(warehouse)) ?? null;
  if (!sourceWarehouse) {
    sourceWarehouse = await createSmokeWarehouse({
      cookie,
      existingTypes,
      kind: 'raw',
      setupContext,
    });
    setupContext.sourceCandidates.push(summarizeWarehouse(sourceWarehouse));
  }

  let destinationWarehouse =
    warehouses.find(
      (warehouse) =>
        String(warehouse.id ?? '') !== String(sourceWarehouse.id ?? '') && isProductionWarehouse(warehouse),
    ) ?? null;
  if (!destinationWarehouse) {
    destinationWarehouse = await createSmokeWarehouse({
      cookie,
      existingTypes,
      kind: 'production',
      setupContext,
    });
    setupContext.destinationCandidates.push(summarizeWarehouse(destinationWarehouse));
  }

  setupContext.selectedSourceWarehouseId = String(sourceWarehouse.id ?? '');
  setupContext.selectedDestinationWarehouseId = String(destinationWarehouse.id ?? '');

  const item = await findOrCreateSmokeRawMaterialItem(cookie, setupContext);
  await ensureSourceStock({
    cookie,
    item,
    setupContext,
    sourceWarehouse,
  });

  return {
    destinationWarehouse,
    item,
    setupContext,
    sourceWarehouse,
  };
}

async function getBalance(itemId, warehouseId) {
  const rows = await rest('stock_balances', {
    query: [
      'select=item_id,warehouse_id,quantity_available,quantity_on_hand,total_value,average_cost,avg_cost',
      `item_id=eq.${itemId}`,
      `warehouse_id=eq.${warehouseId}`,
      'limit=1',
    ].join('&'),
  });
  return rows?.[0] ?? null;
}

async function getMovements(transferId, itemId) {
  return await rest('stock_movements', {
    query: [
      'select=id,item_id,warehouse_id,movement_type,quantity,unit_cost,total_value,reference_id,source_document_id,source_warehouse_id,destination_warehouse_id',
      `item_id=eq.${itemId}`,
      `reference_id=eq.${transferId}`,
      'order=created_at.desc',
      'limit=10',
    ].join('&'),
  });
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

async function main() {
  const cookie = await login();
  const scenario = await prepareReceiveScenario(cookie);

  const beforeSource = await getBalance(scenario.item.id, scenario.sourceWarehouse.id);
  const beforeDestination = await getBalance(scenario.item.id, scenario.destinationWarehouse.id);

  const receiveResponse = await appRequest('/api/production/raw-material-transfers', {
    method: 'POST',
    body: {
      destinationWarehouseId: scenario.destinationWarehouse.id,
      items: [
        {
          itemId: scenario.item.id,
          quantity: TRANSFER_QUANTITY,
          unitCost: toNumber(scenario.item.unitCost, 0),
        },
      ],
      notes: `Smoke production receive ${new Date().toISOString()}`,
      sourceWarehouseId: scenario.sourceWarehouse.id,
      transferDate: new Date().toISOString().slice(0, 10),
    },
    cookie,
  });

  if (!isOkStatus(receiveResponse.status)) {
    await ensureAllowedAppResponse(receiveResponse, '/api/production/raw-material-transfers');
    throw new Error(receiveResponse.text || `Production receive failed with status ${receiveResponse.status}.`);
  }

  const transferId = String(receiveResponse.json?.id ?? '');
  if (!transferId) {
    throw new Error('Production receive response did not include a transfer id.');
  }

  const afterSource = await getBalance(scenario.item.id, scenario.sourceWarehouse.id);
  const afterDestination = await getBalance(scenario.item.id, scenario.destinationWarehouse.id);
  const sourceDelta =
    toNumber(afterSource?.quantity_on_hand, 0) - toNumber(beforeSource?.quantity_on_hand, 0);
  const destinationDelta =
    toNumber(afterDestination?.quantity_on_hand, 0) - toNumber(beforeDestination?.quantity_on_hand, 0);
  const movements = await getMovements(transferId, scenario.item.id);

  if (destinationDelta < TRANSFER_QUANTITY) {
    throw new Error(`Expected production warehouse stock to increase by at least ${TRANSFER_QUANTITY}. Actual delta ${destinationDelta}.`);
  }
  if (sourceDelta > -TRANSFER_QUANTITY) {
    throw new Error(`Expected source warehouse stock to decrease by at least ${TRANSFER_QUANTITY}. Actual delta ${sourceDelta}.`);
  }
  if (!Array.isArray(movements) || movements.length === 0) {
    throw new Error('No production stock movement was found for the receive transfer.');
  }

  pass('Production Receive');
  pass(`Source Warehouse Stock ${sourceDelta}`);
  pass(`Production Warehouse Stock +${destinationDelta}`);
  pass('Production Stock Movement exists');
}

main().catch((error) => {
  if (error?.permissionFailure) {
    console.error('Login succeeded, but this account cannot perform production receiving or setup.');
    logStructuredValue('route', error.permissionFailure.route);
    logStructuredValue('status', error.permissionFailure.status);
    logStructuredValue('responseBody', error.permissionFailure.responseBody);
    process.exitCode = 1;
    return;
  }

  if (error?.code === PRODUCTION_SMOKE_SETUP_FAILED) {
    console.error(PRODUCTION_SMOKE_SETUP_FAILED);
    console.error(`stage: ${String(error.stage ?? 'WAREHOUSE_OR_SOURCE_STOCK_MISSING')}`);
    console.error(`message: ${String(error.message ?? 'Production smoke setup failed.')}`);
    logSetupDiagnostics(error.setupContext, error.details);
    process.exitCode = 1;
    return;
  }

  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
