import { getSmokeConfig, login, fetchWithTimeout } from './_frontend-smoke-shared.mjs';

const REQUIRED_ENV_VARS = ['ABSOLUTE_ERP_BASE_URL', 'SMOKE_WORK_ID', 'SMOKE_PASSWORD'];
const TEST_QUANTITY = 50;
const REQUIRED_ENV_COMMAND = 'ABSOLUTE_ERP_BASE_URL=https://www.absolute-erp.com SMOKE_WORK_ID=... SMOKE_PASSWORD=... npm run smoke:procurement:e2e';
const routeResults = [];

function fail(message, details) {
  const error = new Error(message);
  if (details !== undefined) {
    error.details = details;
  }
  throw error;
}

function logStep(label, status, details = '') {
  const suffix = details ? ` ${details}` : '';
  console.log(`[${status}] ${label}${suffix}`);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`Missing required environment variable: ${name}. Run: ${REQUIRED_ENV_COMMAND}`);
  }
  return value;
}

async function apiRequest(baseUrl, cookie, pathname, { method = 'GET', body, headers = {}, timeoutMs } = {}) {
  const response = await fetchWithTimeout(
    `${baseUrl}${pathname}`,
    {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    },
    timeoutMs,
  );

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  let json = null;

  if (contentType.includes('application/json')) {
    try {
      json = text ? JSON.parse(text) : null;
    } catch {}
  }

  routeResults.push({
    route: pathname,
    method,
    status: response.status,
    contentType,
    failure: response.ok ? null : String(json?.message ?? json?.error ?? text).slice(0, 240),
  });

  return {
    contentType,
    json,
    ok: response.ok,
    response,
    status: response.status,
    text,
  };
}

function assertOk(result, label) {
  if (!result.ok) {
    fail(`${label} failed with HTTP ${result.status}.`, result.json ?? result.text);
  }
}

function printRouteReport() {
  console.log('');
  console.log('ROUTE_REPORT');
  for (const result of routeResults) {
    const suffix = result.failure ? ` failure=${JSON.stringify(result.failure)}` : '';
    console.log(`${result.method} ${result.route} status=${result.status} content-type=${result.contentType || '-'}${suffix}`);
  }
}

function getCollection(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function getObject(payload) {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
}

function normalizeString(value) {
  return String(value ?? '').trim();
}

function makeCode(prefix) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${prefix}-${stamp}`;
}

async function fetchProcurementMeta(baseUrl, cookie, timeoutMs) {
  const result = await apiRequest(baseUrl, cookie, '/api/procurement/meta', { timeoutMs });
  assertOk(result, 'Fetch procurement meta');
  return result.json ?? {};
}

async function ensureUnit(meta) {
  const units = getCollection(meta.units);
  const unit = units.find((entry) => normalizeString(entry.id)) ?? null;
  if (!unit) {
    fail('No unit of measure is available for the procurement smoke test.');
  }
  return unit;
}

async function ensureItem(baseUrl, cookie, timeoutMs, unitId) {
  const code = makeCode('SMOKE-RM');
  const name = `Smoke Vanilla Mix ${code}`;
  const existingResult = await apiRequest(baseUrl, cookie, `/api/inventory/items?search=${encodeURIComponent(code)}&pageSize=20`, { timeoutMs });
  assertOk(existingResult, 'Search inventory items');
  const existingItems = getCollection(existingResult.json);
  const existing = existingItems.find((item) => normalizeString(item.code) === code || normalizeString(item.name) === name);
  if (existing) {
    return existing;
  }

  const createResult = await apiRequest(baseUrl, cookie, '/api/inventory/items', {
    body: {
      code,
      description: 'Launch smoke procurement raw material',
      itemType: 'RAW_MATERIAL',
      name,
      sellingPrice: 2,
      unitCost: 2,
      unitOfMeasureId: unitId,
    },
    method: 'POST',
    timeoutMs,
  });
  assertOk(createResult, 'Create inventory item');
  return createResult.json;
}

async function ensureSupplier(baseUrl, cookie, timeoutMs) {
  const code = makeCode('SMOKE-SUP');
  const existingResult = await apiRequest(baseUrl, cookie, `/api/suppliers?search=${encodeURIComponent(code)}&pageSize=20`, { timeoutMs });
  assertOk(existingResult, 'Search suppliers');
  const existing = getCollection(existingResult.json).find((item) => normalizeString(item.code) === code);
  if (existing) {
    return existing;
  }

  const createResult = await apiRequest(baseUrl, cookie, '/api/suppliers', {
    body: {
      code,
      name: `Smoke Supplier ${code}`,
      paymentTerms: 'Cash on delivery',
      status: 'ACTIVE',
    },
    method: 'POST',
    timeoutMs,
  });
  assertOk(createResult, 'Create supplier');
  return createResult.json;
}

async function ensureWarehouse(baseUrl, cookie, timeoutMs) {
  const code = makeCode('SMOKE-WH');
  const pickerResult = await apiRequest(baseUrl, cookie, '/api/inventory/warehouses?picker=true', { timeoutMs });
  assertOk(pickerResult, 'Fetch warehouse picker');
  const existing = getCollection(pickerResult.json).find((item) => normalizeString(item.code) === code);
  if (existing) {
    return existing;
  }

  const createResult = await apiRequest(baseUrl, cookie, '/api/inventory/warehouses', {
    body: {
      code,
      name: `Smoke Warehouse ${code}`,
      type: 'MAIN',
    },
    method: 'POST',
    timeoutMs,
  });
  assertOk(createResult, 'Create warehouse');
  return createResult.json;
}

async function fetchStockBalance(baseUrl, cookie, timeoutMs, itemId, warehouseId) {
  const result = await apiRequest(
    baseUrl,
    cookie,
    `/api/inventory/stock-balances?itemId=${encodeURIComponent(itemId)}&warehouseId=${encodeURIComponent(warehouseId)}&pageSize=100`,
    { timeoutMs },
  );
  assertOk(result, 'Fetch stock balances');
  const rows = getCollection(result.json);
  const row = rows.find((entry) => normalizeString(entry.item?.id) === itemId && normalizeString(entry.warehouse?.id) === warehouseId) ?? null;
  return {
    quantityAvailable: Number(row?.quantityAvailable ?? 0),
    quantityOnHand: Number(row?.quantityOnHand ?? 0),
    raw: row,
    stockValue: Number(row?.stockValue ?? 0),
  };
}

async function fetchStockMovements(baseUrl, cookie, timeoutMs, itemId) {
  const result = await apiRequest(
    baseUrl,
    cookie,
    `/api/inventory/stock-movements?itemId=${encodeURIComponent(itemId)}&pageSize=100`,
    { timeoutMs },
  );
  assertOk(result, 'Fetch stock movements');
  return getCollection(result.json);
}

async function submitRequisition(baseUrl, cookie, timeoutMs, requisitionId) {
  const result = await apiRequest(baseUrl, cookie, `/api/procurement/requisitions/${requisitionId}/submit`, {
    method: 'POST',
    timeoutMs,
  });
  assertOk(result, 'Submit requisition');
  return result.json;
}

async function approveRequisition(baseUrl, cookie, timeoutMs, requisitionId) {
  const result = await apiRequest(baseUrl, cookie, `/api/procurement/requisitions/${requisitionId}/approve`, {
    body: { remarks: 'Procurement smoke approval' },
    method: 'POST',
    timeoutMs,
  });
  assertOk(result, 'Approve requisition');
  return result.json;
}

async function receiveGrn(baseUrl, cookie, timeoutMs, grnId, itemId, poItemId, quantityReceived) {
  const result = await apiRequest(baseUrl, cookie, `/api/procurement/grns/${grnId}/receive`, {
    body: {
      items: [
        {
          itemId,
          poItemId,
          quantityReceived,
          quantityRejected: 0,
        },
      ],
      notes: 'Procurement smoke receive',
    },
    method: 'POST',
    timeoutMs,
  });
  assertOk(result, 'Receive GRN');
  return result.json;
}

async function approveGrn(baseUrl, cookie, timeoutMs, grnId) {
  const result = await apiRequest(baseUrl, cookie, `/api/procurement/grns/${grnId}/approve`, {
    body: { approvalNotes: 'Procurement smoke approve' },
    method: 'POST',
    timeoutMs,
  });
  assertOk(result, 'Approve GRN');
  return result.json;
}

async function postGrn(baseUrl, cookie, timeoutMs, grnId) {
  const result = await apiRequest(baseUrl, cookie, `/api/procurement/grns/${grnId}/post`, {
    method: 'POST',
    timeoutMs,
  });
  if (result.ok) {
    return result.json;
  }
  const message = normalizeString(result.json?.message ?? result.json?.error ?? result.text);
  if (result.status === 400 && message.toLowerCase().includes('already been posted')) {
    return result.json ?? { message };
  }
  fail(`Post GRN failed with HTTP ${result.status}.`, result.json ?? result.text);
}

async function main() {
  for (const name of REQUIRED_ENV_VARS) {
    requireEnv(name);
  }

  const smokeConfig = await getSmokeConfig();
  const baseUrl = requireEnv('ABSOLUTE_ERP_BASE_URL');
  const workId = requireEnv('SMOKE_WORK_ID');
  const password = requireEnv('SMOKE_PASSWORD');
  const timeoutMs = smokeConfig.timeoutMs;

  const cookie = await login(baseUrl, workId, password, timeoutMs);
  logStep('Login', 'PASS', workId);

  const meta = await fetchProcurementMeta(baseUrl, cookie, timeoutMs);
  const unit = await ensureUnit(meta);
  logStep('UOM', 'PASS', `${normalizeString(unit.name ?? unit.label ?? unit.id)} (${unit.id})`);

  const item = await ensureItem(baseUrl, cookie, timeoutMs, unit.id);
  logStep('Item', 'PASS', `${item.code} @ ${Number(item.unitCost ?? item.unit_cost ?? 0).toFixed(2)}`);

  const supplier = await ensureSupplier(baseUrl, cookie, timeoutMs);
  logStep('Supplier', 'PASS', `${supplier.code ?? supplier.id}`);

  const warehouse = await ensureWarehouse(baseUrl, cookie, timeoutMs);
  logStep('Warehouse', 'PASS', `${warehouse.code ?? warehouse.id}`);

  const beforeBalance = await fetchStockBalance(baseUrl, cookie, timeoutMs, item.id, warehouse.id);
  logStep('Initial Stock', 'PASS', `qty=${beforeBalance.quantityOnHand} value=${beforeBalance.stockValue}`);

  const requisitionCreate = await apiRequest(baseUrl, cookie, '/api/procurement/requisitions', {
    body: {
      department: 'Production',
      items: [
        {
          estimatedUnitCost: Number(item.unitCost ?? item.unit_cost ?? 2),
          itemId: item.id,
          quantityRequested: TEST_QUANTITY,
          remarks: 'Launch smoke requisition',
          unitOfMeasureId: unit.id,
        },
      ],
      remarks: 'Procurement smoke requisition',
    },
    method: 'POST',
    timeoutMs,
  });
  assertOk(requisitionCreate, 'Create requisition');
  const requisition = getObject(requisitionCreate.json);
  const requisitionId = normalizeString(requisition?.id);
  if (!requisitionId) fail('Requisition response did not include id.', requisitionCreate.json);
  logStep('Requisition', 'PASS', requisition.requisition_number ?? requisition.requisitionNumber ?? requisitionId);

  await submitRequisition(baseUrl, cookie, timeoutMs, requisitionId);
  logStep('Requisition Submit', 'PASS', requisitionId);

  await approveRequisition(baseUrl, cookie, timeoutMs, requisitionId);
  logStep('Requisition Approve', 'PASS', requisitionId);

  const requisitionDetailResult = await apiRequest(baseUrl, cookie, `/api/procurement/requisitions/${requisitionId}`, { timeoutMs });
  assertOk(requisitionDetailResult, 'Fetch requisition detail');
  const requisitionDetail = getObject(requisitionDetailResult.json);
  const requisitionItems = getCollection(requisitionDetail?.items);
  const requisitionLine = requisitionItems[0];
  if (!requisitionLine) fail('Requisition detail did not return line items.', requisitionDetail);
  logStep('Requisition Detail', 'PASS', `${requisitionItems.length} line(s)`);

  const pickerResult = await apiRequest(baseUrl, cookie, '/api/procurement/requisitions?picker=true&forPurchaseOrder=true', { timeoutMs });
  assertOk(pickerResult, 'Fetch requisition picker');
  const pickedRequisition = getCollection(pickerResult.json).find((entry) => normalizeString(entry.id) === requisitionId);
  if (!pickedRequisition) fail('Approved requisition is missing from PO picker.', pickerResult.json);
  logStep('Requisition Picker', 'PASS', pickedRequisition.label ?? requisitionId);

  const unitPrice = Number(
    requisitionLine.unit_price ??
      requisitionLine.unitPrice ??
      item.purchase_price ??
      item.purchasePrice ??
      item.cost_price ??
      item.costPrice ??
      item.unit_cost ??
      item.unitCost ??
      0,
  );

  const createPoResult = await apiRequest(baseUrl, cookie, '/api/procurement/purchase-orders', {
    body: {
      items: [
        {
          description: requisitionLine.description ?? item.description ?? item.name,
          itemId: requisitionLine.itemId ?? requisitionLine.item_id ?? item.id,
          quantity: Number(requisitionLine.quantity ?? TEST_QUANTITY),
          requisitionItemId: requisitionLine.requisitionItemId ?? requisitionLine.requisition_item_id ?? null,
          unitOfMeasureId: requisitionLine.unitOfMeasureId ?? requisitionLine.unit_of_measure_id ?? unit.id,
          unitPrice,
        },
      ],
      requisitionId,
      supplierId: supplier.id,
    },
    method: 'POST',
    timeoutMs,
  });
  assertOk(createPoResult, 'Create purchase order');
  const po = getObject(createPoResult.json);
  const poId = normalizeString(po?.id ?? po?.purchase_order_id ?? po?.purchaseOrderId);
  const poNumber = normalizeString(po?.po_number ?? po?.poNumber);
  const poItems = getCollection(po?.items);
  const poLine = poItems[0];
  if (!poId || !poNumber || normalizeString(po?.requisition_id ?? po?.requisitionId) !== requisitionId || !poLine) {
    fail('Purchase order response is missing required launch fields.', po);
  }
  if (Number(poLine.quantity) !== TEST_QUANTITY) {
    fail(`Purchase order line quantity mismatch. Expected ${TEST_QUANTITY}.`, poLine);
  }
  if (!normalizeString(poLine.item_id ?? poLine.itemId) || !normalizeString(poLine.unit_of_measure_id ?? poLine.unitOfMeasureId)) {
    fail('Purchase order line is missing item_id or UOM.', poLine);
  }
  logStep('Purchase Order', 'PASS', `${poNumber} lines=${poItems.length}`);

  const poPdfResult = await apiRequest(baseUrl, cookie, `/api/procurement/purchase-orders/${poId}/pdf`, { timeoutMs });
  if (!poPdfResult.ok || !poPdfResult.contentType.includes('application/pdf')) {
    fail('Purchase order PDF download failed.', {
      contentType: poPdfResult.contentType,
      status: poPdfResult.status,
      text: poPdfResult.text,
    });
  }
  logStep('PO PDF', 'PASS', poPdfResult.contentType);

  const grnCreateResult = await apiRequest(baseUrl, cookie, '/api/procurement/grns', {
    body: {
      entryMode: 'po_linked',
      items: [
        {
          itemId: poLine.item_id ?? poLine.itemId,
          poItemId: poLine.id ?? poLine.po_item_id ?? poLine.purchase_order_item_id ?? null,
          quantityExpected: TEST_QUANTITY,
          quantityReceived: TEST_QUANTITY,
          quantityRejected: 0,
          unitCost: Number(poLine.unit_price ?? poLine.unitPrice ?? unitPrice),
          unitOfMeasureId: poLine.unit_of_measure_id ?? poLine.unitOfMeasureId ?? unit.id,
        },
      ],
      purchaseOrderId: poId,
      receivingWarehouseId: warehouse.id,
      supplierId: supplier.id,
    },
    method: 'POST',
    timeoutMs,
  });
  assertOk(grnCreateResult, 'Create GRN');
  const grn = getObject(grnCreateResult.json);
  const grnId = normalizeString(grn?.id);
  if (!grnId) fail('GRN create response did not include id.', grn);
  logStep('GRN', 'PASS', grn.grn_number ?? grn.grnNumber ?? grnId);

  const poDetailResult = await apiRequest(baseUrl, cookie, `/api/procurement/purchase-orders/${poId}`, { timeoutMs });
  assertOk(poDetailResult, 'Fetch purchase order detail');
  const poDetail = getObject(poDetailResult.json);
  const poDetailItems = getCollection(poDetail?.items);
  const poDetailLine = poDetailItems.find((entry) => normalizeString(entry.item_id ?? entry.itemId) === item.id) ?? poDetailItems[0];
  if (!poDetailLine) {
    fail('Purchase order detail did not return GRN-ready lines.', poDetail);
  }
  logStep('PO Detail', 'PASS', `${poDetailItems.length} line(s)`);

  await receiveGrn(
    baseUrl,
    cookie,
    timeoutMs,
    grnId,
    normalizeString(poDetailLine.item_id ?? poDetailLine.itemId ?? item.id),
    normalizeString(poDetailLine.id ?? poDetailLine.purchase_order_item_id ?? poDetailLine.po_item_id),
    TEST_QUANTITY,
  );
  logStep('GRN Receive', 'PASS', `qty=${TEST_QUANTITY}`);

  await approveGrn(baseUrl, cookie, timeoutMs, grnId);
  logStep('GRN Approve', 'PASS', grnId);

  await postGrn(baseUrl, cookie, timeoutMs, grnId);
  logStep('GRN Post', 'PASS', 'idempotent path verified');

  const afterBalance = await fetchStockBalance(baseUrl, cookie, timeoutMs, item.id, warehouse.id);
  const quantityDelta = afterBalance.quantityOnHand - beforeBalance.quantityOnHand;
  const valueDelta = afterBalance.stockValue - beforeBalance.stockValue;
  const expectedUnitCost = unitPrice;
  const expectedValueDelta = TEST_QUANTITY * expectedUnitCost;

  if (quantityDelta !== TEST_QUANTITY) {
    fail(`Stock quantity delta must equal ${TEST_QUANTITY}.`, {
      afterBalance,
      beforeBalance,
      quantityDelta,
    });
  }
  if (valueDelta < expectedValueDelta) {
    fail(`Inventory value did not increase by at least ${expectedValueDelta}.`, {
      afterBalance,
      beforeBalance,
      expectedValueDelta,
      valueDelta,
    });
  }
  logStep('Stock Balance', 'PASS', `deltaQty=${quantityDelta} deltaValue=${valueDelta.toFixed(2)}`);

  const movementRows = await fetchStockMovements(baseUrl, cookie, timeoutMs, item.id);
  const grnMovement = movementRows.find((entry) => {
    const sourceDocumentId = normalizeString(entry.source_document_id ?? entry.sourceDocumentId ?? entry.reference?.id);
    const sourceDocumentType = normalizeString(entry.source_document_type ?? entry.sourceDocumentType ?? entry.reference?.type).toUpperCase();
    return sourceDocumentId === grnId && sourceDocumentType === 'GRN';
  });
  if (!grnMovement) {
    fail('No stock movement was found with source_document_type = GRN and source_document_id = posted GRN id.', movementRows.slice(0, 10));
  }
  logStep('Stock Movement', 'PASS', `${grnMovement.type} qty=${grnMovement.quantity} source_document_type=${grnMovement.source_document_type ?? grnMovement.sourceDocumentType}`);

  printRouteReport();
  console.log('');
  console.log('PROCUREMENT_SMOKE_PASS');
  console.log(JSON.stringify({
    grnId,
    itemId: item.id,
    poId,
    poNumber,
    quantityDelta,
    routeResults,
    sourceDocumentId: grnMovement.source_document_id ?? grnMovement.sourceDocumentId ?? grnMovement.reference?.id ?? null,
    sourceDocumentType: grnMovement.source_document_type ?? grnMovement.sourceDocumentType ?? grnMovement.reference?.type ?? null,
    requisitionId,
    valueDelta,
    warehouseId: warehouse.id,
  }, null, 2));
}

main().catch((error) => {
  console.error('');
  console.error('PROCUREMENT_SMOKE_FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  if (error && typeof error === 'object' && 'details' in error) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  printRouteReport();
  process.exitCode = 1;
});
