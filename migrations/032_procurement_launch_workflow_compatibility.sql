alter table if exists icecream_erp.purchase_requisitions
  add column if not exists approver_id uuid null,
  add column if not exists approver_name text null,
  add column if not exists approver_email text null,
  add column if not exists approval_notes text null,
  add column if not exists approval_status text default 'PENDING',
  add column if not exists submitted_at timestamptz null,
  add column if not exists last_amended_by uuid null,
  add column if not exists last_amended_at timestamptz null;

update icecream_erp.purchase_requisitions
set
  approver_id = coalesce(approver_id, approver_user_id),
  approval_status = coalesce(nullif(approval_status, ''), status, 'PENDING')
where
  approver_id is null
  or approval_status is null
  or approval_status = '';

alter table if exists icecream_erp.purchase_orders
  add column if not exists approver_id uuid null,
  add column if not exists approver_name text null,
  add column if not exists approver_email text null,
  add column if not exists approval_notes text null,
  add column if not exists approval_status text default 'PENDING',
  add column if not exists last_amended_by uuid null,
  add column if not exists last_amended_at timestamptz null;

update icecream_erp.purchase_orders
set
  approver_id = coalesce(approver_id, approver_user_id),
  approval_status = coalesce(nullif(approval_status, ''), status::text, 'PENDING')
where
  approver_id is null
  or approval_status is null
  or approval_status = '';

alter table if exists icecream_erp.purchase_order_items
  add column if not exists requisition_item_id uuid null,
  add column if not exists unit_of_measure_id uuid null,
  add column if not exists description text null,
  add column if not exists unit_price numeric(14,2) default 0,
  add column if not exists line_total numeric(14,2) default 0;

update icecream_erp.purchase_order_items
set
  unit_price = coalesce(unit_price, unit_cost, 0),
  line_total = coalesce(line_total, total_cost, 0)
where
  unit_price is null
  or line_total is null;

alter table if exists icecream_erp.goods_received_notes
  add column if not exists purchase_order_id uuid null,
  add column if not exists supplier_invoice_id uuid null,
  add column if not exists warehouse_id uuid null,
  add column if not exists receiving_warehouse_id uuid null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists approval_notes text null,
  add column if not exists posted_at timestamptz null,
  add column if not exists posted_by uuid null,
  add column if not exists stock_posted boolean not null default false;

update icecream_erp.goods_received_notes
set
  purchase_order_id = coalesce(purchase_order_id, po_id),
  receiving_warehouse_id = coalesce(receiving_warehouse_id, warehouse_id),
  stock_posted = coalesce(stock_posted, false)
where
  purchase_order_id is null
  or receiving_warehouse_id is null
  or stock_posted is null;

alter table if exists icecream_erp.goods_received_note_items
  add column if not exists item_id uuid null,
  add column if not exists purchase_order_item_id uuid null,
  add column if not exists unit_of_measure_id uuid null,
  add column if not exists quantity_ordered numeric(14,3) default 0,
  add column if not exists quantity_received numeric(14,3) default 0,
  add column if not exists unit_cost numeric(14,2) default 0,
  add column if not exists line_total numeric(14,2) default 0,
  add column if not exists warehouse_id uuid null;

update icecream_erp.goods_received_note_items
set
  purchase_order_item_id = coalesce(purchase_order_item_id, po_item_id),
  quantity_ordered = coalesce(quantity_ordered, quantity_expected, 0),
  line_total = coalesce(line_total, quantity_received * unit_cost, 0)
where
  purchase_order_item_id is null
  or quantity_ordered is null
  or line_total is null;

alter table if exists icecream_erp.supplier_invoices
  add column if not exists purchase_order_id uuid null,
  add column if not exists grn_id uuid null,
  add column if not exists goods_received_note_id uuid null,
  add column if not exists approval_notes text null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists outstanding_amount numeric(14,2) default 0;

update icecream_erp.supplier_invoices
set
  grn_id = coalesce(grn_id, goods_received_note_id),
  outstanding_amount = coalesce(outstanding_amount, invoice_total, 0)
where
  grn_id is null
  or outstanding_amount is null;

alter table if exists icecream_erp.supplier_payments
  add column if not exists supplier_invoice_id uuid null,
  add column if not exists purchase_order_id uuid null,
  add column if not exists grn_id uuid null,
  add column if not exists goods_received_note_id uuid null,
  add column if not exists payment_source_type text null,
  add column if not exists bank_account_id uuid null,
  add column if not exists cash_account_id uuid null,
  add column if not exists petty_cash_request_id uuid null,
  add column if not exists approval_notes text null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null;

update icecream_erp.supplier_payments
set
  grn_id = coalesce(grn_id, goods_received_note_id),
  payment_source_type = coalesce(nullif(payment_source_type, ''), payment_method)
where
  grn_id is null
  or payment_source_type is null
  or payment_source_type = '';

alter table if exists icecream_erp.petty_cash_requests
  add column if not exists amount_requested numeric(14,2) default 0,
  add column if not exists amount_approved numeric(14,2) default 0,
  add column if not exists amount_paid numeric(14,2) default 0;

create index if not exists idx_purchase_requisitions_approver_id
  on icecream_erp.purchase_requisitions (approver_id);

create index if not exists idx_purchase_orders_approver_id
  on icecream_erp.purchase_orders (approver_id);

create index if not exists idx_purchase_order_items_requisition_item_id
  on icecream_erp.purchase_order_items (requisition_item_id);

create index if not exists idx_goods_received_notes_supplier_invoice_id
  on icecream_erp.goods_received_notes (supplier_invoice_id);

create index if not exists idx_goods_received_note_items_purchase_order_item_id
  on icecream_erp.goods_received_note_items (purchase_order_item_id);

create index if not exists idx_supplier_invoices_grn_id
  on icecream_erp.supplier_invoices (grn_id);

create index if not exists idx_supplier_payments_purchase_order_id
  on icecream_erp.supplier_payments (purchase_order_id);

create index if not exists idx_supplier_payments_grn_id
  on icecream_erp.supplier_payments (grn_id);

create index if not exists idx_supplier_payments_payment_source_type
  on icecream_erp.supplier_payments (payment_source_type);

-- PostgREST reload required after applying this additive compatibility migration.
notify pgrst, 'reload schema';
notify pgrst, 'reload config';
