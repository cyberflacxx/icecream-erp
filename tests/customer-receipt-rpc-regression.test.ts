import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('customer receipt migration uses typed account rows without changing the atomic receipt contract', () => {
  const migration = readFileSync(
    join(process.cwd(), 'migrations', '069_fix_customer_receipt_unassigned_account_record.sql'),
    'utf8',
  );

  assert.match(migration, /to_regprocedure\('icecream_erp\.post_sales_payment_transaction_v2\(uuid,uuid,jsonb\)'\)/);
  assert.match(migration, /v_bank_account icecream_erp\.bank_accounts%rowtype/);
  assert.match(migration, /v_cash_account icecream_erp\.cash_accounts%rowtype/);
  assert.doesNotMatch(migration, /v_bank_account record/);
  assert.doesNotMatch(migration, /v_cash_account record/);
  assert.match(migration, /Receipt RPC declaration block is not the expected migration-065 version/);
  assert.match(migration, /revoke all on function icecream_erp\.post_sales_payment_transaction_v2/);
  assert.match(migration, /grant execute on function icecream_erp\.post_sales_payment_transaction_v2[\s\S]*service_role/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(migration, /\b(create|alter|drop)\s+table\b/i);
  assert.doesNotMatch(migration, /^\s*(insert|update|delete|truncate)\s+/im);
  assert.doesNotMatch(migration, /\b(public|auth)\./i);
});
