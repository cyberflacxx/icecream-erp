alter table if exists icecream_erp.purchase_requisitions
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null;

alter table if exists icecream_erp.purchase_orders
  add column if not exists requisition_id uuid null,
  add column if not exists supplier_quote text null,
  add column if not exists currency text null default 'USD',
  add column if not exists delivery_address text null,
  add column if not exists payment_terms text null,
  add column if not exists delivery_terms text null,
  add column if not exists prepared_for text null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null;

alter table if exists icecream_erp.purchase_order_items
  add column if not exists item_id uuid null,
  add column if not exists quantity numeric(14,3) null,
  add column if not exists tax_rate numeric(14,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists total_ex_vat numeric(14,2) not null default 0;

update icecream_erp.purchase_order_items
set
  quantity = coalesce(quantity, quantity_ordered),
  tax_amount = coalesce(tax_amount, 0),
  total_ex_vat = coalesce(total_ex_vat, line_total, total_cost, 0)
where
  quantity is null
  or tax_amount is null
  or total_ex_vat is null;

alter table if exists icecream_erp.goods_received_notes
  add column if not exists inventory_value_posted numeric(14,2) not null default 0;

alter table if exists icecream_erp.goods_received_note_items
  add column if not exists purchase_order_item_id uuid null;

update icecream_erp.goods_received_note_items
set
  purchase_order_item_id = coalesce(purchase_order_item_id, po_item_id)
where
  purchase_order_item_id is null
  and po_item_id is not null;

alter table if exists icecream_erp.stock_movements
  add column if not exists total_value numeric(18,2) not null default 0,
  add column if not exists source_document_type text null,
  add column if not exists source_document_id uuid null,
  add column if not exists reference_number text null;

update icecream_erp.stock_movements
set
  total_value = coalesce(total_value, total_cost, 0),
  source_document_type = coalesce(source_document_type, reference_type),
  source_document_id = coalesce(source_document_id, reference_id)
where
  total_value is null
  or source_document_type is null
  or source_document_id is null;

alter table if exists icecream_erp.stock_balances
  add column if not exists average_cost numeric(15,4) not null default 0,
  add column if not exists total_value numeric(18,2) not null default 0;

update icecream_erp.stock_balances
set
  average_cost = coalesce(average_cost, avg_cost, 0),
  total_value = coalesce(total_value, quantity_on_hand * coalesce(avg_cost, average_cost, 0), 0)
where
  average_cost is null
  or total_value is null;

alter table if exists icecream_erp.supplier_invoices
  add column if not exists supplier_id uuid null,
  add column if not exists invoice_total numeric(14,2) not null default 0;

alter table if exists icecream_erp.supplier_payments
  add column if not exists supplier_id uuid null,
  add column if not exists amount numeric(14,2) null;

update icecream_erp.supplier_payments
set amount = coalesce(amount, amount_paid, 0)
where amount is null;

create index if not exists idx_purchase_orders_requisition_id
  on icecream_erp.purchase_orders (requisition_id);

create index if not exists idx_goods_received_notes_stock_posted
  on icecream_erp.goods_received_notes (organization_id, stock_posted);

create index if not exists idx_stock_movements_source_document
  on icecream_erp.stock_movements (source_document_type, source_document_id);

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
