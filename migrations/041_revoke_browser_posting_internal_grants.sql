-- Remove direct browser-role access from accounting posting internals.
-- Shared VPS safety: all statements are scoped to icecream_erp.

revoke all on table icecream_erp.fiscal_periods
from anon, authenticated;

revoke all on table icecream_erp.journal_entries
from anon, authenticated;

grant all on table icecream_erp.fiscal_periods
to service_role;

grant all on table icecream_erp.journal_entries
to service_role;

notify pgrst, 'reload schema';
