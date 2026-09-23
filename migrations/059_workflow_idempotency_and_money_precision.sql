-- Production-reviewed workflow hardening.
-- Scope: icecream_erp only. Monetary precision changes are explicit and reviewed.

begin;

set search_path = icecream_erp, public;

alter table if exists icecream_erp.purchase_orders
  add column if not exists idempotency_key text;

alter table if exists icecream_erp.supplier_payments
  add column if not exists idempotency_key text;

create unique index if not exists purchase_orders_org_idempotency_key_uq
  on icecream_erp.purchase_orders (organization_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists supplier_payments_org_idempotency_key_uq
  on icecream_erp.supplier_payments (organization_id, idempotency_key)
  where idempotency_key is not null;

comment on column icecream_erp.purchase_orders.idempotency_key is
  'Client/server idempotency key for one logical purchase order create request.';

comment on column icecream_erp.supplier_payments.idempotency_key is
  'Client/server idempotency key for one logical supplier payment post request.';

-- Explicit monetary columns reviewed from the live icecream_erp schema.
-- Excludes quantities, percentages, non-money measurements, counts, ids, and exchange rates.
-- These production reporting views depend on monetary columns altered below.
-- Drop only the reviewed views, without CASCADE, then recreate them after all ALTERs succeed.
drop view if exists icecream_erp.production_order_cost_summary;
drop view if exists icecream_erp.production_order_relationship_map;

alter table if exists icecream_erp.accounts alter column balance type numeric(24,4) using balance::numeric(24,4);
alter table if exists icecream_erp.approval_workflow_steps alter column maximum_amount type numeric(24,4) using maximum_amount::numeric(24,4);
alter table if exists icecream_erp.approval_workflow_steps alter column minimum_amount type numeric(24,4) using minimum_amount::numeric(24,4);
alter table if exists icecream_erp.approval_workflows alter column maximum_amount type numeric(24,4) using maximum_amount::numeric(24,4);
alter table if exists icecream_erp.approval_workflows alter column minimum_amount type numeric(24,4) using minimum_amount::numeric(24,4);
alter table if exists icecream_erp.asset_depreciation alter column accumulated_total type numeric(24,4) using accumulated_total::numeric(24,4);
alter table if exists icecream_erp.asset_depreciation alter column book_value type numeric(24,4) using book_value::numeric(24,4);
alter table if exists icecream_erp.asset_depreciation alter column depreciation_amount type numeric(24,4) using depreciation_amount::numeric(24,4);
alter table if exists icecream_erp.bank_accounts alter column current_balance type numeric(24,4) using current_balance::numeric(24,4);
alter table if exists icecream_erp.bank_accounts alter column opening_balance type numeric(24,4) using opening_balance::numeric(24,4);
alter table if exists icecream_erp.bank_reconciliations alter column closing_balance type numeric(24,4) using closing_balance::numeric(24,4);
alter table if exists icecream_erp.bank_reconciliations alter column opening_balance type numeric(24,4) using opening_balance::numeric(24,4);
alter table if exists icecream_erp.bank_reconciliations alter column outstanding_deposits type numeric(24,4) using outstanding_deposits::numeric(24,4);
alter table if exists icecream_erp.bank_reconciliations alter column outstanding_payments type numeric(24,4) using outstanding_payments::numeric(24,4);
alter table if exists icecream_erp.bank_reconciliations alter column reconciled_balance type numeric(24,4) using reconciled_balance::numeric(24,4);
alter table if exists icecream_erp.bank_reconciliations alter column statement_balance type numeric(24,4) using statement_balance::numeric(24,4);
alter table if exists icecream_erp.bank_transactions alter column amount type numeric(24,4) using amount::numeric(24,4);
alter table if exists icecream_erp.batch_material_usage alter column total_cost type numeric(24,4) using total_cost::numeric(24,4);
alter table if exists icecream_erp.batch_material_usage alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.branch_customers alter column credit_limit type numeric(24,4) using credit_limit::numeric(24,4);
alter table if exists icecream_erp.branch_customers alter column current_balance type numeric(24,4) using current_balance::numeric(24,4);
alter table if exists icecream_erp.branch_expenses alter column amount type numeric(24,4) using amount::numeric(24,4);
alter table if exists icecream_erp.branch_payments alter column amount_paid type numeric(24,4) using amount_paid::numeric(24,4);
alter table if exists icecream_erp.branch_reconciliations alter column cash_total type numeric(24,4) using cash_total::numeric(24,4);
alter table if exists icecream_erp.branch_reconciliations alter column cash_variance type numeric(24,4) using cash_variance::numeric(24,4);
alter table if exists icecream_erp.branch_reconciliations alter column expense_total type numeric(24,4) using expense_total::numeric(24,4);
alter table if exists icecream_erp.branch_reconciliations alter column profitability_amount type numeric(24,4) using profitability_amount::numeric(24,4);
alter table if exists icecream_erp.branch_reconciliations alter column sales_total type numeric(24,4) using sales_total::numeric(24,4);
alter table if exists icecream_erp.branch_reconciliations alter column stock_variance type numeric(24,4) using stock_variance::numeric(24,4);
alter table if exists icecream_erp.branch_sale_items alter column total_price type numeric(24,4) using total_price::numeric(24,4);
alter table if exists icecream_erp.branch_sale_items alter column unit_price type numeric(24,4) using unit_price::numeric(24,4);
alter table if exists icecream_erp.branch_sales alter column discount_amount type numeric(24,4) using discount_amount::numeric(24,4);
alter table if exists icecream_erp.branch_sales alter column tax_amount type numeric(24,4) using tax_amount::numeric(24,4);
alter table if exists icecream_erp.branch_sales alter column total_amount type numeric(24,4) using total_amount::numeric(24,4);
alter table if exists icecream_erp.branch_sales alter column unit_price type numeric(24,4) using unit_price::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column actual_cash type numeric(24,4) using actual_cash::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column cash_counted type numeric(24,4) using cash_counted::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column cash_sales type numeric(24,4) using cash_sales::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column cash_variance type numeric(24,4) using cash_variance::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column closing_balance type numeric(24,4) using closing_balance::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column closing_stock_value type numeric(24,4) using closing_stock_value::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column credit_sales type numeric(24,4) using credit_sales::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column damaged_stock_value type numeric(24,4) using damaged_stock_value::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column expected_cash type numeric(24,4) using expected_cash::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column expenses_total type numeric(24,4) using expenses_total::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column opening_balance type numeric(24,4) using opening_balance::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column opening_cash type numeric(24,4) using opening_cash::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column opening_stock_value type numeric(24,4) using opening_stock_value::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column payments_received type numeric(24,4) using payments_received::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column physical_cash type numeric(24,4) using physical_cash::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column stock_received_value type numeric(24,4) using stock_received_value::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column stock_sold_value type numeric(24,4) using stock_sold_value::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column total_expenses type numeric(24,4) using total_expenses::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column total_sales type numeric(24,4) using total_sales::numeric(24,4);
alter table if exists icecream_erp.branch_shift_closes alter column variance type numeric(24,4) using variance::numeric(24,4);
alter table if exists icecream_erp.branch_shift_targets alter column target_cash_amount type numeric(24,4) using target_cash_amount::numeric(24,4);
alter table if exists icecream_erp.branch_shift_targets alter column target_sales_amount type numeric(24,4) using target_sales_amount::numeric(24,4);
alter table if exists icecream_erp.branch_shift_targets alter column target_stock_value type numeric(24,4) using target_stock_value::numeric(24,4);
alter table if exists icecream_erp.branch_stock_ledger alter column total_cost type numeric(24,4) using total_cost::numeric(24,4);
alter table if exists icecream_erp.branch_stock_ledger alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.budget_lines alter column actual_amount type numeric(24,4) using actual_amount::numeric(24,4);
alter table if exists icecream_erp.budget_lines alter column budgeted_amount type numeric(24,4) using budgeted_amount::numeric(24,4);
alter table if exists icecream_erp.budget_lines alter column variance type numeric(24,4) using variance::numeric(24,4);
alter table if exists icecream_erp.budgets alter column total_actual type numeric(24,4) using total_actual::numeric(24,4);
alter table if exists icecream_erp.budgets alter column total_budget type numeric(24,4) using total_budget::numeric(24,4);
alter table if exists icecream_erp.budgets alter column total_budgeted type numeric(24,4) using total_budgeted::numeric(24,4);
alter table if exists icecream_erp.budgets alter column variance type numeric(24,4) using variance::numeric(24,4);
alter table if exists icecream_erp.cash_accounts alter column current_balance type numeric(24,4) using current_balance::numeric(24,4);
alter table if exists icecream_erp.cash_accounts alter column opening_balance type numeric(24,4) using opening_balance::numeric(24,4);
alter table if exists icecream_erp.cash_transactions alter column amount type numeric(24,4) using amount::numeric(24,4);
alter table if exists icecream_erp.customer_returns alter column total_value type numeric(24,4) using total_value::numeric(24,4);
alter table if exists icecream_erp.customers alter column credit_limit type numeric(24,4) using credit_limit::numeric(24,4);
alter table if exists icecream_erp.customers alter column current_balance type numeric(24,4) using current_balance::numeric(24,4);
alter table if exists icecream_erp.customers alter column outstanding_balance type numeric(24,4) using outstanding_balance::numeric(24,4);
alter table if exists icecream_erp.damaged_goods_records alter column total_value type numeric(24,4) using total_value::numeric(24,4);
alter table if exists icecream_erp.damaged_goods_records alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.employees alter column basic_rate type numeric(24,4) using basic_rate::numeric(24,4);
alter table if exists icecream_erp.employees alter column basic_salary type numeric(24,4) using basic_salary::numeric(24,4);
alter table if exists icecream_erp.employees alter column hourly_rate type numeric(24,4) using hourly_rate::numeric(24,4);
alter table if exists icecream_erp.employees alter column shift_rate type numeric(24,4) using shift_rate::numeric(24,4);
alter table if exists icecream_erp.expired_goods_records alter column total_value type numeric(24,4) using total_value::numeric(24,4);
alter table if exists icecream_erp.expired_goods_records alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.finance_expenses alter column amount type numeric(24,4) using amount::numeric(24,4);
alter table if exists icecream_erp.finance_expenses alter column base_amount type numeric(24,4) using base_amount::numeric(24,4);
alter table if exists icecream_erp.fixed_assets alter column accumulated_depreciation type numeric(24,4) using accumulated_depreciation::numeric(24,4);
alter table if exists icecream_erp.fixed_assets alter column net_book_value type numeric(24,4) using net_book_value::numeric(24,4);
alter table if exists icecream_erp.fixed_assets alter column purchase_cost type numeric(24,4) using purchase_cost::numeric(24,4);
alter table if exists icecream_erp.goods_received_note_items alter column line_total type numeric(24,4) using line_total::numeric(24,4);
alter table if exists icecream_erp.goods_received_note_items alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.goods_received_notes alter column inventory_value_posted type numeric(24,4) using inventory_value_posted::numeric(24,4);
alter table if exists icecream_erp.goods_return_voucher_items alter column line_total type numeric(24,4) using line_total::numeric(24,4);
alter table if exists icecream_erp.goods_return_voucher_items alter column unit_price type numeric(24,4) using unit_price::numeric(24,4);
alter table if exists icecream_erp.goods_return_vouchers alter column total_value type numeric(24,4) using total_value::numeric(24,4);
alter table if exists icecream_erp.grn_items alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.hr_employee_contracts alter column basic_rate type numeric(24,4) using basic_rate::numeric(24,4);
alter table if exists icecream_erp.hr_employee_contracts alter column hourly_rate type numeric(24,4) using hourly_rate::numeric(24,4);
alter table if exists icecream_erp.hr_employee_contracts alter column shift_rate type numeric(24,4) using shift_rate::numeric(24,4);
alter table if exists icecream_erp.hr_labour_cost_allocations alter column labour_cost type numeric(24,4) using labour_cost::numeric(24,4);
alter table if exists icecream_erp.hr_labour_cost_allocations alter column overhead_allocation type numeric(24,4) using overhead_allocation::numeric(24,4);
alter table if exists icecream_erp.hr_labour_cost_allocations alter column rate type numeric(24,4) using rate::numeric(24,4);
alter table if exists icecream_erp.hr_labour_cost_allocations alter column total_cost type numeric(24,4) using total_cost::numeric(24,4);
alter table if exists icecream_erp.hr_payroll_summaries alter column allowances type numeric(24,4) using allowances::numeric(24,4);
alter table if exists icecream_erp.hr_payroll_summaries alter column basic_pay type numeric(24,4) using basic_pay::numeric(24,4);
alter table if exists icecream_erp.hr_payroll_summaries alter column deductions type numeric(24,4) using deductions::numeric(24,4);
alter table if exists icecream_erp.hr_payroll_summaries alter column gross_pay type numeric(24,4) using gross_pay::numeric(24,4);
alter table if exists icecream_erp.hr_payroll_summaries alter column net_pay type numeric(24,4) using net_pay::numeric(24,4);
alter table if exists icecream_erp.hr_payroll_summaries alter column overtime_pay type numeric(24,4) using overtime_pay::numeric(24,4);
alter table if exists icecream_erp.hr_shift_targets alter column target_labour_cost type numeric(24,4) using target_labour_cost::numeric(24,4);
alter table if exists icecream_erp.inventory_batches alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.inventory_stock_take_items alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.inventory_stock_take_items alter column variance_value type numeric(24,4) using variance_value::numeric(24,4);
alter table if exists icecream_erp.invoice_items alter column total_price type numeric(24,4) using total_price::numeric(24,4);
alter table if exists icecream_erp.invoice_items alter column unit_price type numeric(24,4) using unit_price::numeric(24,4);
alter table if exists icecream_erp.invoices alter column amount_paid type numeric(24,4) using amount_paid::numeric(24,4);
alter table if exists icecream_erp.invoices alter column balance_due type numeric(24,4) using balance_due::numeric(24,4);
alter table if exists icecream_erp.invoices alter column base_amount type numeric(24,4) using base_amount::numeric(24,4);
alter table if exists icecream_erp.invoices alter column discount_amount type numeric(24,4) using discount_amount::numeric(24,4);
alter table if exists icecream_erp.invoices alter column paid_amount type numeric(24,4) using paid_amount::numeric(24,4);
alter table if exists icecream_erp.invoices alter column subtotal type numeric(24,4) using subtotal::numeric(24,4);
alter table if exists icecream_erp.invoices alter column tax_amount type numeric(24,4) using tax_amount::numeric(24,4);
alter table if exists icecream_erp.invoices alter column total type numeric(24,4) using total::numeric(24,4);
alter table if exists icecream_erp.invoices alter column total_amount type numeric(24,4) using total_amount::numeric(24,4);
alter table if exists icecream_erp.items alter column selling_price type numeric(24,4) using selling_price::numeric(24,4);
alter table if exists icecream_erp.items alter column standard_cost type numeric(24,4) using standard_cost::numeric(24,4);
alter table if exists icecream_erp.items alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.journal_entries alter column total_credit type numeric(24,4) using total_credit::numeric(24,4);
alter table if exists icecream_erp.journal_entries alter column total_debit type numeric(24,4) using total_debit::numeric(24,4);
alter table if exists icecream_erp.journal_entry_lines alter column credit_amount type numeric(24,4) using credit_amount::numeric(24,4);
alter table if exists icecream_erp.journal_entry_lines alter column debit_amount type numeric(24,4) using debit_amount::numeric(24,4);
alter table if exists icecream_erp.journal_lines alter column credit type numeric(24,4) using credit::numeric(24,4);
alter table if exists icecream_erp.journal_lines alter column debit type numeric(24,4) using debit::numeric(24,4);
alter table if exists icecream_erp.machine_breakdowns alter column estimated_cost type numeric(24,4) using estimated_cost::numeric(24,4);
alter table if exists icecream_erp.machine_profiles alter column last_service_cost type numeric(24,4) using last_service_cost::numeric(24,4);
alter table if exists icecream_erp.machine_profiles alter column purchase_cost type numeric(24,4) using purchase_cost::numeric(24,4);
alter table if exists icecream_erp.machines alter column purchase_cost type numeric(24,4) using purchase_cost::numeric(24,4);
alter table if exists icecream_erp.maintenance_records alter column cost type numeric(24,4) using cost::numeric(24,4);
alter table if exists icecream_erp.opening_account_balances alter column credit_amount type numeric(24,4) using credit_amount::numeric(24,4);
alter table if exists icecream_erp.opening_account_balances alter column debit_amount type numeric(24,4) using debit_amount::numeric(24,4);
alter table if exists icecream_erp.opening_bank_balances alter column opening_balance type numeric(24,4) using opening_balance::numeric(24,4);
alter table if exists icecream_erp.opening_branch_balances alter column opening_expense_balance type numeric(24,4) using opening_expense_balance::numeric(24,4);
alter table if exists icecream_erp.opening_branch_balances alter column opening_sales_balance type numeric(24,4) using opening_sales_balance::numeric(24,4);
alter table if exists icecream_erp.opening_branch_balances alter column opening_stock_value type numeric(24,4) using opening_stock_value::numeric(24,4);
alter table if exists icecream_erp.opening_cash_balances alter column opening_balance type numeric(24,4) using opening_balance::numeric(24,4);
alter table if exists icecream_erp.opening_customer_balances alter column opening_balance type numeric(24,4) using opening_balance::numeric(24,4);
alter table if exists icecream_erp.opening_stock_balances alter column total_value type numeric(24,4) using total_value::numeric(24,4);
alter table if exists icecream_erp.opening_stock_balances alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.opening_supplier_balances alter column opening_balance type numeric(24,4) using opening_balance::numeric(24,4);
alter table if exists icecream_erp.payments alter column amount type numeric(24,4) using amount::numeric(24,4);
alter table if exists icecream_erp.payments alter column base_amount type numeric(24,4) using base_amount::numeric(24,4);
alter table if exists icecream_erp.payroll_records alter column allowances type numeric(24,4) using allowances::numeric(24,4);
alter table if exists icecream_erp.payroll_records alter column basic_salary type numeric(24,4) using basic_salary::numeric(24,4);
alter table if exists icecream_erp.payroll_records alter column deductions type numeric(24,4) using deductions::numeric(24,4);
alter table if exists icecream_erp.payroll_records alter column net_pay type numeric(24,4) using net_pay::numeric(24,4);
alter table if exists icecream_erp.payroll_records alter column overtime_pay type numeric(24,4) using overtime_pay::numeric(24,4);
alter table if exists icecream_erp.payroll_records alter column tax_deduction type numeric(24,4) using tax_deduction::numeric(24,4);
alter table if exists icecream_erp.petty_cash_requests alter column amount type numeric(24,4) using amount::numeric(24,4);
alter table if exists icecream_erp.petty_cash_requests alter column amount_approved type numeric(24,4) using amount_approved::numeric(24,4);
alter table if exists icecream_erp.petty_cash_requests alter column amount_paid type numeric(24,4) using amount_paid::numeric(24,4);
alter table if exists icecream_erp.petty_cash_requests alter column amount_requested type numeric(24,4) using amount_requested::numeric(24,4);
alter table if exists icecream_erp.production_batch_materials alter column total_cost type numeric(24,4) using total_cost::numeric(24,4);
alter table if exists icecream_erp.production_batch_materials alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.production_batches alter column cost_per_unit type numeric(24,4) using cost_per_unit::numeric(24,4);
alter table if exists icecream_erp.production_batches alter column labour_cost type numeric(24,4) using labour_cost::numeric(24,4);
alter table if exists icecream_erp.production_batches alter column material_cost type numeric(24,4) using material_cost::numeric(24,4);
alter table if exists icecream_erp.production_batches alter column overhead_cost type numeric(24,4) using overhead_cost::numeric(24,4);
alter table if exists icecream_erp.production_batches alter column total_labour_cost type numeric(24,4) using total_labour_cost::numeric(24,4);
alter table if exists icecream_erp.production_batches alter column total_material_cost type numeric(24,4) using total_material_cost::numeric(24,4);
alter table if exists icecream_erp.production_batches alter column total_overhead_cost type numeric(24,4) using total_overhead_cost::numeric(24,4);
alter table if exists icecream_erp.production_cost_overrides alter column adjusted_unit_cost type numeric(24,4) using adjusted_unit_cost::numeric(24,4);
alter table if exists icecream_erp.production_cost_overrides alter column previous_unit_cost type numeric(24,4) using previous_unit_cost::numeric(24,4);
alter table if exists icecream_erp.production_issue_lines alter column line_cost type numeric(24,4) using line_cost::numeric(24,4);
alter table if exists icecream_erp.production_issue_lines alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.production_issues alter column total_cost type numeric(24,4) using total_cost::numeric(24,4);
alter table if exists icecream_erp.production_order_components alter column actual_cost type numeric(24,4) using actual_cost::numeric(24,4);
alter table if exists icecream_erp.production_order_components alter column planned_cost type numeric(24,4) using planned_cost::numeric(24,4);
alter table if exists icecream_erp.production_order_components alter column unit_cost_snapshot type numeric(24,4) using unit_cost_snapshot::numeric(24,4);
alter table if exists icecream_erp.production_orders alter column actual_cost type numeric(24,4) using actual_cost::numeric(24,4);
alter table if exists icecream_erp.production_orders alter column cost_per_unit type numeric(24,4) using cost_per_unit::numeric(24,4);
alter table if exists icecream_erp.production_orders alter column planned_cost type numeric(24,4) using planned_cost::numeric(24,4);
alter table if exists icecream_erp.production_receipt_lines alter column total_production_cost type numeric(24,4) using total_production_cost::numeric(24,4);
alter table if exists icecream_erp.production_receipt_lines alter column unit_production_cost type numeric(24,4) using unit_production_cost::numeric(24,4);
alter table if exists icecream_erp.production_receipts alter column total_cost type numeric(24,4) using total_cost::numeric(24,4);
alter table if exists icecream_erp.production_stock_closures alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.production_wastage alter column total_cost type numeric(24,4) using total_cost::numeric(24,4);
alter table if exists icecream_erp.production_wastage alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.purchase_order_items alter column line_total type numeric(24,4) using line_total::numeric(24,4);
alter table if exists icecream_erp.purchase_order_items alter column tax_amount type numeric(24,4) using tax_amount::numeric(24,4);
alter table if exists icecream_erp.purchase_order_items alter column total_cost type numeric(24,4) using total_cost::numeric(24,4);
alter table if exists icecream_erp.purchase_order_items alter column total_ex_vat type numeric(24,4) using total_ex_vat::numeric(24,4);
alter table if exists icecream_erp.purchase_order_items alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.purchase_order_items alter column unit_price type numeric(24,4) using unit_price::numeric(24,4);
alter table if exists icecream_erp.purchase_orders alter column base_amount type numeric(24,4) using base_amount::numeric(24,4);
alter table if exists icecream_erp.purchase_orders alter column discount_amount type numeric(24,4) using discount_amount::numeric(24,4);
alter table if exists icecream_erp.purchase_orders alter column subtotal type numeric(24,4) using subtotal::numeric(24,4);
alter table if exists icecream_erp.purchase_orders alter column tax_amount type numeric(24,4) using tax_amount::numeric(24,4);
alter table if exists icecream_erp.purchase_orders alter column total type numeric(24,4) using total::numeric(24,4);
alter table if exists icecream_erp.purchase_orders alter column total_amount type numeric(24,4) using total_amount::numeric(24,4);
alter table if exists icecream_erp.purchase_requisition_items alter column estimated_cost type numeric(24,4) using estimated_cost::numeric(24,4);
alter table if exists icecream_erp.purchase_requisition_items alter column estimated_unit_cost type numeric(24,4) using estimated_unit_cost::numeric(24,4);
alter table if exists icecream_erp.quotation_items alter column total_price type numeric(24,4) using total_price::numeric(24,4);
alter table if exists icecream_erp.quotation_items alter column unit_price type numeric(24,4) using unit_price::numeric(24,4);
alter table if exists icecream_erp.quotations alter column base_amount type numeric(24,4) using base_amount::numeric(24,4);
alter table if exists icecream_erp.quotations alter column discount_amount type numeric(24,4) using discount_amount::numeric(24,4);
alter table if exists icecream_erp.quotations alter column subtotal type numeric(24,4) using subtotal::numeric(24,4);
alter table if exists icecream_erp.quotations alter column tax_amount type numeric(24,4) using tax_amount::numeric(24,4);
alter table if exists icecream_erp.quotations alter column total type numeric(24,4) using total::numeric(24,4);
alter table if exists icecream_erp.quotations alter column total_amount type numeric(24,4) using total_amount::numeric(24,4);
alter table if exists icecream_erp.sales_credit_notes alter column amount type numeric(24,4) using amount::numeric(24,4);
alter table if exists icecream_erp.sales_journals alter column credit_amount type numeric(24,4) using credit_amount::numeric(24,4);
alter table if exists icecream_erp.sales_journals alter column debit_amount type numeric(24,4) using debit_amount::numeric(24,4);
alter table if exists icecream_erp.sales_order_items alter column cogs type numeric(24,4) using cogs::numeric(24,4);
alter table if exists icecream_erp.sales_order_items alter column line_total type numeric(24,4) using line_total::numeric(24,4);
alter table if exists icecream_erp.sales_order_items alter column unit_price type numeric(24,4) using unit_price::numeric(24,4);
alter table if exists icecream_erp.sales_orders alter column base_amount type numeric(24,4) using base_amount::numeric(24,4);
alter table if exists icecream_erp.sales_orders alter column discount_amount type numeric(24,4) using discount_amount::numeric(24,4);
alter table if exists icecream_erp.sales_orders alter column subtotal type numeric(24,4) using subtotal::numeric(24,4);
alter table if exists icecream_erp.sales_orders alter column tax_amount type numeric(24,4) using tax_amount::numeric(24,4);
alter table if exists icecream_erp.sales_orders alter column total type numeric(24,4) using total::numeric(24,4);
alter table if exists icecream_erp.sales_orders alter column total_amount type numeric(24,4) using total_amount::numeric(24,4);
alter table if exists icecream_erp.sales_payment_allocations alter column allocated_amount type numeric(24,4) using allocated_amount::numeric(24,4);
alter table if exists icecream_erp.sales_payment_tenders alter column amount type numeric(24,4) using amount::numeric(24,4);
alter table if exists icecream_erp.sales_product_prices alter column selling_price type numeric(24,4) using selling_price::numeric(24,4);
alter table if exists icecream_erp.settings_customer_groups alter column credit_limit type numeric(24,4) using credit_limit::numeric(24,4);
alter table if exists icecream_erp.stock_adjustment_items alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.stock_balances alter column average_cost type numeric(24,4) using average_cost::numeric(24,4);
alter table if exists icecream_erp.stock_balances alter column avg_cost type numeric(24,4) using avg_cost::numeric(24,4);
alter table if exists icecream_erp.stock_balances alter column total_value type numeric(24,4) using total_value::numeric(24,4);
alter table if exists icecream_erp.stock_movements alter column running_value type numeric(24,4) using running_value::numeric(24,4);
alter table if exists icecream_erp.stock_movements alter column total_cost type numeric(24,4) using total_cost::numeric(24,4);
alter table if exists icecream_erp.stock_movements alter column total_value type numeric(24,4) using total_value::numeric(24,4);
alter table if exists icecream_erp.stock_movements alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.stock_transfer_items alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.supplier_invoice_items alter column po_unit_cost type numeric(24,4) using po_unit_cost::numeric(24,4);
alter table if exists icecream_erp.supplier_invoice_items alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);
alter table if exists icecream_erp.supplier_invoice_items alter column unit_cost_reference type numeric(24,4) using unit_cost_reference::numeric(24,4);
alter table if exists icecream_erp.supplier_invoices alter column base_amount type numeric(24,4) using base_amount::numeric(24,4);
alter table if exists icecream_erp.supplier_invoices alter column invoice_total type numeric(24,4) using invoice_total::numeric(24,4);
alter table if exists icecream_erp.supplier_invoices alter column outstanding_amount type numeric(24,4) using outstanding_amount::numeric(24,4);
alter table if exists icecream_erp.supplier_invoices alter column subtotal type numeric(24,4) using subtotal::numeric(24,4);
alter table if exists icecream_erp.supplier_invoices alter column tax_amount type numeric(24,4) using tax_amount::numeric(24,4);
alter table if exists icecream_erp.supplier_items alter column last_price type numeric(24,4) using last_price::numeric(24,4);
alter table if exists icecream_erp.supplier_payments alter column amount type numeric(24,4) using amount::numeric(24,4);
alter table if exists icecream_erp.supplier_payments alter column amount_paid type numeric(24,4) using amount_paid::numeric(24,4);
alter table if exists icecream_erp.supplier_payments alter column base_amount type numeric(24,4) using base_amount::numeric(24,4);
alter table if exists icecream_erp.supplier_returns alter column total_value type numeric(24,4) using total_value::numeric(24,4);
alter table if exists icecream_erp.suppliers alter column credit_limit type numeric(24,4) using credit_limit::numeric(24,4);
alter table if exists icecream_erp.suppliers alter column current_balance type numeric(24,4) using current_balance::numeric(24,4);
alter table if exists icecream_erp.wastage_records alter column total_cost type numeric(24,4) using total_cost::numeric(24,4);
alter table if exists icecream_erp.wastage_records alter column unit_cost type numeric(24,4) using unit_cost::numeric(24,4);

create or replace view icecream_erp.production_order_relationship_map as
with normalized_links as (
  select
    l.id as link_id,
    l.organization_id,
    l.production_order_id,
    case
      when l.from_document_type = 'production_order'
        and l.from_document_id = l.production_order_id
        then l.from_document_type
      else l.to_document_type
    end as source_document_type,
    case
      when l.from_document_type = 'production_order'
        and l.from_document_id = l.production_order_id
        then l.from_document_id
      else l.to_document_id
    end as source_document_id,
    case
      when l.from_document_type = 'production_order'
        and l.from_document_id = l.production_order_id
        then l.to_document_type
      else l.from_document_type
    end as related_document_type,
    case
      when l.from_document_type = 'production_order'
        and l.from_document_id = l.production_order_id
        then l.to_document_id
      else l.from_document_id
    end as related_document_id,
    l.relationship_type,
    l.created_by,
    l.created_at,
    row_number() over (
      partition by
        l.organization_id,
        l.production_order_id,
        case
          when l.from_document_type = 'production_order'
            and l.from_document_id = l.production_order_id
            then l.to_document_type
          else l.from_document_type
        end,
        case
          when l.from_document_type = 'production_order'
            and l.from_document_id = l.production_order_id
            then l.to_document_id
          else l.from_document_id
        end
      order by l.created_at desc, l.id desc
    ) as rn
  from icecream_erp.production_document_links l
  where (
    l.from_document_type = 'production_order'
    and l.from_document_id = l.production_order_id
  ) or (
    l.to_document_type = 'production_order'
    and l.to_document_id = l.production_order_id
  )
),
dedup_links as (
  select *
  from normalized_links
  where rn = 1
)
select
  po.organization_id,
  po.id as production_order_id,
  'production_order'::text as document_type,
  po.id as document_id,
  po.production_order_number as document_number,
  po.created_at::date as document_date,
  po.status,
  po.planned_quantity as quantity,
  po.planned_cost as value,
  po.created_by,
  null::uuid as related_document_id,
  null::text as relationship_type,
  0 as sort_order,
  po.status as document_status,
  null::text as posting_status,
  'production_order'::text as source_document_type,
  po.id as source_document_id,
  null::text as related_document_type
from icecream_erp.production_orders po
union all
select
  pi.organization_id,
  dl.production_order_id,
  'production_issue'::text,
  pi.id,
  pi.issue_number,
  pi.issue_date,
  pi.posting_status,
  pi.total_quantity,
  pi.total_cost,
  pi.issued_by,
  dl.related_document_id,
  dl.relationship_type,
  10,
  null::text as document_status,
  pi.posting_status,
  dl.source_document_type,
  dl.source_document_id,
  dl.related_document_type
from dedup_links dl
join icecream_erp.production_issues pi
  on pi.organization_id = dl.organization_id
 and pi.production_order_id = dl.production_order_id
 and pi.id = dl.related_document_id
where dl.related_document_type = 'production_issue'
union all
select
  pr.organization_id,
  dl.production_order_id,
  'production_receipt'::text,
  pr.id,
  pr.receipt_number,
  pr.receipt_date,
  pr.posting_status,
  pr.total_completed_quantity,
  pr.total_cost,
  pr.received_by,
  dl.related_document_id,
  dl.relationship_type,
  20,
  null::text as document_status,
  pr.posting_status,
  dl.source_document_type,
  dl.source_document_id,
  dl.related_document_type
from dedup_links dl
join icecream_erp.production_receipts pr
  on pr.organization_id = dl.organization_id
 and pr.production_order_id = dl.production_order_id
 and pr.id = dl.related_document_id
where dl.related_document_type = 'production_receipt';

create or replace view icecream_erp.production_order_cost_summary as
select
  po.organization_id,
  po.id as production_order_id,
  po.production_order_number,
  po.product_number,
  po.product_description_snapshot,
  po.status,
  po.planned_quantity,
  po.released_quantity,
  po.completed_quantity,
  po.rejected_quantity,
  po.wastage_quantity,
  po.remaining_quantity,
  po.planned_cost,
  coalesce(sum(pil.line_cost) filter (where pi.posting_status = 'POSTED'::text), 0::numeric) as posted_material_cost,
  po.actual_cost,
  po.cost_per_unit,
  po.actual_cost - po.planned_cost as cost_variance
from icecream_erp.production_orders po
left join icecream_erp.production_issues pi on pi.production_order_id = po.id
left join icecream_erp.production_issue_lines pil on pil.production_issue_id = pi.id
group by po.id;

grant select on icecream_erp.production_order_relationship_map to service_role;
grant select on icecream_erp.production_order_cost_summary to service_role;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';

commit;
