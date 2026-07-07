import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env');
const VERIFICATION_RESULTS_DIR = path.join(ROOT, 'verification-results');
const SCHEMA = 'icecream_erp';
const STRICT_MARKERS = ['E2E', 'VERIFY', 'TEST', 'compat-'];
const SOFT_MARKERS = ['DEMO'];

const PARENT_TABLES = [
  { table: 'suppliers', columns: ['code', 'name', 'email', 'contact_person', 'address'], includeDemo: false },
  { table: 'customers', columns: ['code', 'name', 'email', 'contact_person', 'address'], includeDemo: false },
  { table: 'items', columns: ['code', 'name', 'description'], includeDemo: false },
  { table: 'purchase_requisitions', columns: ['requisition_number', 'department', 'remarks', 'status'], includeDemo: true },
  { table: 'purchase_orders', columns: ['po_number', 'notes', 'status'], includeDemo: true },
  { table: 'goods_received_notes', columns: ['grn_number', 'notes', 'quality_notes', 'status'], includeDemo: true },
  { table: 'stock_transfers', columns: ['transfer_number', 'reference_number', 'notes', 'reason', 'status'], includeDemo: true },
  { table: 'recipes', columns: ['code', 'name', 'notes'], includeDemo: true },
  { table: 'production_plans', columns: ['plan_number', 'notes', 'status'], includeDemo: true },
  { table: 'production_batches', columns: ['batch_number', 'notes', 'status'], includeDemo: true },
  { table: 'quotations', columns: ['quotation_number', 'notes', 'status'], includeDemo: true },
  { table: 'sales_orders', columns: ['order_number', 'notes', 'status'], includeDemo: true },
  { table: 'invoices', columns: ['invoice_number', 'notes', 'status'], includeDemo: true },
  { table: 'sales_dispatch_notes', columns: ['dispatch_note_number', 'vehicle_reference', 'status'], includeDemo: true },
  { table: 'payments', columns: ['payment_number', 'reference_number', 'notes', 'remarks', 'status'], includeDemo: true },
];

const VERIFIER_RECORD_TABLES = {
  supplier: 'suppliers',
  customer: 'customers',
  rawItem: 'items',
  finishedItem: 'items',
  requisition: 'purchase_requisitions',
  purchaseOrder: 'purchase_orders',
  grn: 'goods_received_notes',
  transfer: 'stock_transfers',
  recipe: 'recipes',
  plan: 'production_plans',
  batch: 'production_batches',
  quotation: 'quotations',
  salesOrder: 'sales_orders',
  invoice: 'invoices',
  dispatch: 'sales_dispatch_notes',
  payment: 'payments',
};

function parseEnv(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^"|"$/g, '');
  }
  return values;
}

function createSummary() {
  return {
    matched: {},
    deleted: {},
    skipped: {},
  };
}

function addCount(target, key, amount) {
  if (!amount) return;
  target[key] = (target[key] ?? 0) + amount;
}

function isMissingTableError(error) {
  const message = String(error?.message ?? error ?? '');
  return (
    message.includes('Could not find the table') ||
    message.includes('relation') && message.includes('does not exist') ||
    message.includes('PGRST205')
  );
}

function getMissingColumnName(error) {
  const message = String(error?.message ?? error ?? '');
  const directMatch = message.match(/column\s+([a-zA-Z0-9_."]+)\s+does not exist/i);
  if (directMatch?.[1]) {
    return directMatch[1].replace(/^.*\./, '').replace(/"/g, '');
  }
  const postgrestMatch = message.match(/Could not find the '([^']+)' column/i);
  if (postgrestMatch?.[1]) {
    return postgrestMatch[1].replace(/^.*\./, '').replace(/"/g, '');
  }
  return null;
}

function hasMarker(value, includeDemo) {
  const text = String(value ?? '');
  const markers = includeDemo ? STRICT_MARKERS.concat(SOFT_MARKERS) : STRICT_MARKERS;
  return markers.some((marker) => text.toLowerCase().includes(marker.toLowerCase()));
}

function chunk(values, size = 100) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function tableExists(supabase, table) {
  const { error } = await supabase.from(table).select('id').limit(1);
  if (!error) return true;
  if (isMissingTableError(error)) return false;
  throw error;
}

async function selectRows(supabase, table, columns) {
  let selectedColumns = Array.from(new Set(columns.filter(Boolean)));

  while (true) {
    const selectClause = Array.from(new Set(['id', ...selectedColumns])).join(',');
    const { data, error } = await supabase.from(table).select(selectClause).limit(5000);
    if (!error) return data ?? [];
    if (isMissingTableError(error)) return null;

    const missingColumn = getMissingColumnName(error);
    if (!missingColumn || !selectedColumns.includes(missingColumn)) {
      throw error;
    }

    selectedColumns = selectedColumns.filter((column) => column !== missingColumn);
    if (selectedColumns.length === 0) {
      return [];
    }
  }
}

async function deleteWhereIn(supabase, table, column, values, summary) {
  if (!values.length) return;
  if (!(await tableExists(supabase, table))) {
    addCount(summary.skipped, table, values.length);
    return;
  }

  for (const batch of chunk(values)) {
      const { data, error } = await supabase.from(table).delete().in(column, batch).select('id');
      if (error) {
        if (isMissingTableError(error) || getMissingColumnName(error) === column) {
          addCount(summary.skipped, table, batch.length);
          continue;
        }
      throw error;
    }
    addCount(summary.deleted, table, data?.length ?? 0);
  }
}

async function readVerifierCreatedRecords() {
  const recordIds = {};
  let files = [];

  try {
    files = await fs.readdir(VERIFICATION_RESULTS_DIR);
  } catch {
    return recordIds;
  }

  for (const fileName of files.filter((name) => name.endsWith('.json'))) {
    const filePath = path.join(VERIFICATION_RESULTS_DIR, fileName);
    try {
      const payload = JSON.parse(await fs.readFile(filePath, 'utf8'));
      const createdRecords = payload?.createdRecords ?? {};
      for (const [recordKey, table] of Object.entries(VERIFIER_RECORD_TABLES)) {
        const record = createdRecords[recordKey];
        const id = record && typeof record === 'object' ? record.id : null;
        if (!id) continue;
        if (!recordIds[table]) recordIds[table] = new Set();
        recordIds[table].add(String(id));
      }
    } catch {
      // Ignore malformed verifier artifacts and continue with the rest.
    }
  }

  return recordIds;
}

async function collectMarkedParentIds(supabase, summary) {
  const parentIds = {};

  for (const config of PARENT_TABLES) {
    const rows = await selectRows(supabase, config.table, config.columns);
    if (rows === null) {
      addCount(summary.skipped, config.table, 1);
      continue;
    }

    const ids = rows
      .filter((row) => config.columns.some((column) => hasMarker(row[column], config.includeDemo)))
      .map((row) => String(row.id));

    if (ids.length > 0) {
      parentIds[config.table] = new Set(ids);
      addCount(summary.matched, config.table, ids.length);
    }
  }

  return parentIds;
}

async function collectRelatedIds(supabase, parentIds, summary) {
  const related = {
    ...parentIds,
    production_material_requests: new Set(),
  };

  const batchIds = Array.from(related.production_batches ?? []);
  if (batchIds.length && (await tableExists(supabase, 'production_material_requests'))) {
    const { data, error } = await supabase
      .from('production_material_requests')
      .select('id')
      .in('production_batch_id', batchIds);
    if (error && !isMissingTableError(error)) throw error;
    for (const row of data ?? []) related.production_material_requests.add(String(row.id));
    addCount(summary.matched, 'production_material_requests', data?.length ?? 0);
  }

  return related;
}

function toArraySet(recordIds) {
  return Object.fromEntries(
    Object.entries(recordIds).map(([table, ids]) => [table, Array.from(ids)]),
  );
}

async function main() {
  const env = parseEnv(await fs.readFile(ENV_PATH, 'utf8'));
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SCHEMA },
  });

  const summary = createSummary();
  const verifierIds = await readVerifierCreatedRecords();
  const markerIds = await collectMarkedParentIds(supabase, summary);

  for (const [table, ids] of Object.entries(verifierIds)) {
    if (!markerIds[table]) markerIds[table] = new Set();
    for (const id of ids) markerIds[table].add(id);
    addCount(summary.matched, table, ids.size);
  }

  const relatedIds = await collectRelatedIds(supabase, markerIds, summary);
  const ids = toArraySet(relatedIds);

  const supplierIds = ids.suppliers ?? [];
  const customerIds = ids.customers ?? [];
  const itemIds = ids.items ?? [];
  const requisitionIds = ids.purchase_requisitions ?? [];
  const purchaseOrderIds = ids.purchase_orders ?? [];
  const grnIds = ids.goods_received_notes ?? [];
  const transferIds = ids.stock_transfers ?? [];
  const recipeIds = ids.recipes ?? [];
  const planIds = ids.production_plans ?? [];
  const batchIds = ids.production_batches ?? [];
  const materialRequestIds = ids.production_material_requests ?? [];
  const quotationIds = ids.quotations ?? [];
  const salesOrderIds = ids.sales_orders ?? [];
  const invoiceIds = ids.invoices ?? [];
  const dispatchIds = ids.sales_dispatch_notes ?? [];
  const paymentIds = ids.payments ?? [];

  await deleteWhereIn(supabase, 'production_material_request_items', 'production_material_request_id', materialRequestIds, summary);
  await deleteWhereIn(supabase, 'production_material_requests', 'id', materialRequestIds, summary);
  await deleteWhereIn(supabase, 'production_batch_outputs', 'batch_id', batchIds, summary);
  await deleteWhereIn(supabase, 'production_plan_items', 'production_plan_id', planIds, summary);
  await deleteWhereIn(supabase, 'recipe_packaging_items', 'recipe_id', recipeIds, summary);
  await deleteWhereIn(supabase, 'recipe_items', 'recipe_id', recipeIds, summary);
  await deleteWhereIn(supabase, 'sales_dispatch_note_items', 'dispatch_note_id', dispatchIds, summary);
  await deleteWhereIn(supabase, 'invoice_items', 'invoice_id', invoiceIds, summary);
  await deleteWhereIn(supabase, 'sales_order_items', 'order_id', salesOrderIds, summary);
  await deleteWhereIn(supabase, 'quotation_items', 'quotation_id', quotationIds, summary);
  await deleteWhereIn(supabase, 'stock_transfer_items', 'transfer_id', transferIds, summary);
  await deleteWhereIn(supabase, 'grn_items', 'grn_id', grnIds, summary);
  await deleteWhereIn(supabase, 'purchase_order_items', 'purchase_order_id', purchaseOrderIds, summary);
  await deleteWhereIn(supabase, 'purchase_order_items', 'po_id', purchaseOrderIds, summary);
  await deleteWhereIn(supabase, 'purchase_requisition_items', 'requisition_id', requisitionIds, summary);
  await deleteWhereIn(supabase, 'inventory_batches', 'item_id', itemIds, summary);
  await deleteWhereIn(supabase, 'stock_movements', 'item_id', itemIds, summary);
  await deleteWhereIn(supabase, 'stock_balances', 'item_id', itemIds, summary);
  await deleteWhereIn(supabase, 'audit_logs', 'entity_id', [
    ...supplierIds,
    ...customerIds,
    ...itemIds,
    ...requisitionIds,
    ...purchaseOrderIds,
    ...grnIds,
    ...transferIds,
    ...recipeIds,
    ...planIds,
    ...batchIds,
    ...quotationIds,
    ...salesOrderIds,
    ...invoiceIds,
    ...dispatchIds,
    ...paymentIds,
  ], summary);

  await deleteWhereIn(supabase, 'payments', 'id', paymentIds, summary);
  await deleteWhereIn(supabase, 'sales_dispatch_notes', 'id', dispatchIds, summary);
  await deleteWhereIn(supabase, 'invoices', 'id', invoiceIds, summary);
  await deleteWhereIn(supabase, 'sales_orders', 'id', salesOrderIds, summary);
  await deleteWhereIn(supabase, 'quotations', 'id', quotationIds, summary);
  await deleteWhereIn(supabase, 'production_batches', 'id', batchIds, summary);
  await deleteWhereIn(supabase, 'production_plans', 'id', planIds, summary);
  await deleteWhereIn(supabase, 'recipes', 'id', recipeIds, summary);
  await deleteWhereIn(supabase, 'stock_transfers', 'id', transferIds, summary);
  await deleteWhereIn(supabase, 'goods_received_notes', 'id', grnIds, summary);
  await deleteWhereIn(supabase, 'purchase_orders', 'id', purchaseOrderIds, summary);
  await deleteWhereIn(supabase, 'purchase_requisitions', 'id', requisitionIds, summary);
  await deleteWhereIn(supabase, 'items', 'id', itemIds, summary);
  await deleteWhereIn(supabase, 'customers', 'id', customerIds, summary);
  await deleteWhereIn(supabase, 'suppliers', 'id', supplierIds, summary);

  console.log(
    JSON.stringify(
      {
        schema: SCHEMA,
        matched: summary.matched,
        deleted: summary.deleted,
        skipped: summary.skipped,
        protected: ['users', 'auth.users', 'organizations', 'branches', 'warehouses', 'units_of_measure', 'accounts', 'roles'],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
