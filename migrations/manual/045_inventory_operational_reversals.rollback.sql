-- Manual rollback for 045_inventory_operational_reversals.sql
-- Destructive. Review carefully before execution.

begin;

revoke all on function icecream_erp.reverse_stock_transfer_receipt_atomic(uuid, uuid, uuid, uuid, text, date, text, text) from service_role;
revoke all on function icecream_erp.reverse_stock_transfer_dispatch_atomic(uuid, uuid, uuid, uuid, text, date, text, text) from service_role;
revoke all on function icecream_erp.reverse_inventory_write_off_atomic(uuid, uuid, uuid, uuid, text, date, text, text) from service_role;
revoke all on function icecream_erp.reverse_inventory_adjustment_atomic(uuid, uuid, uuid, uuid, text, date, text, text) from service_role;
revoke all on function icecream_erp.reverse_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, text) from service_role;
revoke all on function icecream_erp.inventory_reverse_posted_journal(uuid, uuid, text, uuid, uuid, uuid, text, date, text) from service_role;
revoke all on function icecream_erp.inventory_assert_open_fiscal_period(uuid, date) from service_role;

drop function if exists icecream_erp.reverse_stock_transfer_receipt_atomic(uuid, uuid, uuid, uuid, text, date, text, text);
drop function if exists icecream_erp.reverse_stock_transfer_dispatch_atomic(uuid, uuid, uuid, uuid, text, date, text, text);
drop function if exists icecream_erp.reverse_inventory_write_off_atomic(uuid, uuid, uuid, uuid, text, date, text, text);
drop function if exists icecream_erp.reverse_inventory_adjustment_atomic(uuid, uuid, uuid, uuid, text, date, text, text);
drop function if exists icecream_erp.reverse_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, text);
drop function if exists icecream_erp.inventory_reverse_posted_journal(uuid, uuid, text, uuid, uuid, uuid, text, date, text);
drop function if exists icecream_erp.inventory_assert_open_fiscal_period(uuid, date);

drop index if exists icecream_erp.idx_inventory_reversal_runs_document_lookup;
drop index if exists icecream_erp.idx_inventory_reversal_runs_idempotency;
drop index if exists icecream_erp.idx_inventory_reversal_runs_operation_document;
drop table if exists icecream_erp.inventory_reversal_runs;

alter table if exists icecream_erp.goods_received_notes
  drop column if exists reversal_reason,
  drop column if exists reversed_by,
  drop column if exists reversed_at;

commit;

-- Note:
-- PostgreSQL enum labels added by 045 are not removed here.
-- Removing enum labels requires manual type rebuild planning and is intentionally excluded.
