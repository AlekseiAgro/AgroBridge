# Deploy AgroBridge

This guide covers a single-host Docker deploy (VPS) using `docker-compose.prod.yml`.

## What you need

- A Linux host with Docker + Docker Compose
- A domain (or IP) for the web app, and preferably a separate host/path for the API
- TLS (HTTPS) in front of the containers (Caddy, Nginx, Traefik, or a cloud load balancer)

Auth cookies are `secure` when `NODE_ENV=production`, so **login will not stick on plain HTTP**.

## 1. Configure environment

```bash
cp .env.production.example .env.production
```

Set at least:

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
- `STORAGE_DRIVER=s3` + S3_* for durable media (R2/S3)
- `TRANSLATION_PROVIDER=openai` + `OPENAI_API_KEY` for chat translation

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
curl -sS "$API_PUBLIC_URL/api/health"
curl -sS -o /dev/null -w '%{http_code}\n' "$WEB_PUBLIC_URL"
```

## 3. Seed demo data (optional)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api \
  ./node_modules/.bin/prisma db seed
```

Demo passwords come from seed / env (`ADMIN_PASSWORD`, farmers/buyers `DemoPass123` in the built-in demo seed).

## 4. Reverse proxy sketch

Point HTTPS to containers:

- `https://app.example.com` → `web:3000`
- `https://api.example.com` → `api:3001`

Or same host with path routing (`/api` → api). If web and API share a site origin, set `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` accordingly.

## 5. Production checklist

- [ ] HTTPS enabled; `WEB_*` / `API_*` / `NEXT_PUBLIC_API_URL` use `https://`
- [ ] Strong `JWT_SECRET` and `POSTGRES_PASSWORD`
- [ ] `SUPPORT_EMAIL` reaches a monitored inbox
- [ ] SMTP configured if you need real mail (otherwise console logs only)
- [ ] Prefer S3/R2 for uploads if the container filesystem is ephemeral
- [ ] Backups for the Postgres volume
- [ ] Change or disable demo admin credentials after first login

## Local infra only

For development, keep using:

```bash
docker compose up -d   # Postgres + Redis only
pnpm dev
```

See root `README.md` for the local workflow.
