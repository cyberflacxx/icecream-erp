# Production Order Workflow Migration Manifest

Apply these migrations after `034_atomic_inventory_approval_processing.sql` in one controlled deployment window. Do not apply them directly from the app task workspace without an approved VPS deployment run.

| Migration | Purpose | Dependencies | Validation Query | Rollback Approach | Risk / Lock Impact |
| --- | --- | --- | --- | --- | --- |
| `035_production_order_workflow_foundation.sql` | Adds production orders, component snapshots, status history, and `number_series` compatibility. | Existing `items`, `recipes`, `warehouses`, `users`, `organizations`. | `select count(*) from icecream_erp.production_orders;` | Export data, then drop dependent production-order objects. | Low-medium; creates tables/indexes only. |
| `036_production_issue_and_receipt_documents.sql` | Adds issue/receipt headers, lines, and document links. | `035`; existing inventory item/warehouse masters. | `select count(*) from icecream_erp.production_issues;` | Export documents, drop links/lines/headers in reverse order. | Low; new tables/indexes only. |
| `037_production_order_planning_release_rpcs.sql` | Adds atomic document-number, planned-order save, component rebuild, and release RPCs. | `035`, `036`; active `recipes` as BOMs. | `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='icecream_erp' and proname='release_production_order';` | Drop functions after API traffic is stopped. | Medium; release locks one order and rebuilds components. |
| `038_production_order_transaction_rpcs.sql` | Adds atomic issue, receipt, reversal, and close RPCs integrated with stock balances/movements. | `033`, `035`, `036`, `037`; stock movement compatibility columns. | `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='icecream_erp' and proname like '%production_%';` | Drop functions first; reverse posted documents before dropping tables. | Medium-high; posting locks order, document, and affected stock balance rows. |
| `039_production_relationship_map_and_reporting.sql` | Adds relationship/cost views and production-order permissions. | `035`-`038`; `permissions` table. | `select * from icecream_erp.production_order_relationship_map limit 1;` | Drop views; permission rows may be left harmlessly or removed after role review. | Low; view creation and permission seed only. |
| `040_sales_finance_transaction_engine.sql` | Adds the hardened sales finance transaction engine, configurable posting-account mappings, idempotency keys, split tender/allocation rows, document relationships, and atomic invoice/payment RPCs. | `029`, `030`, `033`, `035`; existing `accounts`, `fiscal_periods`, `settings_payment_methods`, `stock_balances`, `stock_movements`, `invoices`, and `payments`. | `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='icecream_erp' and proname in ('post_sales_invoice_transaction', 'post_sales_payment_transaction', 'sales_resolve_posting_account_id');` | Drop sales RPCs first; keep posted financial documents and reverse through workflow before dropping support tables. | Medium-high; invoice/payment posting locks customer, invoice, stock balance, and number-series rows. |

Deployment prerequisites:

- Expected PostgreSQL major version: `15.x` on the VPS. Local rehearsal completed on PostgreSQL `17.6`; no version-specific syntax differences were introduced.
- Required extension: `pgcrypto`.
- Required baseline state: representative `icecream_erp` schema immediately before `035`, including `029`, `030`, `033`, and `034`.
- Required application env flag after successful DB deployment and mapping review:
  `SALES_TRANSACTION_ENGINE_REQUIRED=true`
- Do not enable the sales flag until `040` has applied successfully and posting/payment mappings are configured.

Backup commands before deployment:

```bash
BACKUP_TS="$(date +%Y%m%d_%H%M%S)"
docker exec supabase-db pg_dump -U supabase_admin -Fc --schema=icecream_erp postgres > "/root/migrations/icecream_erp_${BACKUP_TS}.dump"
docker exec supabase-db pg_dump -U supabase_admin --schema-only --schema=icecream_erp postgres > "/root/migrations/icecream_erp_${BACKUP_TS}_schema.sql"
```

Migration apply order:

```text
035_production_order_workflow_foundation.sql
036_production_issue_and_receipt_documents.sql
037_production_order_planning_release_rpcs.sql
038_production_order_transaction_rpcs.sql
039_production_relationship_map_and_reporting.sql
040_sales_finance_transaction_engine.sql
```

Execution notes:

- Apply one file at a time with `-v ON_ERROR_STOP=1`.
- Estimated cumulative execution time from local rehearsal: about 3.0-3.5 seconds of SQL runtime, excluding backup and validation.
- Lock profile:
  - `035`, `036`, `039`: low to medium; additive tables, indexes, views, and seeds.
  - `037`, `038`, `040`: medium to high; RPC creation is light, but new transactional paths lock order, stock balance, customer, invoice, and number-series rows at runtime.

VPS apply commands:

```bash
for migration in \
  035_production_order_workflow_foundation.sql \
  036_production_issue_and_receipt_documents.sql \
  037_production_order_planning_release_rpcs.sql \
  038_production_order_transaction_rpcs.sql \
  039_production_relationship_map_and_reporting.sql \
  040_sales_finance_transaction_engine.sql
do
  docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
    -f "/root/migrations/${migration}"
done
```

Required posting-role mappings before live sales posting:

- `ACCOUNTS_RECEIVABLE` -> account `1100`
- `SALES_REVENUE` -> account `4000`
- `VAT_OUTPUT` -> account `2100`
- `COST_OF_GOODS_SOLD` -> account `5000`
- `FINISHED_GOODS_INVENTORY` -> account `1200`
- `CASH_ON_HAND` -> account `1010`
- `BANK_ACCOUNT` -> account `1000`

Required payment-method review before live sales posting:

- Cash must resolve through `settings_payment_methods.gl_account_id` to the cash account.
- Bank transfer / POS-card methods must resolve to the bank account.
- Mobile money methods such as EcoCash, OneMoney, and Mukuru must remain blocked until a specific GL account mapping is configured.
- Do not silently route mobile money to cash or bank defaults.

Schema cache reload and service refresh:

```sql
notify pgrst, 'reload schema';
notify pgrst, 'reload config';
```

```bash
docker compose -f /root/supabase/docker/docker-compose.yml restart rest kong
```

Build and application rollout commands:

```bash
npm ci
npm run build
SALES_TRANSACTION_ENGINE_REQUIRED=true pm2 restart icecream-erp
```

Smoke-test sequence after deployment:

1. Confirm production RPCs exist and `SECURITY DEFINER` functions keep `search_path=icecream_erp, pg_temp`.
2. Confirm sales RPCs exist and `PUBLIC` execution remains revoked.
3. Verify posting-role mappings and payment-method mappings for the target organization.
4. Post one controlled production-order cycle in staging or an approved org.
5. Post one cash invoice, one credit invoice, and one split payment in staging or an approved org.
6. Confirm balanced journals, stock value movement, customer balance updates, and relationship rows.
7. Confirm dashboard/API routes requiring the sales transaction engine succeed with `SALES_TRANSACTION_ENGINE_REQUIRED=true`.

Validation query set:

```sql
select proname, prosecdef, proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'icecream_erp'
  and proname in (
    'save_planned_production_order',
    'release_production_order',
    'post_production_issue',
    'reverse_production_issue',
    'post_production_receipt',
    'reverse_production_receipt',
    'close_production_order',
    'post_sales_invoice_transaction',
    'post_sales_payment_transaction',
    'sales_assert_open_period',
    'sales_resolve_posting_account_id',
    'sales_next_document_number'
  )
order by proname;

select posting_role, document_type, payment_method_code, account_id
from icecream_erp.sales_posting_account_mappings
order by document_type, posting_role, payment_method_code nulls first;

select code, payment_type, gl_account_id, posting_role, requires_reference, is_active
from icecream_erp.settings_payment_methods
order by code;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'icecream_erp'
  and tablename in (
    'production_orders',
    'production_order_components',
    'production_order_status_history',
    'production_issues',
    'production_issue_lines',
    'production_receipts',
    'production_receipt_lines',
    'production_document_links',
    'sales_posting_account_mappings',
    'sales_payment_tenders',
    'sales_payment_allocations',
    'sales_document_relationships',
    'payments',
    'fiscal_periods',
    'settings_payment_methods'
  )
order by tablename, policyname;
```

Rollback decision points:

1. Before any app deployment:
   restore the schema/app to the pre-window backup if a migration fails.
2. After schema deploy but before live production/sales postings:
   roll back application code first, leave additive DB objects in place, and decide whether a corrective forward migration is needed.
3. After live production or sales postings exist:
   do not drop new transaction tables, tenders, allocations, relationships, journals, or stock movements.
   Revert application code, disable new posting entry points, preserve data, and ship a corrective migration for any DB defect.

Post-deployment checks:

```sql
select tablename from pg_tables where schemaname = 'icecream_erp' and tablename like 'production_order%';
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'icecream_erp' and proname in ('save_planned_production_order', 'release_production_order', 'post_production_issue', 'post_production_receipt', 'close_production_order');
select code from icecream_erp.permissions where code like 'production\_%' escape '\';
select posting_role, count(*) from icecream_erp.sales_posting_account_mappings group by posting_role order by posting_role;
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'icecream_erp' and proname in ('post_sales_invoice_transaction', 'post_sales_payment_transaction');
```

No migration in this package changes global PostgreSQL roles, global `search_path`, shared PostgREST schema configuration, `public`, `auth`, or any other project schema.
