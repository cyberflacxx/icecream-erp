-- Fix stock transfer compatibility semantics so dispatch does not imply receipt.
-- Scoped to icecream_erp only.

create or replace function icecream_erp.sync_stock_transfer_items_compat()
returns trigger
language plpgsql
as $$
begin
  if new.quantity_requested is null then
    new.quantity_requested := coalesce(new.quantity, new.quantity_sent, new.quantity_received, 0);
  end if;

  if new.quantity_sent is null then
    new.quantity_sent := 0;
  end if;

  if new.quantity_received is null then
    new.quantity_received := 0;
  end if;

  if new.quantity is null then
    new.quantity := coalesce(new.quantity_requested, 0);
  end if;

  if new.notes is null then
    new.notes := new.remarks;
  end if;

  if new.remarks is null then
    new.remarks := new.notes;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
