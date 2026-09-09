/** Cloudflare sets this on every request and overwrites any value a client sends. */
const CLOUDFLARE_CLIENT_IP = 'cf-connecting-ip';

/** Longest textual IPv6 address, including an embedded IPv4 tail. */
const MAX_ADDRESS_LENGTH = 45;

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]+(:(\d{1,3}\.){3}\d{1,3})?$/i;

/**
 * The visitor's address, to be relayed to the API when a request is proxied through a BFF
 * route. Without it the API sees the Next.js server as the caller and every visitor lands in
 * the same rate-limit bucket, which both hides attackers and would throttle the whole site
 * at once.
 *
 * Exactly one address is returned rather than the incoming chain: the API believes the
 * rightmost entry of `X-Forwarded-For` that it did not receive from a trusted peer, and the
 * chain arriving here ends in Cloudflare and Railway edge addresses, not in the visitor.
 *
 * A client cannot choose the value. `CF-Connecting-IP` is written by Cloudflare, which
 * discards whatever the client sent, and the fallback takes the last `X-Forwarded-For` entry
 * — appended by the nearest proxy from the address it actually saw, so it is the one entry
 * in the chain that is not client-supplied. A hostile client can prepend anything it likes
 * to the header and none of it is read.
 */
export function visitorAddressOf(request: Request): string | null {
  const cloudflare = addressOrNull(request.headers.get(CLOUDFLARE_CLIENT_IP));
  if (cloudflare) {
    return cloudflare;
  }

  const chain = request.headers.get('x-forwarded-for');
  if (!chain) {
    return null;
  }
  const entries = chain.split(',');
  return addressOrNull(entries[entries.length - 1] ?? null);
}

/**
 * Header values are attacker-influenced and go straight back out in a request header, so
 * anything that is not plainly an IP address is dropped rather than passed along.
 */
function addressOrNull(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ADDRESS_LENGTH) {
    return null;
  }
  return IPV4.test(trimmed) || IPV6.test(trimmed) ? trimmed : null;
}
