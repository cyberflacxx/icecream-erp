# Supabase Deployment (PostgreSQL)

## 1. Configure env
Use Supabase URLs:
- `DATABASE_URL`: transaction pooler URL
- `DIRECT_URL`: direct Postgres URL
- `DB_PROVIDER=postgresql`

## 2. Prisma (PostgreSQL)
```bash
npm run -w packages/database db:generate:pg
npm run -w packages/database db:push:pg
npm run -w packages/database db:seed:pg
```

## 3. MySQL -> PostgreSQL migration strategy
1. Keep app-level schema in `schema.postgresql.prisma` as source of truth.
2. Develop locally with `schema.mysql.prisma`.
3. For data migration, run chunked table-by-table script with ID preservation and FK order.
4. Validate counts + critical aggregates after migration before cutover.