# Deploy AgroBridge

This guide covers a single-host Docker deploy (VPS) using `docker-compose.prod.yml`.

For **agrobridge.ge** now and a later domain move, see [`docs/DOMAIN.md`](DOMAIN.md).

## What you need

- A Linux host with Docker + Docker Compose
- Domain DNS for the web app + API subdomain
- TLS (HTTPS) in front of the containers — use [`deploy/Caddyfile`](../deploy/Caddyfile) or Nginx/Traefik

Auth cookies are `secure` when `NODE_ENV=production`, so **login will not stick on plain HTTP**.

## 1. Configure environment

```bash
cp .env.production.example .env.production
```

The example is pre-filled for **agrobridge.ge** / **api.agrobridge.ge**. Change secrets at minimum:

| Variable | Purpose |
|----------|---------|
| `WEB_ORIGIN` / `WEB_PUBLIC_URL` | Public web URL (CORS + email links) |
| `API_PUBLIC_URL` | Public API origin (uploaded media URLs) |
| `NEXT_PUBLIC_API_URL` | Browser/API base, usually `$API_PUBLIC_URL/api` |
| `API_INTERNAL_URL` | Private API address the Next.js server calls. Compose: `http://api:3001/api`. Railway: `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8080/api` (Railway injects `PORT=8080`; do not override it). Server-only; sending server-side traffic through the public hostname breaks per-visitor rate limiting |
| `POSTGRES_PASSWORD` | Database password |
| `JWT_SECRET` | Long random secret (API refuses weak defaults in production) |
| `SUPPORT_EMAIL` | Inbox for `/support` form |
| `TRUST_PROXY` | Which `X-Forwarded-For` entries the API believes; wrong values break IP rate limiting. Defaults to our own private ranges in production, which is where the Next.js server calls from. See [`docs/RATE_LIMITING.md`](RATE_LIMITING.md) |

Optional production upgrades:

- `MAIL_DRIVER=resend` plus `RESEND_API_KEY` and `MAIL_FROM` for real email over HTTPS (`POST https://api.resend.com/emails`). Incomplete resend config fails API startup (no silent console fallback). `NODE_ENV=production` also refuses `MAIL_DRIVER=console` unless `MAIL_ALLOW_CONSOLE=true` (staging). Local/dev `MAIL_DRIVER=console` stays valid without `RESEND_API_KEY`. SMTP (`MAIL_DRIVER=smtp` + `SMTP_*`) remains in code for local/legacy use and is unused when the driver is `resend`. Never log `RESEND_API_KEY`, `SMTP_PASSWORD`, reset tokens, or verification codes. Never set `RESEND_API_KEY` as `NEXT_PUBLIC_*`.
- `SMS_DRIVER=infobip` plus `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, and `INFOBIP_SENDER` for production SMS over HTTPS. OTP generation, hashing, TTL, attempts, and rate limits stay in AgroBridge PostgreSQL; Infobip is delivery only. Incomplete Infobip config fails API startup. `NODE_ENV=production` refuses `SMS_DRIVER=console` unless `SMS_ALLOW_CONSOLE=true`. Never log `INFOBIP_API_KEY`, OTP codes, or full phone numbers. Never set `INFOBIP_*` as `NEXT_PUBLIC_*`.
- `STORAGE_DRIVER=s3` + S3_* for durable media (R2/S3) — required on Railway; recommended on VPS before any domain move
- `TRANSLATION_PROVIDER=openai` + `OPENAI_API_KEY` for chat translation
- `GOOGLE_MAPS_API_KEY` for product origin place autocomplete (Places API New; settlements only)

## 2. Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Services:

- `web` → host port `WEB_HOST_PORT` (default 3000)
- `api` → host port `API_HOST_PORT` (default 3001)
- `postgres`, `redis` (internal network)
- API runs `prisma migrate deploy` on every start

Health:

```bash
curl -sS https://api.agrobridge.ge/api/health
curl -sS -o /dev/null -w '%{http_code}\n' https://agrobridge.ge
```

## 3. Admin login (no demo marketplace seed)

Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.production`. On every API start the container upserts that admin (verified email) via `prisma/ensure-admin.cjs`. Production boot never runs `prisma db seed`.

To create/update the admin **immediately** without waiting for redeploy, from inside the API container (`/app/apps/api`):

```bash
# admin account only (recommended for production):
node ./prisma/ensure-admin.cjs
```

`prisma db seed` still upserts legal documents, category config, and the admin account. Demo farmers, buyers, products, deals, and purchase requests are **blocked when `NODE_ENV=production`**. Do not set `ALLOW_DEMO_SEED=true` on the public marketplace.

To inspect leftover `@agrobridge.local` demo marketplace users (dry-run JSON report, no deletes):

```bash
node ./prisma/run-cleanup-demo.cjs
# only after reviewing the report, and only with explicit approval:
node ./prisma/run-cleanup-demo.cjs --apply
```

Live test records that do not use `@agrobridge.local` (for example a farm named BBB or a draft titled «Новый товар») are **not** deleted by this script.

To align the existing 39 `@agrobridge.local` demo catalog products with `DEMO_CATALOG_PRICES` (PR #185) **without** reseeding:

```bash
# default is dry-run — no writes
pnpm db:fix-demo-catalog-prices
# or from /app/apps/api:
node ./prisma/run-fix-demo-catalog-prices.cjs

# only after reviewing the plan, and only with explicit approval:
node ./prisma/run-fix-demo-catalog-prices.cjs --apply
```

This is **not** a seed. It never deletes or recreates records. It updates only `Product.priceFrom`, `Product.priceCurrency`, and `Product.unit` for those 39 titles. Full `prisma db seed` / demo marketplace seed must **not** be used on the public marketplace. The script aborts with zero writes unless it can uniquely map exactly those 39 titles to demo-owned products. Production startup and `db:seed` do not invoke it.

## 4. Reverse proxy (agrobridge.ge)

Point HTTPS to containers (see `deploy/Caddyfile`):

- `https://agrobridge.ge` → `127.0.0.1:3000` (web)
- `https://api.agrobridge.ge` → `127.0.0.1:3001` (api)

Do **not** mount Nest at `https://agrobridge.ge/api` — Next.js already owns `/api/*` as BFF routes.

## 5. Production checklist

- [ ] DNS for `agrobridge.ge` and `api.agrobridge.ge`
- [ ] HTTPS enabled; env URLs use `https://`
- [ ] Strong `JWT_SECRET` and `POSTGRES_PASSWORD`
- [ ] Client addresses resolve correctly through the proxy chain (check the API boot log for the trusted-proxy setting)
- [ ] `SUPPORT_EMAIL` reaches a monitored inbox
- [ ] SMTP configured if you need real mail (otherwise console logs only)
- [ ] Prefer S3/R2 for uploads if the container filesystem is ephemeral
- [ ] Backups for the Postgres volume
- [ ] Change or disable demo admin credentials after first login
- [ ] Read [`docs/DOMAIN.md`](DOMAIN.md) before planning a domain move

## Local infra only

For development, keep using:

```bash
docker compose up -d   # Postgres + Redis only
pnpm dev
```

See root `README.md` for the local workflow.
