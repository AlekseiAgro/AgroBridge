# Domain setup & migration

AgroBridge does **not** bake a brand domain into application logic.
Public URLs come from environment variables.

**This cutover:** `agrobrid.ge` → `agrobridge.ge` (API: `api.agrobridge.ge`).

```bash
./scripts/domain-cutover.sh agrobridge.ge
# include www in CORS:
./scripts/domain-cutover.sh --www agrobridge.ge
```

## Hosting on Railway (no VPS IP)

If the app runs on Railway, Cloudflare uses **CNAME** targets from Railway Custom Domains — not an A record to a VPS IP.
See [`docs/RAILWAY.md`](RAILWAY.md).

## Target production host: agrobridge.ge

| Role | URL |
|------|-----|
| Website | `https://agrobridge.ge` |
| API | `https://api.agrobridge.ge` |
| Previous web (301) | `https://agrobrid.ge` |
| Previous API (301) | `https://api.agrobrid.ge` |

Why a subdomain for API? Next.js already uses `/api/*` as BFF routes on the web app.
Putting Nest on `api.agrobridge.ge` avoids path clashes.

Auth cookies are host-only (no `Domain=`). Users sign in again on `agrobridge.ge`.

## Cutover env (`agrobrid.ge` → `agrobridge.ge`)

Keep both web origins until 301 traffic settles.

```bash
WEB_ORIGIN=https://agrobrid.ge,https://agrobridge.ge
WEB_PUBLIC_URL=https://agrobridge.ge
API_PUBLIC_URL=https://api.agrobridge.ge
NEXT_PUBLIC_API_URL=https://api.agrobridge.ge/api
MAIL_FROM=AgroBridge <noreply@agrobridge.ge>

WEB_HOST=agrobridge.ge
API_HOST=api.agrobridge.ge
OLD_WEB_HOST=agrobrid.ge
OLD_API_HOST=api.agrobrid.ge
```

If you also serve `www.agrobridge.ge`, add `https://www.agrobridge.ge` to `WEB_ORIGIN`.

### Final env (after 301s)

```bash
WEB_ORIGIN=https://agrobridge.ge
WEB_PUBLIC_URL=https://agrobridge.ge
API_PUBLIC_URL=https://api.agrobridge.ge
NEXT_PUBLIC_API_URL=https://api.agrobridge.ge/api
MAIL_FROM=AgroBridge <noreply@agrobridge.ge>
```

## Steps

### 1. DNS + TLS first

Create records for `agrobridge.ge` and `api.agrobridge.ge` (and optionally `www`).
Keep `agrobrid.ge` / `api.agrobrid.ge` pointing at the same app until 301s are live.

- **Railway:** Custom Domain on `web` → `agrobridge.ge`; on `api` → `api.agrobridge.ge`. Cloudflare CNAME to Railway’s targets.
- **VPS:** A/AAAA (or CNAME) to the box; Caddy issues TLS. Defaults in [`deploy/Caddyfile`](../deploy/Caddyfile) are already `agrobridge.ge`.

### 2. Apply cutover env

Paste the cutover block into Railway variables or `.env.production`.

`WEB_ORIGIN` may list both origins (comma-separated, spaces allowed) so CORS keeps working during cutover.

### 3. Rebuild web, restart API

`NEXT_PUBLIC_API_URL` is compiled into the Next.js bundle. A web **rebuild / redeploy** is required.

VPS:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build web
docker compose -f docker-compose.prod.yml --env-file .env.production up -d api
```

Railway: set the vars, then **redeploy `web`**. Restart `api` after `WEB_*` / `API_PUBLIC_URL` change.

### 4. Reverse proxy + 301

Point the new hostnames at web (`:3000`) and API (`:3001`).

VPS Caddy:

```bash
export WEB_HOST=agrobridge.ge
export API_HOST=api.agrobridge.ge
export OLD_WEB_HOST=agrobrid.ge
export OLD_API_HOST=api.agrobrid.ge
cat deploy/Caddyfile deploy/Caddyfile.redirects > /tmp/Caddyfile.cutover
caddy run --config /tmp/Caddyfile.cutover --adapter caddyfile
```

Railway: add Custom Domains for `agrobridge.ge` / `api.agrobridge.ge`. Keep the old names until Cloudflare Redirect Rules send `agrobrid.ge` → `agrobridge.ge` and `api.agrobrid.ge` → `api.agrobridge.ge`.

### 5. Finish

Remove `https://agrobrid.ge` from `WEB_ORIGIN` when traffic has settled. Update SPF/DKIM if mail is sent from `agrobridge.ge`.

## Media URLs

Local uploads (`STORAGE_DRIVER=local`) are stored as `/api/uploads/...` paths. The web app proxies them, so they follow `api.agrobridge.ge` after the web rebuild.

If any older rows still contain `https://api.agrobrid.ge/api/uploads/...`, the UI strips that host back to `/api/uploads/...`. A 301 from `api.agrobrid.ge` is still useful for bookmarks and emails.

S3 / R2 objects should use `STORAGE_PUBLIC_BASE_URL` on a CDN host you keep across brand domains.

## Checklist

- [ ] DNS + TLS for `agrobridge.ge` and `api.agrobridge.ge`
- [ ] Dual `WEB_ORIGIN` during cutover
- [ ] Web image rebuilt after `NEXT_PUBLIC_API_URL=https://api.agrobridge.ge/api`
- [ ] API restarted after `WEB_*` / `API_PUBLIC_URL` / `MAIL_FROM` change
- [ ] 301 `agrobrid.ge` → `agrobridge.ge` and `api.agrobrid.ge` → `api.agrobridge.ge`
- [ ] Optional `www` included in `WEB_ORIGIN` if you serve it
- [ ] SPF/DKIM if `MAIL_FROM` uses `agrobridge.ge`
- [ ] Old origin removed from `WEB_ORIGIN` after cutover
