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
git pull origin master
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
  < migrations/032_procurement_launch_workflow_compatibility.sql
```

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
    'approval_status','approved_by','approved_at','submitted_at'
  )
ORDER BY column_name;
"

docker exec supabase-db psql -U supabase_admin -d postgres -P pager=off -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema='icecream_erp'
  AND table_name='purchase_orders'
  AND column_name IN (
    'requisition_id','approval_notes','approver_id','approver_name',
    'approver_email','approval_status','approved_by','approved_at'
  )
ORDER BY column_name;
"

docker exec supabase-db psql -U supabase_admin -d postgres -P pager=off -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema='icecream_erp'
  AND table_name='purchase_order_items'
  AND column_name IN (
    'requisition_item_id','unit_of_measure_id','description',
    'unit_price','line_total'
  )
ORDER BY column_name;
"
```

### 8. Verify GRN, supplier invoice, supplier payment, and petty cash compatibility columns

```bash
docker exec supabase-db psql -U supabase_admin -d postgres -P pager=off -c "
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema='icecream_erp'
  AND (
    (table_name='goods_received_notes' AND column_name IN (
      'purchase_order_id','supplier_invoice_id','receiving_warehouse_id',
      'approved_by','approved_at','approval_notes','posted_at',
      'posted_by','stock_posted'
    ))
    OR
    (table_name='goods_received_note_items' AND column_name IN (
      'purchase_order_item_id','unit_of_measure_id','quantity_ordered',
      'quantity_received','unit_cost','line_total','warehouse_id'
    ))
    OR
    (table_name='supplier_invoices' AND column_name IN (
      'purchase_order_id','grn_id','goods_received_note_id',
      'approval_notes','approved_by','approved_at','outstanding_amount'
    ))
    OR
    (table_name='supplier_payments' AND column_name IN (
      'supplier_invoice_id','purchase_order_id','grn_id','goods_received_note_id',
      'payment_source_type','bank_account_id','cash_account_id',
      'petty_cash_request_id','approval_notes','approved_by','approved_at'
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
2. Create or load an approved requisition and confirm it appears in the PO picker.
3. Confirm PO lines inherit item, UOM, and price.
4. Confirm GRN lines inherit PO item cost instead of `0`.
5. Post a GRN once only and confirm inventory quantity changes without duplicate posting.
6. Create a supplier invoice linked to PO and GRN.
7. Create a supplier payment with a valid bank, cash, or petty cash source.

### 11. Do not do any of the following

- Do not touch `public`, `auth`, `storage`, `graphql_public`, or other project schemas.
- Do not run `docker compose down -v`.
- Do not run bare `ALTER ROLE authenticator SET pgrst.db_schemas`.
- Do not truncate `auth.users`.
