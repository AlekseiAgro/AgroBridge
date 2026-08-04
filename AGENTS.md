# AgroBridge

B2B agricultural marketplace. pnpm + Turborepo monorepo:

- `apps/web` — Next.js frontend (`@agrobridge/web`), port `3000`
- `apps/api` — NestJS backend (`@agrobridge/api`), port `3001`, global route prefix `/api`
- `packages/shared` — shared locales/roles/types (`@agrobridge/shared`), compiled TS

Standard commands and the full quick-start live in `README.md`. Prefer running everything from the repo root with `pnpm dev` (Turborepo runs web + api + the shared watcher together).

## Cursor Cloud specific instructions

Node 22 and pnpm 9 are preinstalled. The startup update script runs `pnpm install`, builds `@agrobridge/shared`, and runs `prisma generate`. The items below are the non-obvious things to do before the app works end to end.

### Database (PostgreSQL)

- Docker is NOT available in this environment, so `docker compose up` (from the README) does not work. PostgreSQL 16 is installed natively via apt instead, and a role/database matching `docker-compose.yml` already exist: user `agrobridge`, password `agrobridge`, database `agrobridge` on `localhost:5432`. This satisfies the default `DATABASE_URL`.
- Postgres does not auto-start on boot here. Start it with: `sudo pg_ctlcluster 16 main start` (check with `sudo pg_lsclusters`).
- Redis is declared in `docker-compose.yml` and `.env` but is not referenced by any code yet, so it is not required.

### Environment files

- `.env` files are gitignored. If missing, recreate them before running:
  - `cp apps/api/.env.example apps/api/.env`
  - `cp apps/web/.env.example apps/web/.env.local`
- Defaults need no external accounts: `MAIL_DRIVER=console` (emails are logged, not sent), `TRANSLATION_PROVIDER=mock`, `STORAGE_DRIVER=local` (uploads under `apps/api/uploads`).

### DB migrate + seed (needs Postgres running)

The update script does NOT touch the database. After Postgres is up, run once (or after schema changes):

- `pnpm --filter @agrobridge/api db:migrate`
- `pnpm --filter @agrobridge/api db:seed` (optional demo data)

Seed logins: admin `admin@agrobridge.local` / `ChangeMeAdmin1`; demo farmers/buyers use password `DemoPass123` (e.g. `farmer-fruits-1@agrobridge.local`, `buyer-1@agrobridge.local`).

### Lint / test

- `pnpm --filter @agrobridge/api test` — Jest (one intentional `smtp down` error is logged by a passing negative test).
- `pnpm lint` currently FAILS on `@agrobridge/web` only: its script is `next lint`, which was removed in Next.js 16, so `next` misreads `lint` as a directory. This is a pre-existing repo issue, unrelated to environment setup. `@agrobridge/api` and `@agrobridge/shared` lint pass.

### Gotchas

- `@agrobridge/shared` must be built (`dist/`) before api/web resolve it; the update script builds it, but if you edit shared, keep the `pnpm dev` shared watcher running (or rebuild).
- Health check: `GET http://localhost:3001/api/health`. The web root `/` returns a 307 redirect to a locale prefix (e.g. `/en`) via next-intl — that is expected, not an error.
