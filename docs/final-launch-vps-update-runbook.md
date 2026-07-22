## Final Launch VPS Update Runbook

Scope: Absolute Ice Cream ERP only. All database work must stay inside `icecream_erp`.

### 1. SSH into the VPS

```bash
ssh root@178.238.227.229
```

### 2. Confirm the repo path

```bash
ls /root
ls /root/icecream-erp
```

If `/root/icecream-erp` is not the app repo, locate the correct checkout before continuing.

### 3. Check repo state

```bash
cd /root/icecream-erp
git status -sb
git fetch origin master
git pull --ff-only origin master
```

### 4. Back up only the `icecream_erp` schema

```bash
mkdir -p ~/icecream-erp-db-backups

docker exec supabase-db pg_dump -U supabase_admin -d postgres -n icecream_erp \
  > ~/icecream-erp-db-backups/icecream_erp_before_final_launch_$(date +%Y%m%d_%H%M%S).sql
```

### 5. Apply the additive launch compatibility migration

```bash
docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  < migrations/033_final_procurement_stock_and_po_template_compatibility.sql
```

If `033` has already been applied, do not reapply it. If only `032` exists on the target host and has not been applied yet, apply `032` once and then stop.

### 6. Reload PostgREST safely

```bash
docker exec -i supabase-db psql -U supabase_admin -d postgres <<'SQL'
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
SQL
```

### 7. Verify required procurement columns

```bash
docker exec supabase-db psql -U supabase_admin -d postgres -P pager=off -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema='icecream_erp'
  AND table_name='purchase_requisitions'
  AND column_name IN (
    'approval_notes','approver_id','approver_name','approver_email',
    'approval_status','approved_by','approved_at'
  )
ORDER BY column_name;
"

docker exec supabase-db psql -U supabase_admin -d postgres -P pager=off -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema='icecream_erp'
  AND table_name='purchase_orders'
  AND column_name IN (
    'requisition_id','supplier_quote','currency','delivery_address',
    'payment_terms','delivery_terms','prepared_for'
  )
ORDER BY column_name;
"

docker exec supabase-db psql -U supabase_admin -d postgres -P pager=off -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema='icecream_erp'
  AND table_name='purchase_order_items'
  AND column_name IN (
    'requisition_item_id','item_id','unit_of_measure_id','description',
    'quantity','unit_price','tax_rate','tax_amount','line_total','total_ex_vat'
  )
ORDER BY column_name;
"
```

### 8. Verify GRN, stock, supplier invoice, supplier payment, and petty cash compatibility columns

```bash
docker exec supabase-db psql -U supabase_admin -d postgres -P pager=off -c "
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema='icecream_erp'
  AND (
    (table_name='goods_received_notes' AND column_name IN (
      'purchase_order_id','supplier_invoice_id','receiving_warehouse_id',
      'approved_by','approved_at','approval_notes','posted_at',
      'posted_by','stock_posted','inventory_value_posted'
    ))
    OR
    (table_name='goods_received_note_items' AND column_name IN (
      'purchase_order_item_id','item_id','unit_of_measure_id','quantity_ordered',
      'quantity_received','unit_cost','line_total','warehouse_id'
    ))
    OR
    (table_name='stock_balances' AND column_name IN (
      'item_id','warehouse_id','quantity_on_hand','quantity_available',
      'average_cost','total_value','updated_at'
    ))
    OR
    (table_name='stock_movements' AND column_name IN (
      'item_id','warehouse_id','quantity','unit_cost','total_value',
      'movement_type','source_document_type','source_document_id',
      'reference_number','created_by','created_at'
    ))
    OR
    (table_name='supplier_invoices' AND column_name IN (
      'purchase_order_id','grn_id','goods_received_note_id',
      'supplier_id','invoice_total','outstanding_amount'
    ))
    OR
    (table_name='supplier_payments' AND column_name IN (
      'supplier_invoice_id','purchase_order_id','grn_id','goods_received_note_id',
      'payment_source_type','bank_account_id','cash_account_id',
      'petty_cash_request_id','supplier_id','amount','payment_date'
    ))
    OR
    (table_name='petty_cash_requests' AND column_name IN (
      'amount_requested','amount_approved','amount_paid'
    ))
  )
ORDER BY table_name, column_name;
"
```

### 9. Confirm counts and key workflow tables still exist only in `icecream_erp`

```bash
docker exec supabase-db psql -U supabase_admin -d postgres -P pager=off -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema='icecream_erp'
  AND table_name IN (
    'purchase_requisitions','purchase_requisition_items',
    'purchase_orders','purchase_order_items',
    'goods_received_notes','goods_received_note_items',
    'supplier_invoices','supplier_invoice_items',
    'supplier_payments','stock_balances','stock_movements'
  )
ORDER BY table_name;
"
```

### 10. Safe live verification checklist

1. Open requisitions and confirm no `approval_notes` schema-cache error.
2. Create or load an approved or submitted requisition and confirm it appears in the PO picker.
3. Confirm PO lines inherit item, UOM, description, and price.
4. Export the PO PDF and verify the title, metadata block, buyer/supplier boxes, item table, terms, totals, authorization, and footer.
5. Confirm GRN lines inherit PO item cost instead of `0`.
6. Approve or post a GRN once only and confirm inventory quantity and value change without duplicate posting.
7. Create a supplier invoice linked to PO and GRN.
8. Create a supplier payment with a valid bank, cash, or petty cash source.

### 11. Inspect the live `grn_status` enum when GRN posting fails

```bash
docker exec supabase-db psql -U supabase_admin -d postgres -P pager=off -c "
SELECT e.enumlabel AS value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'icecream_erp'
  AND t.typname = 'grn_status'
ORDER BY e.enumsortorder;
"
```

### 12. Do not do any of the following

- Do not touch `public`, `auth`, `storage`, `graphql_public`, or other project schemas.
- Do not run `docker compose down -v`.
- Do not run bare `ALTER ROLE authenticator SET pgrst.db_schemas`.
- Do not truncate `auth.users`.
