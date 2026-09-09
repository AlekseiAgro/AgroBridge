import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RateLimitPolicy } from './rate-limit.types';

type PolicySpec = {
  /** Environment prefix; `<prefix>_MAX` and `<prefix>_WINDOW_SEC` override the defaults. */
  prefix: string;
  limit: number;
  windowSec: number;
  /** Hard ceiling, so a typo in the environment cannot switch the protection off. */
  maxLimit: number;
};

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/**
 * Security defaults. They are deliberately generous enough for a human who mistypes a
 * password or asks for a second code, and far too tight for automated guessing.
 */
const SPECS = {
  loginPerAccount: {
    prefix: 'RATE_LIMIT_LOGIN',
    limit: 5,
    windowSec: 15 * MINUTE,
    maxLimit: 50,
  },
  loginPerIp: {
    prefix: 'RATE_LIMIT_LOGIN_IP',
    limit: 30,
    windowSec: 15 * MINUTE,
    maxLimit: 500,
  },
  registerPerIp: {
    prefix: 'RATE_LIMIT_REGISTER_IP',
    limit: 10,
    windowSec: HOUR,
    maxLimit: 200,
  },
  codeSendPerAccount: {
    prefix: 'RATE_LIMIT_CODE_SEND',
    limit: 3,
    windowSec: HOUR,
    maxLimit: 20,
  },
  codeSendPerIp: {
    prefix: 'RATE_LIMIT_CODE_SEND_IP',
    limit: 10,
    windowSec: HOUR,
    maxLimit: 200,
  },
  codeConfirmPerAccount: {
    prefix: 'RATE_LIMIT_CODE_CONFIRM',
    limit: 10,
    windowSec: 15 * MINUTE,
    maxLimit: 50,
  },
  codeConfirmPerIp: {
    prefix: 'RATE_LIMIT_CODE_CONFIRM_IP',
    limit: 30,
    windowSec: 15 * MINUTE,
    maxLimit: 500,
  },
  supportPerIp: {
    prefix: 'RATE_LIMIT_SUPPORT_IP',
    limit: 5,
    windowSec: 15 * MINUTE,
    maxLimit: 100,
  },
  supportPerEmail: {
    prefix: 'RATE_LIMIT_SUPPORT_EMAIL',
    limit: 10,
    windowSec: HOUR,
    maxLimit: 100,
  },
  passwordResetRequestPerEmail: {
    prefix: 'RATE_LIMIT_PASSWORD_RESET',
    limit: 3,
    windowSec: HOUR,
    maxLimit: 20,
  },
  passwordResetRequestPerIp: {
    prefix: 'RATE_LIMIT_PASSWORD_RESET_IP',
    limit: 10,
    windowSec: HOUR,
    maxLimit: 200,
  },
  passwordResetConsumePerIp: {
    prefix: 'RATE_LIMIT_PASSWORD_RESET_CONSUME',
    limit: 30,
    windowSec: 15 * MINUTE,
    maxLimit: 500,
  },
  passwordChangePerAccount: {
    prefix: 'RATE_LIMIT_PASSWORD_CHANGE',
    limit: 5,
    windowSec: 15 * MINUTE,
    maxLimit: 50,
  },
} satisfies Record<string, PolicySpec>;

const CODE_SEND_COOLDOWN_SEC_DEFAULT = 60;
const PASSWORD_RESET_REQUEST_COOLDOWN_SEC_DEFAULT = 60;
const CODE_MAX_ATTEMPTS_DEFAULT = 5;
/** A six-digit code must never tolerate many guesses, whatever the environment says. */
const CODE_MAX_ATTEMPTS_CEILING = 10;

type PolicyName = keyof typeof SPECS;

@Injectable()
export class RateLimitConfig {
  private readonly policies: Record<PolicyName, RateLimitPolicy>;
  /** Minimum delay between two verification codes for the same account. */
  readonly codeSendCooldown: RateLimitPolicy;
  /** Minimum delay between two password-reset emails for the same address. */
  readonly passwordResetRequestCooldown: RateLimitPolicy;
  /** Failed guesses tolerated by a single verification challenge before it dies. */
  readonly codeMaxAttempts: number;

  constructor(private readonly config: ConfigService) {
    this.policies = Object.fromEntries(
      Object.entries(SPECS).map(([name, spec]) => [name, this.readPolicy(spec)]),
    ) as Record<PolicyName, RateLimitPolicy>;

    const cooldownSec = this.readInt(
      'RATE_LIMIT_CODE_SEND_COOLDOWN_SEC',
      CODE_SEND_COOLDOWN_SEC_DEFAULT,
      1,
      HOUR,
    );
    this.codeSendCooldown = { limit: 1, windowMs: cooldownSec * 1000 };
    const resetCooldownSec = this.readInt(
      'RATE_LIMIT_PASSWORD_RESET_COOLDOWN_SEC',
      PASSWORD_RESET_REQUEST_COOLDOWN_SEC_DEFAULT,
      1,
      HOUR,
    );
    this.passwordResetRequestCooldown = { limit: 1, windowMs: resetCooldownSec * 1000 };
    this.codeMaxAttempts = this.readInt(
      'RATE_LIMIT_CODE_MAX_ATTEMPTS',
      CODE_MAX_ATTEMPTS_DEFAULT,
      1,
      CODE_MAX_ATTEMPTS_CEILING,
    );
  }

  policy(name: PolicyName): RateLimitPolicy {
    return this.policies[name];
  }

  /** Human-readable summary for the boot log; contains no secrets. */
  describe(): string {
    const parts = Object.keys(this.policies).map((name) => {
      const policy = this.policies[name as PolicyName];
      return `${name}=${policy.limit}/${Math.round(policy.windowMs / 1000)}s`;
    });
    parts.push(`codeSendCooldown=${Math.round(this.codeSendCooldown.windowMs / 1000)}s`);
    parts.push(
      `passwordResetRequestCooldown=${Math.round(this.passwordResetRequestCooldown.windowMs / 1000)}s`,
    );
    parts.push(`codeMaxAttempts=${this.codeMaxAttempts}`);
    return parts.join(' ');
  }

  private readPolicy(spec: PolicySpec): RateLimitPolicy {
    const limit = this.readInt(`${spec.prefix}_MAX`, spec.limit, 1, spec.maxLimit);
    const windowSec = this.readInt(`${spec.prefix}_WINDOW_SEC`, spec.windowSec, 1, 24 * HOUR);
    return { limit, windowMs: windowSec * 1000 };
  }

  private readInt(name: string, fallback: number, min: number, max: number): number {
    const raw = this.config.get<string>(name)?.trim();
    if (!raw) {
      return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(`${name} must be an integer between ${min} and ${max} (got "${raw}")`);
    }
    return parsed;
  }
}
