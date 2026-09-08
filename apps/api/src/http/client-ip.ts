import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Guards against an absurd value silently trusting the whole `X-Forwarded-For` chain. */
const MAX_TRUST_PROXY_HOPS = 10;

/** Shared bucket for callers whose address cannot be resolved. */
export const UNKNOWN_IP = 'unknown';

/**
 * Loopback plus the private ranges: everything our own infrastructure can occupy, and
 * nothing a client on the public internet can present as its source address.
 */
const DEFAULT_TRUSTED_PROXIES = ['loopback', 'linklocal', 'uniquelocal'];

const PROXY_KEYWORDS = new Set(DEFAULT_TRUSTED_PROXIES);
const ADDRESS_PATTERN = /^[0-9a-f.:/]+$/i;

/**
 * `0.0.0.0/0`, `::/0` and any other zero-length prefix match every address, which would
 * hand each client control over its own rate-limit identity. Refused outright rather than
 * left as a configuration footgun.
 */
const MATCHES_EVERY_ADDRESS = /\/0+$/;
const UNSPECIFIED_ADDRESSES = new Set(['0.0.0.0', '::', '::0']);

type IpBearingRequest = {
  ip?: string;
  socket?: { remoteAddress?: string | null } | null;
};

/**
 * Express `trust proxy` setting: which `X-Forwarded-For` entries may be believed.
 *
 * The header is attacker-controlled, so only entries appended by infrastructure we run
 * count. The default is a trust *list* rather than a hop count because the number of hops
 * differs per route, while the peer address does not: the Next.js BFF reaches the API over
 * the private network (Railway's `fd12::/16` and `10.0.0.0/8`, Compose's bridge network,
 * loopback in development), all of which are addresses no client on the internet can hold.
 * A request relayed from there carries the visitor address the web tier resolved, and it is
 * believed; anything arriving from a public address is not, and resolves to the peer itself.
 *
 * `TRUST_PROXY` overrides it, taking either a hop count (`1`) or a comma-separated list of
 * keywords and addresses (`loopback,uniquelocal,203.0.113.7`). Entries matching every
 * address are rejected — with those, the rightmost entry of a forged header would win.
 */
export function resolveTrustProxy(env: NodeJS.ProcessEnv): number | string[] {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw) {
    return env.NODE_ENV === 'production' ? [...DEFAULT_TRUSTED_PROXIES] : 0;
  }

  if (/^\d+$/.test(raw)) {
    const hops = Number(raw);
    if (hops > MAX_TRUST_PROXY_HOPS) {
      throw new Error(
        `TRUST_PROXY hop count must not exceed ${MAX_TRUST_PROXY_HOPS} (got "${raw}")`,
      );
    }
    return hops;
  }

  const entries = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0) {
    throw new Error(`TRUST_PROXY must be a hop count or a list of proxies (got "${raw}")`);
  }
  for (const entry of entries) {
    if (!PROXY_KEYWORDS.has(entry) && !ADDRESS_PATTERN.test(entry)) {
      throw new Error(
        `TRUST_PROXY entry "${entry}" is not a keyword (${DEFAULT_TRUSTED_PROXIES.join(', ')}) or an address/CIDR`,
      );
    }
    if (MATCHES_EVERY_ADDRESS.test(entry) || UNSPECIFIED_ADDRESSES.has(entry)) {
      throw new Error(
        `TRUST_PROXY entry "${entry}" would trust every address, letting any client forge its own`,
      );
    }
  }
  return entries;
}

/** Human-readable form of the setting for the boot log. */
export function describeTrustProxy(setting: number | string[]): string {
  return Array.isArray(setting) ? setting.join(', ') : `${setting} hop(s)`;
}

/**
 * Client address as resolved by Express from the trusted proxies.
 * Requests with no resolvable address share a single bucket rather than escaping limits.
 */
export function clientIpOf(request: IpBearingRequest): string {
  return request.ip?.trim() || request.socket?.remoteAddress?.trim() || UNKNOWN_IP;
}

export const ClientIp = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  clientIpOf(context.switchToHttp().getRequest<IpBearingRequest>()),
);
