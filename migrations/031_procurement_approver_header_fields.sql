alter table if exists icecream_erp.purchase_requisitions
  add column if not exists approver_name text,
  add column if not exists approver_email text,
  add column if not exists approval_notes text;

alter table if exists icecream_erp.purchase_orders
  add column if not exists approver_name text,
  add column if not exists approver_email text,
  add column if not exists approval_notes text;
