# Domain setup & migration

AgroBridge does **not** bake a brand domain into application logic.
Public URLs come from environment variables, so you can launch on `agrobrid.ge`
and later move to another domain without rewriting product code.

## Hosting on Railway (no VPS IP)

If the app runs on Railway, Cloudflare uses **CNAME** targets from Railway Custom Domains — not an A record to a VPS IP.
See [`docs/RAILWAY.md`](RAILWAY.md).

## Current target: agrobrid.ge

| Role | URL |
|------|-----|
| Website | `https://agrobrid.ge` |
| API | `https://api.agrobrid.ge` |

Env mapping (see `.env.production.example`):

```bash
WEB_ORIGIN=https://agrobrid.ge
WEB_PUBLIC_URL=https://agrobrid.ge
API_PUBLIC_URL=https://api.agrobrid.ge
NEXT_PUBLIC_API_URL=https://api.agrobrid.ge/api
MAIL_FROM=AgroBridge <noreply@agrobrid.ge>
```

DNS:

1. `A` / `AAAA` for `agrobrid.ge` → VPS
2. `A` / `AAAA` for `api.agrobrid.ge` → same VPS (or CNAME to apex)
3. TLS via Caddy (`deploy/Caddyfile`) or another reverse proxy

Why a subdomain for API? Next.js already uses `/api/*` as BFF routes on the web app.
Putting Nest on `api.agrobrid.ge` avoids path clashes.

## Moving to a new domain later

Example: `agrobrid.ge` → `new-domain.example`

1. **Prepare DNS + TLS** for `new-domain.example` and `api.new-domain.example`.
2. **Update `.env.production`** only:
   ```bash
   WEB_ORIGIN=https://agrobrid.ge,https://new-domain.example
   WEB_PUBLIC_URL=https://new-domain.example
   API_PUBLIC_URL=https://api.new-domain.example
   NEXT_PUBLIC_API_URL=https://api.new-domain.example/api
   MAIL_FROM=AgroBridge <noreply@new-domain.example>
   ```
   `WEB_ORIGIN` may list both origins during cutover so CORS keeps working.
3. **Rebuild web** (required): `NEXT_PUBLIC_API_URL` is compiled into the Next.js bundle.
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build web
   ```
   API restart is enough for `WEB_*` / `API_PUBLIC_URL` (no rebuild needed unless you change the image).
4. **Point reverse proxy** at the new hostnames (`deploy/Caddyfile`).
5. **Redirect** old domain → new domain (301) until traffic settles.
6. Remove the old origin from `WEB_ORIGIN` when cutover is done.

## Keep media URLs stable across a move

If product photos are stored with `STORAGE_DRIVER=local`, public file URLs include `API_PUBLIC_URL`.
After an API hostname change, old absolute links can break unless you redirect `api.agrobrid.ge` → `api.new-domain.example`.

Better before launch (or before the move):

- use `STORAGE_DRIVER=s3` (S3 / Cloudflare R2)
- set `STORAGE_PUBLIC_BASE_URL` to a CDN host you keep forever

## Checklist

- [ ] Domain lives only in `.env.production` + reverse proxy config
- [ ] No product feature depends on a hard-coded host
- [ ] Web image rebuilt whenever `NEXT_PUBLIC_API_URL` changes
- [ ] Optional: dual `WEB_ORIGIN` during migration
- [ ] Optional: 301 from old domain; CDN for uploads
