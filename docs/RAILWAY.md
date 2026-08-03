# Deploy AgroBridge on Railway

Railway replaces a single VPS: you run **four services** in one project.

| Service | Role |
|---------|------|
| Postgres | Database |
| Redis | Cache / jobs |
| `api` | NestJS (`apps/api`) |
| `web` | Next.js (`apps/web`) |

Custom domain later: `agrobrid.ge` → web, `api.agrobrid.ge` → api (Cloudflare CNAME, not an A→IP).

## 1. Create the project (your current screen)

1. Click **Deploy a GitHub Repository** (or **+ New** → GitHub).
2. Connect GitHub if asked, select **`AlekseiAgro/AgroBridge`**.
3. If Railway offers monorepo packages, keep going — you will still add DB/Redis and env vars manually below.
4. Prefer starting with **Empty Project**, then add services one by one (clearest for this stack).

Recommended path from an empty project:

1. **+ New** → **Empty Project** (or finish GitHub import, then delete auto services if confusing).
2. In the project canvas: **+ Create** / **+ New**:
   - **Database** → **PostgreSQL**
   - **Database** → **Redis**
   - **GitHub Repo** → same monorepo → name it **`api`**
   - **GitHub Repo** → same monorepo again → name it **`web`**

## 2. Configure `api` service

**Settings → Build** (critical — otherwise Railway uses Railpack and fails with “No start command detected”):

| Setting | Value |
|---------|--------|
| Builder | **Dockerfile** (not Railpack / Railpack) |
| Dockerfile path | `apps/api/Dockerfile` |
| Root Directory | *(leave empty — repo root)* |
| Watch Paths | `/apps/api/**`, `/packages/shared/**` |

**Settings → Config-as-code**

| Setting | Value |
|---------|--------|
| Config file path | `apps/api/railway.toml` |

If Build Logs still say `using build driver railpack`, the builder is still Railpack — switch Builder to Dockerfile and redeploy.

**Settings → Networking:** enable public domain (URL appears after a successful deploy).

**Variables** (Variables tab):

```bash
NODE_ENV=production
JWT_SECRET=<generate a long random string>
JWT_EXPIRES_SECONDS=604800
SUPPORT_EMAIL=gabo.m0619@gmail.com
MAIL_DRIVER=console
MAIL_FROM=AgroBridge <noreply@agrobrid.ge>
# To send real emails (verification codes), switch to SMTP and set credentials:
# MAIL_DRIVER=smtp
# SMTP_HOST=smtp.resend.com
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_USER=resend
# SMTP_PASSWORD=<api-key>
# Broken/slow SMTP previously hung registration until Cloudflare returned HTML 524.
TRANSLATION_PROVIDER=mock
# Optional: product "place of origin" city/village suggestions (Places API New)
# GOOGLE_MAPS_API_KEY=<google-maps-api-key>
STORAGE_DRIVER=local

# Link Railway Postgres / Redis (reference variables):
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# After web has a public domain, set (or use references):
WEB_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
WEB_PUBLIC_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
API_PUBLIC_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
```

Notes:

- Exact reference names depend on how you named the Postgres/Redis/web services in the canvas — pick them from Railway’s variable reference menu.
- First deploy: generate a **public domain** for `api` (Settings → Networking → Generate Domain).
- Health: `https://<api-domain>/api/health`

The API image runs `prisma migrate deploy` on start.

## 3. Configure `web` service

**Settings**

| Setting | Value |
|---------|--------|
| Root Directory | *(empty — repo root)* |
| Builder | Dockerfile |
| Dockerfile path | `apps/web/Dockerfile` |
| Watch Paths | `/apps/web/**`, `/packages/shared/**` |

**Variables**

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}/api
```

`NEXT_PUBLIC_API_URL` is baked at **build** time — set it before/with the first successful web build, then redeploy web if the API domain changes.

Generate a public domain for `web`.

## 4. Admin login + optional demo seed

Set API variables:

```bash
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=<strong-password>
ADMIN_DISPLAY_NAME=AgroBridge Admin
```

Redeploy `api` — on start it runs `prisma/ensure-admin.cjs` and upserts that admin (email marked verified).

Or create/update immediately in the API shell (`cwd` is usually `/app/apps/api`):

```bash
node ./prisma/ensure-admin.cjs
```

Full demo seed (optional):

```bash
./node_modules/.bin/prisma db seed
# fallback:
/app/node_modules/.bin/prisma db seed
# or:
node ./prisma/run-seed.cjs
```

## 5. Point agrobrid.ge (Cloudflare)

After Railway domains work:

1. Railway → `web` → Custom Domain → `agrobrid.ge` (and optionally `www`).
2. Railway → `api` → Custom Domain → `api.agrobrid.ge`.
3. Cloudflare DNS (follow Railway’s CNAME target exactly), usually:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `@` or Railway-required host | Railway web hostname | often DNS only while verifying |
| CNAME | `www` | Railway web hostname / redirect | |
| CNAME | `api` | Railway api hostname | DNS only recommended at first |

4. Update Railway variables to the real domains and **redeploy web**:

```bash
WEB_ORIGIN=https://agrobrid.ge
WEB_PUBLIC_URL=https://agrobrid.ge
API_PUBLIC_URL=https://api.agrobrid.ge
NEXT_PUBLIC_API_URL=https://api.agrobrid.ge/api
```

## 6. Backups later

- Start: Railway Postgres backups / snapshots (plan-dependent).
- Later: periodic `pg_dump` to B2 / R2 / S3 (another provider), same as planned for Hetzner.

## Troubleshooting

### Build log: `using build driver railpack` / `No start command detected`

Railway did **not** use the Dockerfile. Fix:

1. `api` → **Settings → Build** → Builder = **Dockerfile**
2. Dockerfile path = `apps/api/Dockerfile`
3. **Settings → Config-as-code** → config path = `apps/api/railway.toml`
4. Redeploy and confirm Build Logs mention **Dockerfile** / `docker build`, not `Railpack`

### Build ok, deploy crash on boot

- Check `JWT_SECRET` is set and not `change-me-in-production`
- Check `DATABASE_URL` / `REDIS_URL` are Variable References to Postgres / Redis
