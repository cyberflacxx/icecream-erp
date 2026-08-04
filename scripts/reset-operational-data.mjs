import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const REQUIRED_CONFIRMATION = 'RESET ICECREAM ERP OPERATIONAL DATA';
const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env');
const SCHEMA = 'icecream_erp';

const TRANSACTION_TABLES = [
  'sales_dispatch_note_items',
  'sales_dispatch_notes',
  'invoice_items',
  'payments',
  'invoices',
  'sales_order_items',
  'sales_orders',
  'quotation_items',
  'quotations',
  'supplier_payments',
  'grn_items',
  'goods_received_notes',
  'purchase_order_items',
  'purchase_orders',
  'purchase_requisition_items',
  'purchase_requisitions',
  'stock_transfer_items',
  'stock_transfers',
  'production_batch_outputs',
  'production_batches',
  'production_plan_items',
  'production_plans',
  'production_material_request_items',
  'production_material_requests',
  'inventory_batches',
  'stock_movements',
  'stock_balances',
  'bank_transactions',
  'cash_transactions',
  'journal_entry_lines',
  'journal_entries',
  'branch_sales',
  'branch_expenses',
];

function parseArgs(argv) {
  const args = {
    confirm: '',
    dryRun: false,
    organizationId: '',
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg.startsWith('--organization-id=')) {
      args.organizationId = arg.slice('--organization-id='.length).trim();
      continue;
    }
    if (arg.startsWith('--confirm=')) {
      args.confirm = arg.slice('--confirm='.length).trim();
    }
  }

  return args;
}

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

function isMissingRelation(error) {
  const message = String(error?.message ?? error ?? '');
  return (
    message.includes('Could not find the table') ||
    message.includes('does not exist') ||
    message.includes('PGRST205')
  );
}

async function tableExists(supabase, table) {
  const { error } = await supabase.from(table).select('id').limit(1);
  if (!error) return true;
  if (isMissingRelation(error)) return false;
  throw error;
}

async function countRows(supabase, table, organizationId) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  return count ?? 0;
}

async function deleteRows(supabase, table, organizationId) {
  const { error } = await supabase.from(table).delete().eq('organization_id', organizationId);
  if (error) {
    if (isMissingRelation(error)) return false;
    throw error;
  }
  return true;
}

async function updateRows(supabase, table, organizationId, payload) {
  const { error } = await supabase.from(table).update(payload).eq('organization_id', organizationId);
  if (error) {
    if (isMissingRelation(error)) return false;
    throw error;
  }
  return true;
}

async function main() {
  const { confirm, dryRun, organizationId } = parseArgs(process.argv.slice(2));

  if (!organizationId) {
    throw new Error('Missing --organization-id=<uuid>.');
  }
  if (confirm !== REQUIRED_CONFIRMATION) {
    throw new Error(`Missing exact confirmation phrase. Re-run with --confirm="${REQUIRED_CONFIRMATION}"`);
  }

  const env = parseEnv(await fs.readFile(ENV_PATH, 'utf8'));
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: SCHEMA },
  });

  const summary = {
    confirmationRequired: REQUIRED_CONFIRMATION,
    deleted: {},
    dryRun,
    organizationId,
    resetBalances: {},
    skipped: {},
  };

  for (const table of TRANSACTION_TABLES) {
    if (!(await tableExists(supabase, table))) {
      summary.skipped[table] = 'missing';
      continue;
    }

    const count = await countRows(supabase, table, organizationId);
    if (count === null) {
      summary.skipped[table] = 'missing';
      continue;
    }

    summary.deleted[table] = count;
    if (!dryRun && count > 0) {
      await deleteRows(supabase, table, organizationId);
    }
  }

  const balanceResets = [
    ['customers', { current_balance: 0, outstanding_balance: 0 }],
    ['suppliers', { current_balance: 0, outstanding_balance: 0 }],
    ['cash_accounts', { balance: 0, current_balance: 0 }],
    ['bank_accounts', { current_balance: 0 }],
  ];

  for (const [table, payload] of balanceResets) {
    if (!(await tableExists(supabase, table))) {
      summary.skipped[table] = 'missing';
      continue;
    }
    summary.resetBalances[table] = dryRun ? 'planned' : 'completed';
    if (!dryRun) {
      await updateRows(supabase, table, organizationId, payload);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
