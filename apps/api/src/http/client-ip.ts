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

type IpBearingRequest = {
  ip?: string;
  socket?: { remoteAddress?: string | null } | null;
};

/**
 * Express `trust proxy` setting: which `X-Forwarded-For` entries may be believed.
 *
 * The header is attacker-controlled, so only entries appended by infrastructure we run
 * count. Requests reach the API two ways — straight from the browser through Caddy or the
 * Railway edge, and relayed by the Next.js BFF routes, which add a hop — so the default is
 * a trust *list* rather than a hop count: walking the chain from the right and skipping our
 * own addresses resolves the real visitor in both cases. A hostile client cannot exploit
 * this because the closest proxy always appends the true peer address last.
 *
 * `TRUST_PROXY` overrides it, taking either a hop count (`1`) or a comma-separated list of
 * keywords and addresses (`loopback,uniquelocal,203.0.113.7`). Add the web tier's egress
 * address when it reaches the API over a public route (for example on Railway), otherwise
 * every visitor arriving through a BFF route shares one bucket.
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
