# Library Cloud — backend

NestJS 12 API on Fastify, with Drizzle ORM over Postgres 18 (Row-Level Security) and Redis 8 for rate limiting and caching. Everything the product does server-side lives here.

> The top-level [`README.md`](../README.md) explains the product; this file explains the code.

## Run it

```bash
# From the repository root — the easy path:
make db-dev        # postgres + redis only, exposed locally
pnpm install       # if you haven't
pnpm --dir backend dev

# Or with your own database:
cp .env.example .env      # set DATABASE_URL / DATABASE_URL_ADMIN / JWT_SECRET
pnpm dev                  # tsx watch, reads .env if present
```

Useful scripts (`backend/package.json`):

| Script | What it does |
|---|---|
| `pnpm dev` | Dev server with hot reload (`tsx watch`) |
| `pnpm build` | TypeScript compile → `dist/` (migrations are copied alongside) |
| `pnpm start` | Run the built server (production) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest against a **disposable Postgres** (real migrations, real RLS) |
| `pnpm bootstrap` | Apply migrations + bootstrap the runtime DB role (idempotent) |
| `pnpm seed` | Load demo data (add `SEED_RESET=1` for a clean slate) |

## Layout

```
src/
├── main.ts            Fastify bootstrap + payload limits
├── app.module.ts      composition root
├── app.setup.ts       global plugins (helmet, compression, validation, error shape)
├── env.ts             Zod-validated environment — the single source of truth
├── db/
│   ├── schema.ts      Drizzle schema — every table and type in one file
│   ├── client.ts      pooled postgres.js clients (app role + admin role)
│   ├── context.ts     withTenantContext(): SET LOCAL + transaction lifecycle
│   └── migrations/    numbered SQL migrations, applied by bootstrap
├── common/            guards, tenant middleware, pagination, errors, rate-limit store
├── scripts/           bootstrap.ts (migrations + role), seed.ts (demo data)
└── modules/           one folder per bounded context:
    auth            login / refresh rotation / scope-separated tokens
    users           staff accounts & roles (admin-gated)
    members         patron registry (card numbers, categories, status)
    books, copies   catalog and physical items
    branches        locations
    loans           circulation engine (checkout, return, renew)
    holds           queue, promotion, ready-shelf expiry
    fines           assessment, payment, waiver, checkout blocking
    dashboard       live metrics & 30-day series
    exports         streaming CSV
    public          OPAC endpoints (signed-out browsing + patron self-service)
    tenants         operator console (list, stats, suspend, overrides)
    billing         provider abstraction: stub | paddle, webhook handling
    notifications   in-app inbox + optional SMTP
    audit-logs      the immutable trail
    jobs            scheduled sweeps (holds, overdue, due-soon)
    health          liveness + DB check
```

## The tenant-isolation contract

This is the most important paragraph in this file:

1. Request handlers never touch `db` directly. They receive a transaction-scoped handle from `withTenantContext({ tenantId }, fn)` which runs `SET LOCAL app.current_tenant` **inside** the transaction — the setting dies with the transaction and cannot leak through the connection pool.
2. Every tenant-scoped table has `ENABLE` + **`FORCE ROW LEVEL SECURITY`** with policies reading `current_setting('app.current_tenant')`. `FORCE` means even the table owner cannot bypass it.
3. Request traffic connects as `app_user`, a **non-owner** role with no `BYPASSRLS`. Only migrations/bootstrap use `DATABASE_URL_ADMIN`.

If you add a table, add the policy in a migration and extend the isolation specs. If you add a query path, it goes through `withTenantContext` (or one of the documented narrow contexts: public OPAC browsing, refresh-token rotation). Reviewers will ask.

## Conventions

- **DTOs are Zod schemas** — validation, types, and documentation in one artifact (`modules/*/dto.ts`). The global validation pipe rejects unknown fields; do not bypass it.
- **Errors** — throw the typed errors from `common/`; the global filter shapes them into a stable `{ error: { code, message, details? } }` envelope.
- **Money** is integer cents, everywhere, no exceptions.
- **Dates** are stored UTC; rendering to local time is the frontend's job.
- **Auth contexts**: three token audiences (`staff`, `patron`, `platform`). Guards reject a token used outside its audience — a patron token must never pass a staff guard.
- **Jobs** check `JOBS_ENABLED` and run **per tenant** via the same context helper as requests.

## Testing

`pnpm test` launches a throwaway Postgres container on a dynamic port, applies the real migrations, boots the real Nest app, and runs Vitest + supertest specs. Isolation tests try to read another tenant's rows through every code path and must fail closed.

Knobs: `KEEP_TEST_DB=1` (don't tear down the scratch DB), `TEST_APP_LOG=1` (bootstrap logs), `TEST_DB_PORT=55440` (pin a port).

```bash
pnpm test                        # full suite (132 tests, 21 files)
pnpm test -- tenant-isolation    # one file
pnpm test:watch                  # red-green loop
```

## Migrations & bootstrap

Migrations are plain SQL in `src/db/migrations/NNNN_*.sql`, applied in order by `bootstrap.ts`, which also creates/updates the `app_user` role and grants. It's idempotent and safe to run on every deploy — the compose `migrate` service does exactly that. To add one: create the next number file, run `pnpm bootstrap` locally, extend the schema type in `src/db/schema.ts`.

## Environment

Validated at boot by `src/env.ts` — the app refuses to start with a missing `JWT_SECRET`, malformed `DATABASE_URL`, or invalid values, and prints precisely what's wrong. See [`.env.example`](../.env.example) for the full annotated list; the top-level README documents the important ones.
