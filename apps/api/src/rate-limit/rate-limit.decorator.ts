import { SetMetadata } from '@nestjs/common';
import type { EndpointPolicyName } from './rate-limit.config';

export const RATE_LIMIT_POLICY = 'rateLimitPolicy';

/**
 * Throttles one route under the named policy. Costly or fan-out operations only: an
 * indiscriminate limit on every endpoint throttles honest browsing without making anything
 * safer.
 *
 * Requires `RateLimitGuard` on the route, declared *after* the authentication guard so the
 * counter can be keyed to the account rather than to a shared NAT address.
 */
export const RateLimit = (policy: EndpointPolicyName) => SetMetadata(RATE_LIMIT_POLICY, policy);
