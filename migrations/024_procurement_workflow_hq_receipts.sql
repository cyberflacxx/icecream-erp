alter table if exists icecream_erp.suppliers
  add column if not exists document_name text null,
  add column if not exists document_url text null;

alter table if exists icecream_erp.purchase_requisitions
  add column if not exists approver_user_id uuid null references icecream_erp.users (id),
  add column if not exists approved_by uuid null references icecream_erp.users (id),
  add column if not exists approved_at timestamptz null,
  add column if not exists rejected_by uuid null references icecream_erp.users (id),
  add column if not exists rejected_at timestamptz null;

create index if not exists idx_purchase_requisitions_approver_user_id
  on icecream_erp.purchase_requisitions (approver_user_id);

alter table if exists icecream_erp.purchase_orders
  add column if not exists approver_user_id uuid null references icecream_erp.users (id),
  add column if not exists approved_by uuid null references icecream_erp.users (id),
  add column if not exists approved_at timestamptz null,
  add column if not exists rejected_by uuid null references icecream_erp.users (id),
  add column if not exists rejected_at timestamptz null,
  add column if not exists sent_at timestamptz null;

create index if not exists idx_purchase_orders_approver_user_id
  on icecream_erp.purchase_orders (approver_user_id);

alter table if exists icecream_erp.goods_received_notes
  add column if not exists supplier_id uuid null references icecream_erp.suppliers (id),
  add column if not exists entry_mode text not null default 'po_linked';

update icecream_erp.goods_received_notes
set
  supplier_id = coalesce(
    supplier_id,
    (
      select po.supplier_id
      from icecream_erp.purchase_orders po
      where po.id = goods_received_notes.purchase_order_id
      limit 1
    )
  ),
  entry_mode = case
    when coalesce(purchase_order_id, po_id) is null then 'manual'
    else 'po_linked'
  end
where
  supplier_id is null
  or entry_mode is null
  or entry_mode = '';

create index if not exists idx_goods_received_notes_supplier_id
  on icecream_erp.goods_received_notes (supplier_id);

create index if not exists idx_goods_received_notes_entry_mode
  on icecream_erp.goods_received_notes (organization_id, entry_mode);

notify pgrst, 'reload schema';
