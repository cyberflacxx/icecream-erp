# Absolute ERP Handover Status

## Production

- Production URL: https://www.absolute-erp.com
- Current commit: `e15b0acc000f8db809f90437b7a2786d9f6ffa34`
- `origin/master`: `e15b0acc000f8db809f90437b7a2786d9f6ffa34`
- `origin/main`: `e15b0acc000f8db809f90437b7a2786d9f6ffa34`
- VPS app path: `/root/icecream-erp`
- VPS commit: `e15b0acc000f8db809f90437b7a2786d9f6ffa34`
- VPS service: `icecream-erp`
- Vercel project: `cyberflacxx-icecream-erp`
- Vercel production deployment: `dpl_N5VoVHKsiLW4rwZuDYuJGZVfrJk3`
- Vercel URL: https://cyberflacxx-icecream-q5wz46s3n-cyberflacxxs-projects.vercel.app
- ERP schema: `icecream_erp`

## Operating Rules

- Do not restart shared Supabase. Use `NOTIFY pgrst, 'reload schema';` after additive schema changes that need PostgREST cache refresh.
- Branch/default warehouse rule: branch stock and sales use the active branch warehouse assignment. Main Branch currently sells from Dispatch Warehouse.
- Stock deduction rule: physical stock deduction for branch sales is performed by the posted branch sale/dispatch stock movement path. Do not add a second deduction path.
- Cash/bank accounting rule: cash and bank balances are derived from opening balance plus posted cash/bank transactions. Receipts increase balances; payments/expenses decrease balances.
- Journal rule: operational postings must create balanced finance journals and preserve source references. Posted journals, stock movements, payments, dispatches, invoices, and production transactions must not be hard-deleted.
- Receipt/reprint workflow: branch sales open `/sales/payments/receipt?branchSaleId=<sale-id>`. `autoprint=1` triggers browser print. Branch Sales list provides the Print Receipt/reprint entry point.

## Deployment Commands

- Local checks: `npm run lint`, `npm run build`, targeted tests such as `npm run test:branches`.
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
- Standalone receipt page is intentionally clean for printing and uses `autoprint=1`; it does not render a separate manual print button inside the receipt page.
- Local Windows `npm run build` has previously timed out in this workspace; VPS and Vercel production builds completed.
- Vercel CLI can surface a PowerShell `NativeCommandError` despite producing a READY deployment JSON and aliasing production; verify by deployment ID and `/api/health`.
