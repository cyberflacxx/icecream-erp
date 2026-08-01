-- Manual rollback for 044_atomic_inventory_posting_and_stock_ledger.sql
-- Destructive. Review carefully before execution.

begin;

revoke all on function icecream_erp.receive_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, jsonb, text) from service_role;
revoke all on function icecream_erp.dispatch_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text) from service_role;
revoke all on function icecream_erp.post_inventory_write_off_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) from service_role;
revoke all on function icecream_erp.post_inventory_stock_take_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text) from service_role;
revoke all on function icecream_erp.post_inventory_adjustment_atomic(uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, date, jsonb, text) from service_role;
revoke all on function icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text) from service_role;
revoke all on function icecream_erp.inventory_create_posted_journal(uuid, uuid, uuid, text, date, text, text, uuid, text, jsonb) from service_role;
revoke all on function icecream_erp.inventory_advisory_lock(text) from service_role;
revoke all on function icecream_erp.inventory_next_document_number(text) from service_role;

drop function if exists icecream_erp.receive_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, jsonb, text);
drop function if exists icecream_erp.dispatch_stock_transfer_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text);
drop function if exists icecream_erp.post_inventory_write_off_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text);
drop function if exists icecream_erp.post_inventory_stock_take_atomic(uuid, uuid, uuid, uuid, text, date, jsonb, text);
drop function if exists icecream_erp.post_inventory_adjustment_atomic(uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, date, jsonb, text);
drop function if exists icecream_erp.post_goods_received_note_atomic(uuid, uuid, uuid, uuid, text, date, text, jsonb, text);
drop function if exists icecream_erp.inventory_create_posted_journal(uuid, uuid, uuid, text, date, text, text, uuid, text, jsonb);
drop function if exists icecream_erp.inventory_advisory_lock(text);
drop function if exists icecream_erp.inventory_next_document_number(text);

drop table if exists icecream_erp.inventory_document_relationships;
drop table if exists icecream_erp.inventory_posting_runs;

drop index if exists icecream_erp.idx_goods_received_notes_idempotency;
drop index if exists icecream_erp.idx_stock_adjustments_idempotency;
drop index if exists icecream_erp.idx_inventory_stock_takes_branch_status;
drop index if exists icecream_erp.idx_inventory_stock_takes_idempotency;
drop index if exists icecream_erp.idx_inventory_stock_takes_document_number;
drop index if exists icecream_erp.idx_stock_movements_reversal_of;
drop index if exists icecream_erp.idx_stock_movements_journal_entry;
drop index if exists icecream_erp.idx_stock_movements_ledger_filters;
drop index if exists icecream_erp.idx_stock_movements_posting_date;

alter table if exists icecream_erp.stock_transfers
  drop column if exists reversed_by,
  drop column if exists reversed_at,
  drop column if exists reversal_reason,
  drop column if exists receipt_journal_entry_id,
  drop column if exists dispatch_journal_entry_id,
  drop column if exists received_by,
  drop column if exists received_at,
  drop column if exists dispatched_by,
  drop column if exists dispatched_at;

alter table if exists icecream_erp.goods_received_notes
  drop column if exists journal_entry_id,
  drop column if exists idempotency_key;

alter table if exists icecream_erp.stock_adjustments
  drop column if exists journal_entry_id,
  drop column if exists reversal_reason,
  drop column if exists reversed_by,
  drop column if exists reversed_at,
  drop column if exists posted_by,
  drop column if exists posted_at,
  drop column if exists idempotency_key;

alter table if exists icecream_erp.inventory_stock_take_items
  drop column if exists posted_movement_id,
  drop column if exists expiry_date,
  drop column if exists batch_id,
  drop column if exists reason,
  drop column if exists variance_value,
  drop column if exists unit_cost;

alter table if exists icecream_erp.inventory_stock_takes
  drop column if exists idempotency_key,
  drop column if exists reversal_reason,
  drop column if exists reversed_at,
  drop column if exists reversed_by,
  drop column if exists posted_at,
  drop column if exists posted_by,
  drop column if exists approved_at,
  drop column if exists approved_by,
  drop column if exists submitted_at,
  drop column if exists submitted_by,
  drop column if exists created_by,
  drop column if exists notes,
  drop column if exists count_date,
  drop column if exists document_number,
  drop column if exists branch_id,
  drop column if exists organization_id;

alter table if exists icecream_erp.stock_movements
  drop column if exists reversal_reference,
  drop column if exists reversal_of_movement_id,
  drop column if exists running_value,
  drop column if exists destination_branch_id,
  drop column if exists source_branch_id,
  drop column if exists branch_id,
  drop column if exists journal_entry_id,
  drop column if exists posting_status,
  drop column if exists posting_date,
  drop column if exists source_document_number,
  drop column if exists movement_number,
  drop column if exists total_value;

alter table if exists icecream_erp.stock_balances
  drop column if exists total_value,
  drop column if exists average_cost;

commit;
