#!/usr/bin/env bash
# Print env, DNS, Railway, and Caddy values for moving AgroBridge to a new apex domain.
# Does not change production — it only prints the cutover checklist.
set -euo pipefail

OLD_DOMAIN="${OLD_DOMAIN:-agrobrid.ge}"
INCLUDE_WWW=0
NEW_DOMAIN=""

usage() {
  cat <<'EOF'
Usage: ./scripts/domain-cutover.sh [--old old-apex] [--www] <new-apex-domain>

Print Railway / .env.production values, Caddy hostnames, and DNS rows
for moving the site + API off the current production domain.

Examples:
  ./scripts/domain-cutover.sh agrobridge.ge
  ./scripts/domain-cutover.sh --old agrobrid.ge --www example.com

Environment:
  OLD_DOMAIN   Default previous apex (also set with --old)
EOF
}

is_hostname() {
  local value="$1"
  [[ "$value" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$ ]]
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --www)
      INCLUDE_WWW=1
      shift
      ;;
    --old)
      OLD_DOMAIN="${2:-}"
      shift 2
      ;;
    --old=*)
      OLD_DOMAIN="${1#--old=}"
      shift
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [[ -n "$NEW_DOMAIN" ]]; then
        echo "Unexpected extra argument: $1" >&2
        usage >&2
        exit 2
      fi
      NEW_DOMAIN="$1"
      shift
      ;;
  esac
done

if [[ -z "$NEW_DOMAIN" ]]; then
  usage >&2
  exit 2
fi

NEW_DOMAIN="${NEW_DOMAIN#https://}"
NEW_DOMAIN="${NEW_DOMAIN#http://}"
NEW_DOMAIN="${NEW_DOMAIN%%/*}"
NEW_DOMAIN="${NEW_DOMAIN%%:*}"
NEW_DOMAIN="${NEW_DOMAIN#www.}"

OLD_DOMAIN="${OLD_DOMAIN#https://}"
OLD_DOMAIN="${OLD_DOMAIN#http://}"
OLD_DOMAIN="${OLD_DOMAIN%%/*}"
OLD_DOMAIN="${OLD_DOMAIN#www.}"

if ! is_hostname "$NEW_DOMAIN"; then
  echo "Invalid new domain: $NEW_DOMAIN" >&2
  exit 2
fi
if ! is_hostname "$OLD_DOMAIN"; then
  echo "Invalid old domain: $OLD_DOMAIN" >&2
  exit 2
fi
if [[ "$NEW_DOMAIN" == "$OLD_DOMAIN" ]]; then
  echo "New domain must differ from old domain ($OLD_DOMAIN)." >&2
  exit 2
fi

WEB_URL="https://${NEW_DOMAIN}"
API_URL="https://api.${NEW_DOMAIN}"
OLD_WEB_URL="https://${OLD_DOMAIN}"
OLD_API_URL="https://api.${OLD_DOMAIN}"

ORIGINS="${OLD_WEB_URL},${WEB_URL}"
if [[ "$INCLUDE_WWW" -eq 1 ]]; then
  ORIGINS="${ORIGINS},https://www.${NEW_DOMAIN}"
fi

cat <<EOF
AgroBridge domain cutover
=========================
Old web:  ${OLD_WEB_URL}
Old API:  ${OLD_API_URL}
New web:  ${WEB_URL}
New API:  ${API_URL}

1) Cutover env (keep both origins so CORS still works)
-----------------------------------------------------
WEB_ORIGIN=${ORIGINS}
WEB_PUBLIC_URL=${WEB_URL}
API_PUBLIC_URL=${API_URL}
NEXT_PUBLIC_API_URL=${API_URL}/api
MAIL_FROM=AgroBridge <noreply@${NEW_DOMAIN}>

WEB_HOST=${NEW_DOMAIN}
API_HOST=api.${NEW_DOMAIN}
OLD_WEB_HOST=${OLD_DOMAIN}
OLD_API_HOST=api.${OLD_DOMAIN}

2) Final env (after 301 traffic has settled)
--------------------------------------------
WEB_ORIGIN=${WEB_URL}$([[ "$INCLUDE_WWW" -eq 1 ]] && printf ',https://www.%s' "$NEW_DOMAIN")
WEB_PUBLIC_URL=${WEB_URL}
API_PUBLIC_URL=${API_URL}
NEXT_PUBLIC_API_URL=${API_URL}/api
MAIL_FROM=AgroBridge <noreply@${NEW_DOMAIN}>

3) Railway
----------
- web  → Custom Domain → ${NEW_DOMAIN}$([[ "$INCLUDE_WWW" -eq 1 ]] && printf ' and www.%s' "$NEW_DOMAIN")
- api  → Custom Domain → api.${NEW_DOMAIN}
- Cloudflare CNAME to the Railway targets (not an A record to a VPS IP)
- Paste the cutover env on api (WEB_*, API_PUBLIC_URL, MAIL_FROM)
- Paste NEXT_PUBLIC_API_URL on web, then **redeploy web** (build-time var)
- Restart api after WEB_ORIGIN / WEB_PUBLIC_URL / API_PUBLIC_URL change

4) VPS + Caddy
--------------
export WEB_HOST=${NEW_DOMAIN}
export API_HOST=api.${NEW_DOMAIN}
export OLD_WEB_HOST=${OLD_DOMAIN}
export OLD_API_HOST=api.${OLD_DOMAIN}
# serve new hosts:
caddy run --config deploy/Caddyfile --adapter caddyfile
# plus 301 from previous hosts:
cat deploy/Caddyfile deploy/Caddyfile.redirects > /tmp/Caddyfile.cutover
caddy run --config /tmp/Caddyfile.cutover --adapter caddyfile

Rebuild web after NEXT_PUBLIC_API_URL changes:
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build web
docker compose -f docker-compose.prod.yml --env-file .env.production up -d api

5) DNS (Cloudflare example)
---------------------------
Type   Name   Target
CNAME  @      <Railway web hostname or VPS>
CNAME  api    <Railway api hostname or VPS>
CNAME  www    ${NEW_DOMAIN}   # optional

Keep ${OLD_DOMAIN} and api.${OLD_DOMAIN} pointing at the same app until 301s are in place.

6) After cutover
----------------
- Users must sign in again (auth cookie is host-only, no Domain=)
- Local uploads are stored as /api/uploads/... so they survive the hostname change
- Absolute media URLs (S3/R2) stay valid if STORAGE_PUBLIC_BASE_URL is a CDN you keep
- Update SPF/DKIM if MAIL_FROM uses the new apex
- Remove ${OLD_WEB_URL} from WEB_ORIGIN when old traffic is gone
EOF
