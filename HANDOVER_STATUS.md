# Absolute ERP Handover Status

## Production

- Production URL: https://www.absolute-erp.com
- Current commit: verify with `git rev-parse HEAD`; final handover report records the deployed hash.
- `origin/master`: verify with `git rev-parse origin/master`.
- `origin/main`: verify with `git rev-parse origin/main`.
- VPS app path: `/root/icecream-erp`
- VPS commit: verify on server with `cd /root/icecream-erp && git rev-parse HEAD`.
- VPS service: `icecream-erp`
- Vercel project: `cyberflacxx-icecream-erp`
- Vercel production deployment: verify with `npx vercel inspect https://www.absolute-erp.com`.
- Vercel URL: https://www.absolute-erp.com
- ERP schema: `icecream_erp`

## Operating Rules

- Do not restart shared Supabase. Use `NOTIFY pgrst, 'reload schema';` after additive schema changes that need PostgREST cache refresh.
- Branch/default warehouse rule: branch stock and sales use the active branch warehouse assignment. Main Branch currently sells from Dispatch Warehouse.
- Stock deduction rule: physical stock deduction for branch sales is performed by the posted branch sale/dispatch stock movement path. Do not add a second deduction path.
- Cash/bank accounting rule: cash and bank balances are derived from opening balance plus posted cash/bank transactions. Receipts increase balances; payments/expenses decrease balances.
- Journal rule: operational postings must create balanced finance journals and preserve source references. Posted journals, stock movements, payments, dispatches, invoices, and production transactions must not be hard-deleted.
- Receipt/reprint workflow: branch sales open `/sales/payments/receipt?branchSaleId=<sale-id>`. `autoprint=1` triggers browser print. The standalone receipt page also has a visible `Print Receipt` button and remains free of dashboard chrome.
- Invoice print workflow: invoices open `/sales/invoices/<invoice-id>` as a standalone green/white customer document with logo, invoice metadata, line items, payment summary, totals, ERP reference, and `Download/Print`.

## Deployment Commands

- Local checks: `npm run test:branches`, `npm run test:finance`, `npm run test:settings`, `npm run lint`, `npm run build`.
- Push synchronized branches: `git push origin master` and `git push origin master:main`.
- VPS deploy: `cd /root/icecream-erp && git fetch origin && git checkout master && git pull --ff-only origin master && npm run lint && npm run build && systemctl restart icecream-erp`.
- Vercel deploy: `npx vercel deploy --prod --yes`.

## Health Commands

- Production health: `curl https://www.absolute-erp.com/api/health`.
- VPS commit: `cd /root/icecream-erp && git rev-parse HEAD`.
- VPS service: `systemctl status icecream-erp --no-pager -l`.
- VPS logs: `journalctl -u icecream-erp --since "30 minutes ago" --no-pager`.
- Database schema inspection: `docker exec -i supabase-db psql -U supabase_admin -d postgres`.

## Backups

- Pre-branch-expense schema backup location: `/root/migrations/absolute-erp-handover/icecream_erp_schema_before_branch_expenses_.sql`.
- Existing local proof backups are under `backups/`.
- For future production schema changes, take a timestamped `pg_dump --schema-only --schema=icecream_erp` before applying migrations.

## Known Non-Blocking Issues

- Existing lint warnings remain in `src/app/(dashboard)/maintenance/machines/page.tsx` and `src/app/(dashboard)/sales/customers/page.tsx` for `useMemo` dependencies.
- Local Windows `npm run build` has previously timed out in this workspace; VPS and Vercel production builds completed.
- Vercel CLI can surface a PowerShell `NativeCommandError` despite producing a READY deployment JSON and aliasing production; verify by deployment ID and `/api/health`.
