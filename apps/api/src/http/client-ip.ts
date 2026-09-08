import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Guards against an absurd value silently trusting the whole `X-Forwarded-For` chain. */
const MAX_TRUST_PROXY_HOPS = 10;

/** Shared bucket for callers whose address cannot be resolved. */
export const UNKNOWN_IP = 'unknown';

type IpBearingRequest = {
  ip?: string;
  socket?: { remoteAddress?: string | null } | null;
};

/**
 * Number of reverse proxies in front of the API, used as Express' `trust proxy` setting.
 *
 * `X-Forwarded-For` is attacker-controlled, so only the entries appended by proxies we
 * actually run may be trusted. One hop matches both supported deployments (Caddy in
 * `deploy/Caddyfile` and the Railway edge). Add a hop for every extra proxy — with
 * Cloudflare proxying enabled in front of Caddy the correct value is 2. Too low a value
 * groups many clients behind one bucket (limits get stricter); too high a value lets a
 * client forge its own address, so the default errs on the low side.
 */
export function resolveTrustProxyHops(env: NodeJS.ProcessEnv): number {
  const raw = env.TRUST_PROXY_HOPS?.trim();
  if (!raw) {
    return env.NODE_ENV === 'production' ? 1 : 0;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_TRUST_PROXY_HOPS) {
    throw new Error(
      `TRUST_PROXY_HOPS must be an integer between 0 and ${MAX_TRUST_PROXY_HOPS} (got "${raw}")`,
    );
  }
  return parsed;
}

/**
 * Client address as resolved by Express from the configured number of trusted hops.
 * Requests with no resolvable address share a single bucket rather than escaping limits.
 */
export function clientIpOf(request: IpBearingRequest): string {
  return request.ip?.trim() || request.socket?.remoteAddress?.trim() || UNKNOWN_IP;
}

export const ClientIp = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  clientIpOf(context.switchToHttp().getRequest<IpBearingRequest>()),
);
