alter table if exists icecream_erp.invoices
  add column if not exists warehouse_id uuid null,
  add column if not exists sales_order_id uuid null;

create index if not exists idx_invoices_warehouse
  on icecream_erp.invoices (warehouse_id);

create index if not exists idx_invoices_sales_order
  on icecream_erp.invoices (sales_order_id);
