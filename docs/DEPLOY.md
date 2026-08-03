# Deploy AgroBridge

This guide covers a single-host Docker deploy (VPS) using `docker-compose.prod.yml`.

For **agrobrid.ge** now and a later domain move, see [`docs/DOMAIN.md`](DOMAIN.md).

## What you need

- A Linux host with Docker + Docker Compose
- Domain DNS for the web app + API subdomain
- TLS (HTTPS) in front of the containers — use [`deploy/Caddyfile`](../deploy/Caddyfile) or Nginx/Traefik

Auth cookies are `secure` when `NODE_ENV=production`, so **login will not stick on plain HTTP**.

## 1. Configure environment

```bash
cp .env.production.example .env.production
```

The example is pre-filled for **agrobrid.ge** / **api.agrobrid.ge**. Change secrets at minimum:

| Variable | Purpose |
|----------|---------|
| `WEB_ORIGIN` / `WEB_PUBLIC_URL` | Public web URL (CORS + email links) |
| `API_PUBLIC_URL` | Public API origin (uploaded media URLs) |
| `NEXT_PUBLIC_API_URL` | Browser/API base, usually `$API_PUBLIC_URL/api` |
| `POSTGRES_PASSWORD` | Database password |
| `JWT_SECRET` | Long random secret (API refuses weak defaults in production) |
| `SUPPORT_EMAIL` | Inbox for `/support` form |

Optional production upgrades:

- `MAIL_DRIVER=smtp` + SMTP_* for real email
- `STORAGE_DRIVER=s3` + S3_* for durable media (R2/S3) — recommended before any domain move
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
curl -sS https://api.agrobrid.ge/api/health
curl -sS -o /dev/null -w '%{http_code}\n' https://agrobrid.ge
```

## 3. Seed demo data (optional)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api \
  ./node_modules/.bin/prisma db seed
```

Demo passwords come from seed / env (`ADMIN_PASSWORD`, farmers/buyers `DemoPass123` in the built-in demo seed).

## 4. Reverse proxy (agrobrid.ge)

Point HTTPS to containers (see `deploy/Caddyfile`):

- `https://agrobrid.ge` → `127.0.0.1:3000` (web)
- `https://api.agrobrid.ge` → `127.0.0.1:3001` (api)

Do **not** mount Nest at `https://agrobrid.ge/api` — Next.js already owns `/api/*` as BFF routes.

## 5. Production checklist

- [ ] DNS for `agrobrid.ge` and `api.agrobrid.ge`
- [ ] HTTPS enabled; env URLs use `https://`
- [ ] Strong `JWT_SECRET` and `POSTGRES_PASSWORD`
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
