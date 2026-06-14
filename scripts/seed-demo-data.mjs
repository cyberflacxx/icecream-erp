import fs from 'fs';

const rawEnv = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');

function getEnv(key) {
  const match = rawEnv.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].replace(/^"|"$/g, '').trim() : '';
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@2026!';
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

async function rest(table, {
  method = 'GET',
  query = 'select=*',
  body,
  prefer,
} = {}) {
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

  return {
    data,
    count: parseContentRange(response.headers.get('content-range')),
    headers: response.headers,
  };
}

function parseContentRange(value) {
  if (!value) return null;
  const total = value.split('/')[1];
  if (!total || total === '*') return 0;
  return Number(total);
}

async function tableExists(table) {
  try {
    await rest(table, { query: 'select=*&limit=1' });
    return true;
  } catch (error) {
    if (error.status === 404) return false;
    throw error;
  }
}

async function selectAll(table, select = '*', filters = []) {
  const query = [`select=${select}`, ...filters].join('&');
  return (await rest(table, { query })).data ?? [];
}

async function maybeSingle(table, select = '*', filters = []) {
  const rows = await selectAll(table, select, [...filters, 'limit=1']);
  return rows[0] ?? null;
}

async function insertRows(table, rows, onConflict) {
  const prefer = onConflict
    ? `return=representation,resolution=merge-duplicates`
    : 'return=representation';
  const query = onConflict ? `on_conflict=${encodeURIComponent(onConflict)}` : 'select=*';
  const body = Array.isArray(rows) ? rows : [rows];
  const { data } = await rest(table, { method: 'POST', query, body, prefer });
  return data ?? [];
}

async function patchRows(table, filters, body) {
  const query = [`select=*`, ...filters].join('&');
  const { data } = await rest(table, { method: 'PATCH', query, body, prefer: 'return=representation' });
  return data ?? [];
}

async function listAuthUsers() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, {
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
    throw error;
  }

  return data.user ?? data;
}

function workIdToEmail(workId) {
  return `${workId.toLowerCase()}@ice.erp`;
}

function nextWorkId(existingWorkIds) {
  const year = new Date().getFullYear();
  let maxSeq = 0;
  for (const workId of existingWorkIds) {
    const match = String(workId).match(new RegExp(`^AQI-${year}(\\d{4})$`));
    if (match) maxSeq = Math.max(maxSeq, Number(match[1]));
  }
  return `AQI-${year}${String(maxSeq + 1).padStart(4, '0')}`;
}

function chunk(array, size) {
  const output = [];
  for (let index = 0; index < array.length; index += size) {
    output.push(array.slice(index, index + size));
  }
  return output;
}

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function ensureOrganization() {
  const existing = await maybeSingle('organizations');
  if (existing) return existing;

  const [created] = await insertRows('organizations', {
    name: 'Absolute Ice Cream ERP',
    address: 'Harare, Zimbabwe',
    phone: '+263-77-000-0000',
    email: 'demo@absoluteicecream.local',
    tax_number: 'TAX-DEMO-001',
    currency: 'USD',
    financial_year_start: 1,
  });
  return created;
}

async function ensureRoles(organizationId) {
  if (!(await tableExists('roles'))) return [];
  const existing = await selectAll('roles');
  const existingNames = new Set(existing.map((role) => String(role.name).toLowerCase()));
  const seeds = [
    ['Super Admin', 'Full system access'],
    ['Branch Manager', 'Manage a single branch'],
    ['Manager', 'Operations management'],
    ['Staff', 'Standard staff access'],
  ]
    .filter(([name]) => !existingNames.has(name.toLowerCase()))
    .map(([name, description]) => ({
      organization_id: organizationId,
      name,
      description,
      is_system_role: true,
    }));

  if (seeds.length > 0) await insertRows('roles', seeds);
  return await selectAll('roles');
}

async function ensureRowsByCode(table, rows, codeField = 'code') {
  const existing = await selectAll(table, '*');
  const existingCodes = new Set(existing.map((row) => String(row[codeField] ?? '')));
  const missing = rows.filter((row) => !existingCodes.has(String(row[codeField])));
  if (missing.length > 0) {
    for (const batch of chunk(missing, 100)) {
      await insertRows(table, batch);
    }
  }
  return await selectAll(table, '*');
}

async function ensureMasterData(organizationId, adminUserId) {
  const branches = await ensureRowsByCode('branches', Array.from({ length: 10 }, (_, index) => ({
    organization_id: organizationId,
    code: `BR-${String(index + 1).padStart(3, '0')}`,
    name: `Branch ${index + 1}`,
    address: `Demo Location ${index + 1}, ${['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo'][index % 5]}`,
    phone: `+263242000${String(index + 1).padStart(3, '0')}`,
    status: 'ACTIVE',
  })));

  const warehouses = await ensureRowsByCode('warehouses', branches.map((branch, index) => ({
    organization_id: organizationId,
    branch_id: branch.id,
    code: `WH-${String(index + 1).padStart(3, '0')}`,
    name: `${branch.name} Warehouse`,
    type: index === 0 ? 'MAIN' : 'BRANCH',
    address: `${branch.name} stock point`,
    capacity_kg: 1000 + index * 200,
    is_active: true,
  })));

  const units = await ensureRowsByCode('units_of_measure', [
    ['UNIT', 'UNIT', 'General Unit', 'GENERAL'],
    ['KG', 'KG', 'Kilogram', 'WEIGHT'],
    ['G', 'G', 'Gram', 'WEIGHT'],
    ['L', 'L', 'Litre', 'VOLUME'],
    ['ML', 'ML', 'Millilitre', 'VOLUME'],
    ['CTN', 'CTN', 'Carton', 'PACK'],
    ['BOX', 'BOX', 'Box', 'PACK'],
    ['PACK', 'PACK', 'Pack', 'PACK'],
    ['TRAY', 'TRAY', 'Tray', 'PACK'],
    ['BAG', 'BAG', 'Bag', 'PACK'],
  ].map(([, abbreviation, name], index) => ({
    organization_id: organizationId,
    abbreviation,
    name,
  })), 'abbreviation');

  const categories = await ensureRowsByCode('item_categories', [
    'Finished Goods',
    'Raw Materials',
    'Packaging Materials',
    'Cleaning Materials',
    'Spare Parts',
    'Consumables',
    'Office Supplies',
    'Maintenance Items',
    'Promotional Materials',
    'Utilities',
  ].map((name) => ({
    organization_id: organizationId,
    name,
    description: `${name} demo category`,
  })), 'name');

  const categoryByName = new Map(categories.map((row) => [row.name, row.id]));
  const unitByCode = new Map(units.map((row) => [row.abbreviation, row.id]));

  const items = await ensureRowsByCode('items', [
    ['FG-CONE', 'Ice Cream Cones', 'FINISHED_GOOD', 'Finished Goods', 'UNIT', 1.2, 2.5],
    ['FG-2L', '2L Ice Cream Tub', 'FINISHED_GOOD', 'Finished Goods', 'UNIT', 4.8, 8.5],
    ['FG-5L', '5L Ice Cream Tub', 'FINISHED_GOOD', 'Finished Goods', 'UNIT', 8.6, 14.0],
    ['FG-125ML', '125ml Ice Cream Tub', 'FINISHED_GOOD', 'Finished Goods', 'UNIT', 0.9, 1.8],
    ['FG-VANILLA', 'Vanilla Family Pack', 'FINISHED_GOOD', 'Finished Goods', 'UNIT', 3.5, 6.8],
    ['RM-MIX', 'Ice Cream Base Mix', 'RAW_MATERIAL', 'Raw Materials', 'KG', 2.0, 0],
    ['RM-SUGAR', 'Sugar', 'RAW_MATERIAL', 'Raw Materials', 'KG', 1.1, 0],
    ['RM-MILK', 'Milk Powder', 'RAW_MATERIAL', 'Raw Materials', 'KG', 3.2, 0],
    ['RM-COCOA', 'Cocoa Powder', 'RAW_MATERIAL', 'Raw Materials', 'KG', 5.4, 0],
    ['RM-VAN', 'Vanilla Flavour', 'RAW_MATERIAL', 'Raw Materials', 'ML', 0.12, 0],
    ['PK-CONEBAG', 'Cone Bags', 'PACKAGING_MATERIAL', 'Packaging Materials', 'CTN', 6.0, 0],
    ['PK-LABEL', 'Product Labels', 'PACKAGING_MATERIAL', 'Packaging Materials', 'BOX', 2.3, 0],
  ].map(([code, name, itemType, categoryName, unitCode, unitCost, sellingPrice]) => ({
    organization_id: organizationId,
    code,
    name,
    description: `${name} demo item`,
    type: itemType,
    category_id: categoryByName.get(categoryName),
    unit_id: unitByCode.get(unitCode),
    standard_cost: unitCost,
    selling_price: sellingPrice,
    reorder_level: 10,
    reorder_qty: 25,
    shelf_life_days: itemType === 'RAW_MATERIAL' ? 180 : null,
    requires_quality_check: itemType === 'FINISHED_GOOD',
    is_active: true,
  })).filter((row) => row.category_id && row.unit_id));

  const supplierCategories = await ensureRowsByCode('supplier_categories', [
    'Dairy Inputs',
    'Flavours',
    'Packaging',
    'Cleaning',
    'Utilities',
    'Maintenance',
    'Cold Chain',
    'Distribution',
    'Office',
    'General',
  ].map((name) => ({
    organization_id: organizationId,
    name,
  })), 'name');

  const supplierCategoryIds = supplierCategories.map((row) => row.id);

  const suppliers = await ensureRowsByCode('suppliers', Array.from({ length: 10 }, (_, index) => ({
    organization_id: organizationId,
    category_id: supplierCategoryIds[index % supplierCategoryIds.length],
    code: `SUP-${String(index + 1).padStart(5, '0')}`,
    name: `Demo Supplier ${index + 1}`,
    contact_person: `Supplier Contact ${index + 1}`,
    phone: `+263770000${String(index + 1).padStart(3, '0')}`,
    email: `supplier${index + 1}@absoluteicecream.local`,
    address: `Industrial Site ${index + 1}, Harare`,
    payment_terms: index % 2 === 0 ? '30 DAYS' : 'CASH',
    credit_limit: 500 + index * 100,
    credit_days: index % 2 === 0 ? 30 : 7,
    status: 'ACTIVE',
  })));

  const customers = await ensureRowsByCode('customers', Array.from({ length: 10 }, (_, index) => ({
    organization_id: organizationId,
    code: `CUS-${String(index + 1).padStart(5, '0')}`,
    name: `Demo Customer ${index + 1}`,
    contact_person: `Customer Contact ${index + 1}`,
    status: 'ACTIVE',
    email: `customer${index + 1}@absoluteicecream.local`,
    phone: `+263780000${String(index + 1).padStart(3, '0')}`,
    address: `Customer Street ${index + 1}, Zimbabwe`,
    credit_days: index % 2 === 0 ? 30 : 0,
    credit_limit: index % 2 === 0 ? 1000 + index * 100 : 0,
    outstanding_balance: 0,
  })));

  const accounts = await ensureRowsByCode('accounts', [
    ['1000', 'Cash at Bank', 'ASSET'],
    ['1010', 'Cash on Hand', 'ASSET'],
    ['1100', 'Accounts Receivable', 'ASSET'],
    ['1200', 'Inventory', 'ASSET'],
    ['1500', 'Fixed Assets', 'ASSET'],
    ['2000', 'Accounts Payable', 'LIABILITY'],
    ['3000', 'Capital', 'EQUITY'],
    ['4000', 'Sales Revenue', 'REVENUE'],
    ['5000', 'Cost of Goods Sold', 'EXPENSE'],
    ['6100', 'Operating Expenses', 'EXPENSE'],
  ].map(([code, name, type]) => ({
    organization_id: organizationId,
    code,
    name,
    type,
    is_active: true,
  })));

  const stockItems = items.slice(0, 10);
  const existingBalances = await selectAll('stock_balances');
  const existingKeys = new Set(existingBalances.map((row) => `${row.item_id}:${row.warehouse_id}`));
  const balanceRows = [];
  for (const warehouse of warehouses) {
    for (const [index, item] of stockItems.entries()) {
      const key = `${item.id}:${warehouse.id}`;
      if (existingKeys.has(key)) continue;
      balanceRows.push({
        organization_id: organizationId,
        item_id: item.id,
        warehouse_id: warehouse.id,
        quantity: 50 + index * 5,
      });
    }
  }
  if (balanceRows.length > 0) {
    for (const batch of chunk(balanceRows, 100)) await insertRows('stock_balances', batch);
  }

  return { branches, warehouses, units, categories, items, suppliers, customers, accounts };
}

async function ensureEmployees(organizationId, adminUserId, branches) {
  return ensureRowsByCode('employees', Array.from({ length: 10 }, (_, index) => {
    const branch = branches[index % branches.length];
    return {
      organization_id: organizationId,
      employee_number: `EMP-${String(index + 1).padStart(4, '0')}`,
      first_name: `Demo${index + 1}`,
      last_name: 'Employee',
      email: `employee${index + 1}@absoluteicecream.local`,
      phone: `+263710000${String(index + 1).padStart(3, '0')}`,
      branch_id: branch.id,
      hire_date: isoDate(-365 + index * 7),
      status: 'ACTIVE',
      basic_salary: 450 + index * 25,
      position: ['Operator', 'Driver', 'Store Clerk', 'Sales Clerk', 'Cleaner'][index % 5],
      department: ['Production', 'Sales', 'Stores', 'Admin', 'Quality'][index % 5],
      shift: index % 2 === 0 ? 'DAY' : 'NIGHT',
    };
  }), 'employee_number');
}

async function ensureRecipes(organizationId, items, units) {
  const finishedGoods = items.filter((item) => item.type === 'FINISHED_GOOD').slice(0, 5);
  return ensureRowsByCode('recipes', finishedGoods.map((item, index) => ({
    organization_id: organizationId,
    code: `RCP-${String(index + 1).padStart(5, '0')}`,
    name: `${item.name} Recipe`,
    finished_item_id: item.id,
    batch_size: 100 + index * 20,
    status: 'ACTIVE',
    version: 1,
  })));
}

async function ensurePurchaseOrders(organizationId, adminUserId, suppliers, items, units) {
  const rawItems = items.filter((item) => item.type !== 'FINISHED_GOOD').slice(0, 5);
  const existingOrders = await selectAll('purchase_orders');
  const existingNumbers = new Set(existingOrders.map((row) => String(row.po_number)));
  const existingItems = await selectAll('purchase_order_items');
  const existingItemKeys = new Set(existingItems.map((row) => `${row.po_id}:${row.item_id}`));

  for (let index = 0; index < 10; index += 1) {
    const poNumber = `PO-${String(index + 1).padStart(5, '0')}`;
    let order = existingOrders.find((row) => row.po_number === poNumber);
    if (!order && !existingNumbers.has(poNumber)) {
      const subtotal = rawItems.reduce((sum, item, lineIndex) => sum + (20 + lineIndex * 5) * Number(item.standard_cost ?? 1), 0);
      [order] = await insertRows('purchase_orders', {
        po_number: poNumber,
        supplier_id: suppliers[index % suppliers.length].id,
        organization_id: organizationId,
        order_date: isoDate(-30 + index),
        status: 'APPROVED',
        total_amount: subtotal,
      });
      existingOrders.push(order);
    }

    if (order) {
      const lineRows = rawItems
        .map((item, lineIndex) => {
          const quantity = 20 + lineIndex * 5;
          const key = `${order.id}:${item.id}`;
          if (existingItemKeys.has(key)) return null;
          existingItemKeys.add(key);
          return {
            po_id: order.id,
            item_id: item.id,
            quantity,
            unit_price: Number(item.standard_cost ?? 1),
            tax_rate: 0,
            line_total: quantity * Number(item.standard_cost ?? 1),
            received_qty: 0,
          };
        })
        .filter(Boolean);
      if (lineRows.length > 0) await insertRows('purchase_order_items', lineRows);
    }
  }

  return await selectAll('purchase_orders');
}

async function ensureGoodsReceivedNotes(organizationId, adminUserId, purchaseOrders, warehouses) {
  const existing = await selectAll('goods_received_notes');
  const existingNumbers = new Set(existing.map((row) => String(row.grn_number)));
  const purchaseOrderItems = await selectAll('purchase_order_items');
  const existingItems = await selectAll('grn_items');
  const existingItemKeys = new Set(existingItems.map((row) => `${row.grn_id}:${row.item_id}`));
  const rows = [];
  for (let index = 0; index < 10; index += 1) {
    const grnNumber = `GRN-${String(index + 1).padStart(5, '0')}`;
    if (existingNumbers.has(grnNumber)) continue;
    rows.push({
      grn_number: grnNumber,
      warehouse_id: warehouses[index % warehouses.length]?.id ?? null,
      organization_id: organizationId,
      po_id: purchaseOrders[index % purchaseOrders.length]?.id ?? null,
      supplier_id: purchaseOrders[index % purchaseOrders.length]?.supplier_id ?? null,
      received_date: isoDate(-20 + index),
      status: 'DRAFT',
    });
  }
  const inserted = rows.length > 0 ? await insertRows('goods_received_notes', rows) : [];
  const allNotes = existing.concat(inserted);

  for (const note of allNotes.slice(0, 10)) {
    const poItems = purchaseOrderItems.filter((row) => row.po_id === note.po_id).slice(0, 3);
    const lineRows = poItems
      .map((row) => {
        const key = `${note.id}:${row.item_id}`;
        if (existingItemKeys.has(key)) return null;
        existingItemKeys.add(key);
        return {
          grn_id: note.id,
          item_id: row.item_id,
          po_item_id: row.id,
          ordered_qty: Number(row.quantity ?? 0),
          received_qty: Number(row.quantity ?? 0),
          rejected_qty: 0,
          unit_cost: Number(row.unit_price ?? 0),
          quality_status: 'PENDING',
        };
      })
      .filter(Boolean);
    if (lineRows.length > 0) await insertRows('grn_items', lineRows);
  }
}

async function ensureProductionBatches(organizationId, recipes, warehouses) {
  const existing = await selectAll('production_batches');
  const existingNumbers = new Set(existing.map((row) => String(row.batch_number)));
  const rows = [];
  for (let index = 0; index < 10; index += 1) {
    const batchNumber = `PB-${String(index + 1).padStart(5, '0')}`;
    if (existingNumbers.has(batchNumber)) continue;
    rows.push({
      organization_id: organizationId,
      batch_number: batchNumber,
      recipe_id: recipes[index % recipes.length]?.id ?? null,
      warehouse_id: warehouses[index % warehouses.length]?.id ?? null,
      shift: index % 2 === 0 ? 'DAY' : 'NIGHT',
      planned_date: isoDate(-12 + index),
      planned_qty: 100 + index * 10,
      actual_qty: 96 + index * 9,
      rejected_qty: 1,
      wastage_qty: 3,
      yield_percent: 96,
      status: 'PLANNED',
    });
  }
  if (rows.length > 0) await insertRows('production_batches', rows);
}

async function ensureSalesOrders(organizationId, adminUserId, customers, warehouses, items) {
  const finishedGoods = items.filter((item) => item.type === 'FINISHED_GOOD').slice(0, 4);
  const existingOrders = await selectAll('sales_orders');
  const existingNumbers = new Set(existingOrders.map((row) => String(row.order_number)));
  const existingItems = await selectAll('sales_order_items');
  const existingItemKeys = new Set(existingItems.map((row) => `${row.order_id}:${row.item_id}`));

  for (let index = 0; index < 10; index += 1) {
    const orderNumber = `SO-${String(index + 1).padStart(5, '0')}`;
    let order = existingOrders.find((row) => row.order_number === orderNumber);
    if (!order && !existingNumbers.has(orderNumber)) {
      const branchId = warehouses[index % warehouses.length]?.branch_id ?? null;
      const subtotal = finishedGoods.reduce((sum, item, lineIndex) => sum + (10 + lineIndex * 2) * Number(item.selling_price ?? 1), 0);
      [order] = await insertRows('sales_orders', {
        organization_id: organizationId,
        order_number: orderNumber,
        customer_id: customers[index % customers.length].id,
        warehouse_id: warehouses[index % warehouses.length].id,
        branch_id: branchId,
        order_date: isoDate(-10 + index),
        status: 'CONFIRMED',
        total_amount: subtotal,
      });
      existingOrders.push(order);
    }

    if (order) {
      const lineRows = finishedGoods
        .map((item, lineIndex) => {
          const quantity = 10 + lineIndex * 2;
          const key = `${order.id}:${item.id}`;
          if (existingItemKeys.has(key)) return null;
          existingItemKeys.add(key);
          return {
            order_id: order.id,
            item_id: item.id,
            batch_number: null,
            quantity,
            unit_price: Number(item.selling_price ?? 0),
            discount_pct: 0,
            tax_rate: 0,
            line_total: quantity * Number(item.selling_price ?? 0),
            cogs: quantity * Number(item.standard_cost ?? 0),
          };
        })
        .filter(Boolean);
      if (lineRows.length > 0) await insertRows('sales_order_items', lineRows);
    }
  }

  return await selectAll('sales_orders');
}

async function ensureInvoices(organizationId, adminUserId, customers, salesOrders) {
  const existing = await selectAll('invoices');
  const existingNumbers = new Set(existing.map((row) => String(row.invoice_number)));
  const rows = [];
  for (let index = 0; index < 10; index += 1) {
    const invoiceNumber = `INV-${String(index + 1).padStart(5, '0')}`;
    if (existingNumbers.has(invoiceNumber)) continue;
    const total = 150 + index * 25;
    rows.push({
      organization_id: organizationId,
      invoice_number: invoiceNumber,
      order_id: salesOrders[index % salesOrders.length]?.id ?? null,
      customer_id: customers[index % customers.length].id,
      invoice_date: isoDate(-8 + index),
      due_date: isoDate(14 + index),
      status: 'SENT',
      subtotal: total,
      tax_amount: 0,
      total_amount: total,
      paid_amount: index % 3 === 0 ? total / 2 : 0,
      balance_due: index % 3 === 0 ? total / 2 : total,
    });
  }
  if (rows.length > 0) await insertRows('invoices', rows);
}

async function ensureBudgets(organizationId, adminUserId, branches, accounts) {
  const existingBudgets = await selectAll('budgets');
  const existingNames = new Set(existingBudgets.map((row) => String(row.name)));
  const existingLines = await selectAll('budget_lines');
  const lineKeys = new Set(existingLines.map((row) => `${row.budget_id}:${row.account_id}`));

  for (let index = 0; index < 10; index += 1) {
    const budgetName = `Demo Budget ${2026 + index}`;
    let budget = existingBudgets.find((row) => row.name === budgetName);
    if (!budget && !existingNames.has(budgetName)) {
      [budget] = await insertRows('budgets', {
        organization_id: organizationId,
        name: budgetName,
        department: ['Finance', 'Production', 'Sales', 'Stores', 'HR'][index % 5],
        period_start: `${2026 + index}-01-01`,
        period_end: `${2026 + index}-12-31`,
        status: 'DRAFT',
        total_budget: 10000 + index * 2500,
        total_actual: 0,
        variance: 10000 + index * 2500,
      });
      existingBudgets.push(budget);
    }

    if (!budget) continue;
    const rows = accounts.slice(0, 3)
      .filter((account) => !lineKeys.has(`${budget.id}:${account.id}`))
      .map((account, lineIndex) => ({
        budget_id: budget.id,
        account_id: account.id,
        description: `${account.name} allocation`,
        budgeted_amount: 2500 + lineIndex * 1000 + index * 250,
        actual_amount: 0,
        variance: 2500 + lineIndex * 1000 + index * 250,
        month: null,
      }));
    if (rows.length > 0) await insertRows('budget_lines', rows);
  }
}

async function ensureBranchShiftCloses(adminUserId, branches) {
  const existing = await selectAll('branch_shift_closes');
  const existingKeys = new Set(existing.map((row) => `${row.branch_id}:${String(row.shift_date).slice(0, 10)}`));
  const rows = [];
  for (let index = 0; index < 10; index += 1) {
    const branch = branches[index % branches.length];
    const shiftDate = isoDate(-index);
    const key = `${branch.id}:${shiftDate}`;
    if (existingKeys.has(key)) continue;
    rows.push({
      organization_id: branch.organization_id,
      branch_id: branch.id,
      shift_date: shiftDate,
      shift: index % 2 === 0 ? 'DAY' : 'NIGHT',
      opening_balance: 150 + index * 10,
      total_sales: 600 + index * 50,
      total_expenses: 90 + index * 5,
      closing_balance: 660 + index * 55,
      cash_counted: 655 + index * 54,
      variance: -5 + index,
      status: 'OPEN',
    });
  }
  if (rows.length > 0) await insertRows('branch_shift_closes', rows);
}

async function ensureBranchSales(organizationId, branches, items) {
  const finishedGoods = items.filter((item) => item.type === 'FINISHED_GOOD').slice(0, 4);
  if (finishedGoods.length === 0) return;
  const existing = await selectAll('branch_sales');
  const existingKeys = new Set(existing.map((row) => `${row.branch_id}:${row.sale_date}:${row.item_id}`));
  const rows = [];
  for (let index = 0; index < 10; index += 1) {
    const branch = branches[index % branches.length];
    const item = finishedGoods[index % finishedGoods.length];
    const saleDate = isoDate(-index);
    const key = `${branch.id}:${saleDate}:${item.id}`;
    if (existingKeys.has(key)) continue;
    rows.push({
      organization_id: organizationId,
      branch_id: branch.id,
      sale_date: saleDate,
      shift: index % 2 === 0 ? 'DAY' : 'NIGHT',
      item_id: item.id,
      quantity: 12 + index,
      unit_price: Number(item.selling_price ?? 0),
      total_amount: (12 + index) * Number(item.selling_price ?? 0),
      payment_method: index % 3 === 0 ? 'CARD' : index % 2 === 0 ? 'CASH' : 'ECOCASH',
    });
  }
  if (rows.length > 0) await insertRows('branch_sales', rows);
}

async function runStep(name, operation) {
  try {
    const result = await operation();
    return { name, ok: true, result };
  } catch (error) {
    return {
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function ensureDemoUsers(branches) {
  const existingUsers = await selectAll('users');
  const workIds = existingUsers.map((user) => String(user.work_id));
  const authUsers = await listAuthUsers();
  const authByEmail = new Map(authUsers.map((user) => [String(user.email).toLowerCase(), user]));

  const desiredAccounts = [
    ['Super', 'Admin', 'super_admin', null, 'super.admin@absoluteicecream.local'],
    ['Branch', 'Manager', 'branch_manager', branches[0]?.id ?? null, 'branch.manager@absoluteicecream.local'],
    ['Operations', 'Manager', 'manager', branches[1]?.id ?? null, 'operations.manager@absoluteicecream.local'],
    ['Production', 'Lead', 'manager', branches[2]?.id ?? null, 'production.lead@absoluteicecream.local'],
    ['Sales', 'Lead', 'manager', branches[3]?.id ?? null, 'sales.lead@absoluteicecream.local'],
    ['Finance', 'Clerk', 'staff', branches[4]?.id ?? null, 'finance.clerk@absoluteicecream.local'],
    ['Store', 'Clerk', 'staff', branches[5]?.id ?? null, 'store.clerk@absoluteicecream.local'],
    ['Quality', 'Officer', 'staff', branches[6]?.id ?? null, 'quality.officer@absoluteicecream.local'],
  ];

  const created = [];

  for (const [firstName, lastName, role, branchId, email] of desiredAccounts) {
    let user = existingUsers.find((row) => String(row.email).toLowerCase() === email.toLowerCase());
    if (!user) {
      const workId = nextWorkId(workIds);
      workIds.push(workId);
      const authEmail = workIdToEmail(workId);
      let authUser = authByEmail.get(authEmail.toLowerCase());
      if (!authUser) {
        authUser = await createAuthUser({ email: authEmail, password: DEMO_PASSWORD });
        authByEmail.set(authEmail.toLowerCase(), authUser);
      }
      if (!authUser?.id) {
        const refreshedUsers = await listAuthUsers();
        authUser = refreshedUsers.find((candidate) => String(candidate.email).toLowerCase() === authEmail.toLowerCase());
      }
      if (!authUser?.id) {
        throw new Error(`Unable to resolve auth user for ${authEmail}`);
      }

      [user] = await insertRows('users', {
        auth_id: authUser.id,
        work_id: workId,
        email,
        full_name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
        role,
        branch_id: branchId,
        status: 'active',
        id_number: `90000000A${String(created.length + 10).padStart(2, '0')}`,
      });
      existingUsers.push(user);
      created.push({ workId, role, email });
      continue;
    }

    const updates = {};
    if (String(user.role ?? '') !== role) updates.role = role;
    if ((user.branch_id ?? null) !== branchId) updates.branch_id = branchId;
    if (Object.keys(updates).length > 0) {
      const [patched] = await patchRows('users', [`id=eq.${user.id}`], updates);
      Object.assign(user, patched ?? updates);
    }
  }

  return { users: existingUsers, created };
}

async function main() {
  const organization = await ensureOrganization();
  const stepResults = [];
  stepResults.push(await runStep('roles', () => ensureRoles(organization.id)));

  const adminSeedUser = await maybeSingle('users', '*', ['order=created_at.asc']);
  const adminUserId = adminSeedUser?.id ?? null;
  if (!adminUserId) throw new Error('At least one existing user is required to seed audit-linked demo data.');

  const master = await ensureMasterData(organization.id, adminUserId);
  stepResults.push(await runStep('employees', () => ensureEmployees(organization.id, adminUserId, master.branches)));

  const recipesStep = await runStep('recipes', () => ensureRecipes(organization.id, master.items, master.units));
  stepResults.push(recipesStep);
  const recipes = recipesStep.ok ? recipesStep.result : [];

  const purchaseOrdersStep = await runStep('purchase_orders', () => ensurePurchaseOrders(organization.id, adminUserId, master.suppliers, master.items, master.units));
  stepResults.push(purchaseOrdersStep);
  const purchaseOrders = purchaseOrdersStep.ok ? purchaseOrdersStep.result : [];

  stepResults.push(await runStep('goods_received_notes', () => ensureGoodsReceivedNotes(organization.id, adminUserId, purchaseOrders, master.warehouses)));
  stepResults.push(await runStep('production_batches', () => ensureProductionBatches(organization.id, recipes, master.warehouses)));

  const salesOrdersStep = await runStep('sales_orders', () => ensureSalesOrders(organization.id, adminUserId, master.customers, master.warehouses, master.items));
  stepResults.push(salesOrdersStep);
  const salesOrders = salesOrdersStep.ok ? salesOrdersStep.result : [];

  stepResults.push(await runStep('invoices', () => ensureInvoices(organization.id, adminUserId, master.customers, salesOrders)));
  stepResults.push(await runStep('budgets', () => ensureBudgets(organization.id, adminUserId, master.branches, master.accounts)));
  stepResults.push(await runStep('branch_shift_closes', () => ensureBranchShiftCloses(adminUserId, master.branches)));
  stepResults.push(await runStep('branch_sales', () => ensureBranchSales(organization.id, master.branches, master.items)));
  const demoUsers = await ensureDemoUsers(master.branches);

  const summaryTables = [
    'organizations',
    'users',
    'roles',
    'branches',
    'warehouses',
    'units_of_measure',
    'item_categories',
    'items',
    'supplier_categories',
    'suppliers',
    'customers',
    'employees',
    'accounts',
    'stock_balances',
    'purchase_orders',
    'purchase_order_items',
    'goods_received_notes',
    'recipes',
    'production_batches',
    'sales_orders',
    'sales_order_items',
    'invoices',
    'budgets',
    'budget_lines',
    'branch_shift_closes',
    'branch_sales',
  ];

  const counts = {};
  for (const table of summaryTables) {
    try {
      counts[table] = (await rest(table, { query: 'select=*&limit=1', prefer: 'count=exact' })).count;
    } catch {
      counts[table] = null;
    }
  }

  console.log(JSON.stringify({
    demoPassword: DEMO_PASSWORD,
    demoUsers: demoUsers.created,
    steps: stepResults,
    counts,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  if (error instanceof Error && error.stack) console.error(error.stack);
  if (error.payload) console.error(JSON.stringify(error.payload, null, 2));
  process.exitCode = 1;
});
