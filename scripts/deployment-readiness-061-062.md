# Deployment Readiness 061-062

Do not run these commands without an approved maintenance window, a fresh backup, and an authenticated operator. Do not restart shared Supabase.

## 1. Backup Production DB

```bash
mkdir -p /root/backups/icecream_erp
pg_dump "$DATABASE_URL" --schema=icecream_erp --format=custom --file="/root/backups/icecream_erp/icecream_erp_$(date +%Y%m%d_%H%M%S).dump"
ls -lh /root/backups/icecream_erp/
```

## 2. Run Preflight 061

```bash
cd /root/icecream-erp
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/preflight-061.sql | tee /root/backups/icecream_erp/preflight-061-$(date +%Y%m%d_%H%M%S).log
```

## 3. Review 061 Result

Confirm:
- `item_uom_conversions` dependencies exist.
- Existing UOM columns and table names match the migration.
- No duplicate active item conversion conflicts.
- No unexpected missing tables in the ERP schema.

## 4. Apply 061

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/061_item_uom_conversions_and_bom_versioning.sql
```

## 5. Verify Schema After 061

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
select table_name, column_name
from information_schema.columns
where table_schema = 'icecream_erp'
  and table_name in ('item_uom_conversions','purchase_order_items','goods_received_note_items','stock_movements','production_issue_lines')
  and column_name in ('transaction_quantity','transaction_uom_id','base_quantity','base_uom_id','uom_conversion_factor','conversion_factor')
order by table_name, column_name;"
```

## 6. Run Preflight 062

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/preflight-062.sql | tee /root/backups/icecream_erp/preflight-062-$(date +%Y%m%d_%H%M%S).log
```

## 7. Review 062 Result

Confirm:
- Existing `post_production_issue` signature matches the migration signature.
- `items.unit_of_measure_id` exists.
- 061 transaction/base UOM columns exist on `stock_movements` and `production_issue_lines`.
- `item_uom_conversions` exists.

## 8. Apply 062

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/062_production_uom_rpc_support.sql
```

## 9. Run Build/Deployment

```bash
cd /root/icecream-erp
NEXT_IGNORE_INCORRECT_LOCKFILE=1 npm run build
systemctl restart icecream-erp
systemctl is-active icecream-erp
curl -fsS http://127.0.0.1:3200/api/health
```

## 10. Run Controlled E2E

Use identifiable records with prefixes:
- `E2E-UOM-`
- `E2E-PAY-`
- `E2E-BOM-`
- `E2E-VOID-`

Record every created ID before cleanup.

## 11. Verify Stock

Confirm:
- Purchase/GRN non-base UOM stores base stock quantity.
- Production issue deducts base quantity exactly once.
- Finished goods receipt increases finished goods exactly once.
- No orphan stock movements.

## 12. Verify Journal Entries

Confirm:
- Supplier payments, branch expenses, and reversals are balanced.
- Posted journals are not deleted.
- Reversal journals link to their source document.

## 13. Verify Receipts

Confirm:
- Supplier payment receipt opens and prints.
- Sales receipt/reprint still opens and prints.
- No dashboard chrome appears in print output.

## 14. Verify BOM Versions

Confirm:
- Editing a BOM creates/preserves version history.
- Historical production remains linked to its original BOM data.
- Archived/deactivated BOMs are not selected for new production orders.

## 15. Remove Only E2E Test Records Created During This Test

Allowed cleanup:
- Deactivate unused master data created by this test.
- Void/reverse posted E2E financial records using application workflows.
- Cancel draft-only E2E records when no stock/finance impact exists.

Never:
- Blind `TRUNCATE`.
- Delete real users, roles, branches, warehouses, chart of accounts, stock movements, posted journals, posted invoices, posted dispatches, posted GRNs, or posted production history.
