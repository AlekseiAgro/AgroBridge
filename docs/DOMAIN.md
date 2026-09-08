# Domain setup & migration

AgroBridge does **not** bake a brand domain into application logic.
Public URLs come from environment variables. Moving hosts is a config + DNS
cutover, not a product rewrite.

Generate the exact values for a new apex domain:

```bash
./scripts/domain-cutover.sh new-domain.example
# optional www origin:
./scripts/domain-cutover.sh --www new-domain.example
# if the previous host is not agrobrid.ge:
./scripts/domain-cutover.sh --old agrobrid.ge new-domain.example
```

## Hosting on Railway (no VPS IP)

If the app runs on Railway, Cloudflare uses **CNAME** targets from Railway Custom Domains — not an A record to a VPS IP.
See [`docs/RAILWAY.md`](RAILWAY.md).

## Current production host: agrobrid.ge

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

Why a subdomain for API? Next.js already uses `/api/*` as BFF routes on the web app.
Putting Nest on `api.<apex>` avoids path clashes.

Auth cookies are host-only (no `Domain=`). After the move, users sign in again on the new host.

## Moving to a new domain

Example: `agrobrid.ge` → `new-domain.example`

### 1. DNS + TLS first

Create records for `new-domain.example` and `api.new-domain.example` (and optionally `www`).
Keep the old names pointing at the same app until 301s are live.

- **Railway:** Custom Domain on `web` / `api`, then Cloudflare CNAME to Railway’s targets.
- **VPS:** A/AAAA (or CNAME) to the box; Caddy issues TLS. Set `WEB_HOST` / `API_HOST` (see [`deploy/Caddyfile`](../deploy/Caddyfile)).

### 2. Cutover env (both origins)

Update Railway variables or `.env.production`:

```bash
WEB_ORIGIN=https://agrobrid.ge,https://new-domain.example
WEB_PUBLIC_URL=https://new-domain.example
API_PUBLIC_URL=https://api.new-domain.example
NEXT_PUBLIC_API_URL=https://api.new-domain.example/api
MAIL_FROM=AgroBridge <noreply@new-domain.example>
```

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

VPS Caddy (new hosts):

```bash
export WEB_HOST=new-domain.example
export API_HOST=api.new-domain.example
caddy run --config deploy/Caddyfile --adapter caddyfile
```

Then 301 the old names (`deploy/Caddyfile.redirects`):

```bash
export OLD_WEB_HOST=agrobrid.ge
export OLD_API_HOST=api.agrobrid.ge
cat deploy/Caddyfile deploy/Caddyfile.redirects > /tmp/Caddyfile.cutover
caddy run --config /tmp/Caddyfile.cutover --adapter caddyfile
```

Railway: add Custom Domains for the new names; keep the old custom domains until you attach redirects at Cloudflare (Page Rule / Redirect Rule) or drop them.

### 5. Finish

Remove the old origin from `WEB_ORIGIN` when traffic has settled. Update SPF/DKIM if mail is sent from the new apex.

## Keep media URLs stable across a move

Local uploads (`STORAGE_DRIVER=local`) are stored as `/api/uploads/...` paths. The web app proxies them, so they follow the new API host after the web rebuild.

If any older rows still contain an absolute `https://api.agrobrid.ge/api/uploads/...` URL, the UI strips that host back to `/api/uploads/...`. A 301 from `api.agrobrid.ge` is still useful for bookmarks and emails.

S3 / R2 objects should use `STORAGE_PUBLIC_BASE_URL` on a CDN host you keep across brand domains.

## Checklist

- [ ] New DNS + TLS for apex and `api.` subdomain
- [ ] Dual `WEB_ORIGIN` during cutover
- [ ] Web image rebuilt after `NEXT_PUBLIC_API_URL` change
- [ ] API restarted after `WEB_*` / `API_PUBLIC_URL` / `MAIL_FROM` change
- [ ] 301 from old web + API hosts
- [ ] Optional `www` included in `WEB_ORIGIN` if you serve it
- [ ] SPF/DKIM if `MAIL_FROM` uses the new apex
- [ ] Old origin removed from `WEB_ORIGIN` after cutover
