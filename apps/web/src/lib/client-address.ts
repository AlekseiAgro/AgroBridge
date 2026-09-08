/** More entries than any sane proxy chain; keeps a hostile client from growing the header. */
const MAX_FORWARDED_ENTRIES = 5;

/**
 * Relays the visitor's address to the API when a request is proxied through a BFF route.
 * Without this the API sees the Next.js server as the caller and every visitor lands in the
 * same rate-limit bucket, which both hides attackers and would throttle the whole site at
 * once. The API decides how much of this chain to believe via its `TRUST_PROXY` setting.
 */
export function forwardedForOf(request: Request): string | null {
  const chain = request.headers.get('x-forwarded-for');
  if (!chain) {
    return null;
  }
  const entries = chain
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(-MAX_FORWARDED_ENTRIES);
  return entries.length > 0 ? entries.join(', ') : null;
}
