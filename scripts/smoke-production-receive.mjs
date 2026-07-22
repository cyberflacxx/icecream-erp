import fs from 'fs';

const rawEnv = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');

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

  return { json, status: response.status, text };
}

async function findReceiveScenario() {
  const productionWarehouses = await rest('warehouses', {
    query: 'select=id,name,code,organization_id&or=(type.eq.PRODUCTION_MATERIALS,code.eq.PROD_MATERIALS)&limit=5',
  });

  for (const destinationWarehouse of productionWarehouses ?? []) {
    const balances = await rest('stock_balances', {
      query: [
        'select=item_id,warehouse_id,quantity_available,quantity_on_hand,organization_id',
        `organization_id=eq.${destinationWarehouse.organization_id}`,
        'quantity_available=gt.0',
        'limit=100',
      ].join('&'),
    });

    const sourceCandidates = (balances ?? []).filter((row) => String(row.warehouse_id) !== String(destinationWarehouse.id));
    for (const balance of sourceCandidates) {
      const [item] = await rest('items', {
        query: [
          'select=id,code,name,item_type,unit_cost,purchase_price',
          `id=eq.${balance.item_id}`,
          'limit=1',
        ].join('&'),
      });

      if (!item || !['RAW_MATERIAL', 'PACKAGING_MATERIAL'].includes(String(item.item_type ?? ''))) {
        continue;
      }

      const [sourceWarehouse] = await rest('warehouses', {
        query: [
          'select=id,name,code',
          `id=eq.${balance.warehouse_id}`,
          'limit=1',
        ].join('&'),
      });

      const available = Number(balance.quantity_available ?? balance.quantity_on_hand ?? 0);
      if (!sourceWarehouse || available < TRANSFER_QUANTITY) {
        continue;
      }

      return {
        destinationWarehouse,
        item,
        sourceWarehouse,
      };
    }
  }

  throw new Error('Unable to find a stocked raw material source and production destination warehouse.');
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
  const scenario = await findReceiveScenario();

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
          unitCost: Number(scenario.item.purchase_price ?? scenario.item.unit_cost ?? 0),
        },
      ],
      notes: `Smoke production receive ${new Date().toISOString()}`,
      sourceWarehouseId: scenario.sourceWarehouse.id,
      transferDate: new Date().toISOString().slice(0, 10),
    },
    cookie,
  });

  if (receiveResponse.status !== 200 && receiveResponse.status !== 201) {
    if (receiveResponse.status === 401 || receiveResponse.status === 403) {
      throw new Error('Login succeeded, but this account cannot perform production receiving.');
    }
    throw new Error(receiveResponse.text || `Production receive failed with status ${receiveResponse.status}.`);
  }

  const transferId = String(receiveResponse.json?.id ?? '');
  if (!transferId) {
    throw new Error('Production receive response did not include a transfer id.');
  }

  const afterSource = await getBalance(scenario.item.id, scenario.sourceWarehouse.id);
  const afterDestination = await getBalance(scenario.item.id, scenario.destinationWarehouse.id);
  const sourceDelta = Number(afterSource?.quantity_on_hand ?? 0) - Number(beforeSource?.quantity_on_hand ?? 0);
  const destinationDelta = Number(afterDestination?.quantity_on_hand ?? 0) - Number(beforeDestination?.quantity_on_hand ?? 0);
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
  pass(`Production Warehouse Stock +${destinationDelta}`);
  pass(`Source Warehouse Stock ${sourceDelta}`);
  pass('Production Stock Movement exists');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
