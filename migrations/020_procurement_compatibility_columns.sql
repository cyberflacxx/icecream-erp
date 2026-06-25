alter table if exists icecream_erp.purchase_requisitions
  add column if not exists requisition_number text,
  add column if not exists request_date date,
  add column if not exists needed_by_date date,
  add column if not exists approval_status text,
  add column if not exists remarks text,
  add column if not exists deleted_at timestamptz null;

update icecream_erp.purchase_requisitions
set
  requisition_number = coalesce(requisition_number, pr_number),
  request_date = coalesce(request_date, created_at::date, current_date),
  needed_by_date = coalesce(needed_by_date, required_date),
  approval_status = coalesce(approval_status, status::text),
  remarks = coalesce(remarks, notes)
where
  requisition_number is null
  or request_date is null
  or needed_by_date is null
  or approval_status is null
  or remarks is null;

create unique index if not exists idx_purchase_requisitions_requisition_number
  on icecream_erp.purchase_requisitions (organization_id, requisition_number)
  where requisition_number is not null;

alter table if exists icecream_erp.purchase_requisition_items
  add column if not exists requisition_id uuid,
  add column if not exists unit_of_measure_id uuid,
  add column if not exists quantity_requested numeric(18,3),
  add column if not exists quantity_approved numeric(18,3),
  add column if not exists estimated_unit_cost numeric(18,2),
  add column if not exists remarks text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update icecream_erp.purchase_requisition_items
set
  requisition_id = coalesce(requisition_id, pr_id),
  quantity_requested = coalesce(quantity_requested, quantity),
  estimated_unit_cost = coalesce(estimated_unit_cost, estimated_cost),
  remarks = coalesce(remarks, notes)
where
  requisition_id is null
  or quantity_requested is null
  or estimated_unit_cost is null
  or remarks is null;

create index if not exists idx_purchase_requisition_items_requisition_id
  on icecream_erp.purchase_requisition_items (requisition_id);

alter table if exists icecream_erp.purchase_orders
  add column if not exists requisition_id uuid,
  add column if not exists expected_delivery_date date,
  add column if not exists discount_amount numeric(18,2) not null default 0,
  add column if not exists total numeric(18,2),
  add column if not exists deleted_at timestamptz null;

update icecream_erp.purchase_orders
set
  requisition_id = coalesce(requisition_id, pr_id),
  expected_delivery_date = coalesce(expected_delivery_date, expected_date),
  total = coalesce(total, total_amount)
where
  requisition_id is null
  or expected_delivery_date is null
  or total is null;

create index if not exists idx_purchase_orders_requisition_id
  on icecream_erp.purchase_orders (requisition_id);

alter table if exists icecream_erp.purchase_order_items
  add column if not exists purchase_order_id uuid,
  add column if not exists unit_of_measure_id uuid,
  add column if not exists quantity_ordered numeric(18,3),
  add column if not exists quantity_received numeric(18,3) not null default 0,
  add column if not exists unit_cost numeric(18,2),
  add column if not exists total_cost numeric(18,2),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update icecream_erp.purchase_order_items
set
  purchase_order_id = coalesce(purchase_order_id, po_id),
  quantity_ordered = coalesce(quantity_ordered, quantity),
  quantity_received = coalesce(quantity_received, received_qty),
  unit_cost = coalesce(unit_cost, unit_price),
  total_cost = coalesce(total_cost, line_total)
where
  purchase_order_id is null
  or quantity_ordered is null
  or unit_cost is null
  or total_cost is null;

create index if not exists idx_purchase_order_items_purchase_order_id
  on icecream_erp.purchase_order_items (purchase_order_id);

alter table if exists icecream_erp.goods_received_notes
  add column if not exists purchase_order_id uuid,
  add column if not exists quality_status text not null default 'pending',
  add column if not exists quality_notes text,
  add column if not exists deleted_at timestamptz null;

update icecream_erp.goods_received_notes
set purchase_order_id = coalesce(purchase_order_id, po_id)
where purchase_order_id is null;

create index if not exists idx_goods_received_notes_purchase_order_id
  on icecream_erp.goods_received_notes (purchase_order_id);

create table if not exists icecream_erp.goods_received_note_items (
  id uuid primary key default gen_random_uuid(),
  grn_id uuid not null references icecream_erp.goods_received_notes (id) on delete cascade,
  goods_received_note_id uuid null references icecream_erp.goods_received_notes (id) on delete cascade,
  item_id uuid not null references icecream_erp.items (id),
  po_item_id uuid null references icecream_erp.purchase_order_items (id),
  purchase_order_item_id uuid null references icecream_erp.purchase_order_items (id),
  quantity_expected numeric(18,3) not null default 0,
  quantity_received numeric(18,3) not null default 0,
  quantity_rejected numeric(18,3) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  batch_number text null,
  expiry_date date null,
  quality_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into icecream_erp.goods_received_note_items (
  grn_id,
  goods_received_note_id,
  item_id,
  po_item_id,
  purchase_order_item_id,
  quantity_expected,
  quantity_received,
  quantity_rejected,
  unit_cost,
  batch_number,
  expiry_date
)
select
  gi.grn_id,
  gi.grn_id,
  gi.item_id,
  gi.po_item_id,
  gi.po_item_id,
  coalesce(gi.ordered_qty, 0),
  coalesce(gi.received_qty, 0),
  coalesce(gi.rejected_qty, 0),
  coalesce(gi.unit_cost, 0),
  gi.batch_number,
  gi.expiry_date
from icecream_erp.grn_items gi
where not exists (
  select 1
  from icecream_erp.goods_received_note_items existing
  where existing.grn_id = gi.grn_id
    and existing.item_id = gi.item_id
    and coalesce(existing.po_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(gi.po_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create index if not exists idx_goods_received_note_items_grn_id
  on icecream_erp.goods_received_note_items (grn_id);
create index if not exists idx_goods_received_note_items_po_item_id
  on icecream_erp.goods_received_note_items (po_item_id);
create index if not exists idx_goods_received_note_items_item_id
  on icecream_erp.goods_received_note_items (item_id);

grant select, insert, update, delete on
  icecream_erp.purchase_requisitions,
  icecream_erp.purchase_requisition_items,
  icecream_erp.purchase_orders,
  icecream_erp.purchase_order_items,
  icecream_erp.goods_received_notes,
  icecream_erp.goods_received_note_items
to anon, authenticated, service_role;

notify pgrst, 'reload schema';
