import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { RateLimitConfig } from './rate-limit.config';
import { RateLimitExceededException } from './rate-limit-exceeded.exception';
import { RATE_LIMIT_STORE, type RateLimitPolicy, type RateLimitStore } from './rate-limit.types';

/** Identifies who is being counted. Every provided part becomes a component of the key. */
export type RateLimitScope = {
  ip?: string | null;
  email?: string | null;
  account?: string | null;
  channel?: string | null;
};

export type RateLimitRequest = RateLimitPolicy & {
  /** Stable name of the protected operation, e.g. `auth.login`. */
  action: string;
  scope: RateLimitScope;
};

/** Emails are user input: normalise case/whitespace so `A@x.io ` and `a@x.io` share a bucket. */
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, 320);
}

/** `::ffff:1.2.3.4` and `1.2.3.4` are the same client; zone ids are noise. */
function normalizeIp(value: string): string {
  const trimmed = value.trim().toLowerCase().split('%')[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(trimmed);
  return (mapped ? mapped[1] : trimmed).slice(0, 64) || 'unknown';
}

@Injectable()
export class RateLimitService {
  private readonly keySecret: string;

  constructor(
    @Inject(RATE_LIMIT_STORE) private readonly store: RateLimitStore,
    readonly limits: RateLimitConfig,
    config: ConfigService,
  ) {
    this.keySecret =
      config.get<string>('RATE_LIMIT_KEY_SECRET')?.trim() ||
      config.get<string>('JWT_SECRET')?.trim() ||
      'dev-only-rate-limit-key';
  }

  /**
   * Records one hit against every rule and throws 429 as soon as one of them is exhausted.
   * Rules are consumed even when a later rule rejects the request; that only ever makes the
   * protection stricter for a caller who is already being throttled.
   */
  async consume(rules: RateLimitRequest[]): Promise<void> {
    for (const rule of rules) {
      const hit = await this.store.hit(this.keyFor(rule), rule.windowMs);
      if (hit.count > rule.limit) {
        throw new RateLimitExceededException(retryAfterSeconds(hit.expiresAt));
      }
    }
  }

  /** Clears counters after a legitimate success, so honest users are never locked out. */
  async reset(rules: RateLimitRequest[]): Promise<void> {
    await Promise.all(rules.map((rule) => this.store.reset(this.keyFor(rule))));
  }

  /**
   * Keys are HMAC digests rather than readable strings: the counter table would otherwise
   * become a log of which email addresses tried to sign in from which IP.
   */
  private keyFor(rule: RateLimitRequest): string {
    const parts: string[] = [];
    if (rule.scope.ip != null) parts.push(`ip=${normalizeIp(rule.scope.ip)}`);
    if (rule.scope.email != null) parts.push(`email=${normalizeEmail(rule.scope.email)}`);
    if (rule.scope.account != null) parts.push(`account=${rule.scope.account}`);
    if (rule.scope.channel != null) parts.push(`channel=${rule.scope.channel}`);

    const digest = createHmac('sha256', this.keySecret)
      .update(`${rule.action}|${parts.join('|')}`)
      .digest('base64url');
    return `${rule.action}:${digest}`;
  }
}

function retryAfterSeconds(expiresAt: Date): number {
  return Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
}
