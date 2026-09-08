# Domain setup & migration

AgroBridge does **not** bake a brand domain into application logic.
Public URLs come from environment variables.

## Production: agrobridge.ge

| Role | URL |
|------|-----|
| Website | `https://agrobridge.ge` |
| API | `https://api.agrobridge.ge` |

```bash
WEB_ORIGIN=https://agrobridge.ge
WEB_PUBLIC_URL=https://agrobridge.ge
API_PUBLIC_URL=https://api.agrobridge.ge
NEXT_PUBLIC_API_URL=https://api.agrobridge.ge/api
MAIL_FROM=AgroBridge <noreply@agrobridge.ge>
```

If you also serve `www.agrobridge.ge`, add `https://www.agrobridge.ge` to `WEB_ORIGIN`.

Why a subdomain for API? Next.js already uses `/api/*` as BFF routes on the web app.
Putting Nest on `api.agrobridge.ge` avoids path clashes.

Auth cookies are host-only (no `Domain=`). A later hostname change requires users to sign in again.

## Hosting on Railway (no VPS IP)

Cloudflare uses **CNAME** targets from Railway Custom Domains — not an A record to a VPS IP.
See [`docs/RAILWAY.md`](RAILWAY.md).

- `web` custom domain: `agrobridge.ge`
- `api` custom domain: `api.agrobridge.ge`
- Rebuild **web** whenever `NEXT_PUBLIC_API_URL` changes (build-time).

VPS Caddy defaults in [`deploy/Caddyfile`](../deploy/Caddyfile) are already `agrobridge.ge` / `api.agrobridge.ge`.

## Previous host

`agrobrid.ge` / `api.agrobrid.ge` were the previous public names. Optional 301s can stay in Cloudflare or [`deploy/Caddyfile.redirects`](../deploy/Caddyfile.redirects). Do **not** keep the old origin in `WEB_ORIGIN` now that traffic is on `agrobridge.ge`.

Local upload paths are `/api/uploads/...`. Absolute URLs that still mention `api.agrobrid.ge` are stripped back to that path in the UI.

## Moving again later

```bash
./scripts/domain-cutover.sh new-domain.example
# previous apex is agrobridge.ge by default:
./scripts/domain-cutover.sh --old agrobridge.ge --www new-domain.example
```

`WEB_ORIGIN` may list several https origins (comma-separated, spaces allowed) during a future cutover.
