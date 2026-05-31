# Sample Login Accounts

Use **Work ID** and **Password** on `/auth/login` (not email).

- Default password for all accounts: `Demo@2026!`

| Role | Work ID | Email |
| --- | --- | --- |
| Super Admin | `AQI-20261001` | `sample.superadmin@absoluteicecream.co.zw` |
| Procurement Officer | `AQI-20261002` | `sample.procurement@absoluteicecream.co.zw` |
| Store Keeper | `AQI-20261003` | `sample.storekeeper@absoluteicecream.co.zw` |
| Production Manager | `AQI-20261004` | `sample.productionmanager@absoluteicecream.co.zw` |
| Production Worker | `AQI-20261005` | `sample.productionworker@absoluteicecream.co.zw` |
| Sales Representative | `AQI-20261006` | `sample.salesrep@absoluteicecream.co.zw` |
| Branch Manager | `AQI-20261007` | `sample.branchmanager@absoluteicecream.co.zw` |
| Accountant | `AQI-20261008` | `sample.accountant@absoluteicecream.co.zw` |
| Auditor | `AQI-20261009` | `sample.auditor@absoluteicecream.co.zw` |

## Create/Refresh These Accounts

If `DATABASE_URL` is empty (local fallback auth mode), these accounts are auto-seeded on API start.
Restart the API server to refresh them.

If `DATABASE_URL` is set (database mode), run:

```bash
npm run -w packages/database seed:sample-accounts
```

## Important

Base seed/testing seed now use bcrypt hashes. If your DB was seeded before this fix, run one of these to recreate credentials:

```bash
npm run -w packages/database seed
```

or

```bash
npm run -w packages/database seed:testing
```
