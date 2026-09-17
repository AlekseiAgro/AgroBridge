import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { clientIpOf } from '../http/client-ip';
import type { EndpointPolicyName } from './rate-limit.config';
import { RATE_LIMIT_POLICY } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

type ThrottledRequest = {
  ip?: string;
  socket?: { remoteAddress?: string | null } | null;
  user?: { id?: string } | null;
};

/**
 * Applies the `@RateLimit` policy of the route it guards. Routes without the decorator pass
 * straight through, so adding the guard to a controller does not silently throttle its
 * reads.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<EndpointPolicyName | undefined>(
      RATE_LIMIT_POLICY,
      [context.getHandler(), context.getClass()],
    );
    if (!policy) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ThrottledRequest>();
    const account = request.user?.id;
    await this.rateLimit.consume([
      {
        action: `endpoint.${policy}`,
        // Every throttled route sits behind authentication, so the account is the honest
        // identity. The address is only a fallback, and a shared one: an office NAT must
        // not be able to exhaust a limit meant for a single abuser.
        scope: account ? { account } : { ip: clientIpOf(request) },
        ...this.rateLimit.limits.policy(policy),
      },
    ]);
    return true;
  }
}
