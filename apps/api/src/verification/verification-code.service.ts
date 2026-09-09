import { BadRequestException, Injectable } from '@nestjs/common';
import { VerificationChannel } from '@prisma/client';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitExceededException } from '../rate-limit/rate-limit-exceeded.exception';
import { RateLimitService, type RateLimitRequest } from '../rate-limit/rate-limit.service';

export const CODE_TTL_MS = 10 * 60 * 1000;

const CODE_PATTERN = /^\d{6}$/;

type ActiveChallenge = {
  id: string;
  codeHash: string;
  destination: string;
  attempts: number;
};

export type ConsumedCode = {
  id: string;
  destination: string;
};

/**
 * Single owner of the verification-code lifecycle for every channel (email, SMS, email
 * change, account deletion). Issuing and consuming both go through here so that no flow can
 * be added later that skips the send limits or the per-challenge attempt cap.
 *
 * Codes are six digits, which is only safe because the number of guesses is finite: each
 * challenge dies after a handful of failures, only one challenge is ever active per channel,
 * and replacing a dead challenge costs a send from a small hourly budget.
 */
@Injectable()
export class VerificationCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /**
   * Issues a fresh code and invalidates any earlier challenge for the same channel, so an
   * attacker cannot keep several challenges alive and spread guesses across them.
   * Returns the plaintext code for delivery; only its hash is persisted.
   */
  async issue(params: {
    userId: string;
    channel: VerificationChannel;
    destination: string;
    ip?: string | null;
  }): Promise<string> {
    await this.rateLimit.consume(this.sendRules(params.userId, params.channel, params.ip));

    const code = String(randomInt(100000, 1000000));
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.verificationCode.updateMany({
        where: {
          userId: params.userId,
          channel: params.channel,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: { invalidatedAt: now },
      }),
      this.prisma.verificationCode.create({
        data: {
          userId: params.userId,
          channel: params.channel,
          destination: params.destination,
          codeHash: hashCode(code),
          expiresAt: new Date(now.getTime() + CODE_TTL_MS),
        },
      }),
    ]);

    return code;
  }

  /**
   * Checks one guess against the active challenge and consumes it on success.
   * Throws for every failure mode; callers only ever see a consumed challenge.
   */
  async consume(params: {
    userId: string;
    channel: VerificationChannel;
    code: string;
    ip?: string | null;
    /** Message used for malformed or wrong codes; wording differs between flows. */
    invalidMessage?: string;
  }): Promise<ConsumedCode> {
    const invalidMessage = params.invalidMessage ?? 'Invalid or expired verification code';
    const trimmed = params.code.trim();
    if (!CODE_PATTERN.test(trimmed)) {
      throw new BadRequestException('Enter the 6-digit verification code');
    }

    await this.rateLimit.consume(this.confirmRules(params.userId, params.channel, params.ip));

    const challenge = await this.claimAttempt(params.userId, params.channel);
    if (!challenge) {
      await this.assertNotAttemptLimited(params.userId, params.channel);
      throw new BadRequestException(invalidMessage);
    }

    if (!hashesMatch(challenge.codeHash, hashCode(trimmed))) {
      throw new BadRequestException(invalidMessage);
    }

    const consumed = await this.markConsumed(challenge.id);
    if (!consumed) {
      // Another concurrent request consumed the very same challenge first.
      throw new BadRequestException(invalidMessage);
    }

    await this.rateLimit.reset([this.confirmAccountRule(params.userId, params.channel)]);

    return { id: challenge.id, destination: challenge.destination };
  }

  /**
   * Atomically books one guess against the newest usable challenge. The predicates are
   * repeated outside the sub-select on purpose: Postgres re-evaluates the outer `WHERE`
   * against the latest row version when two statements collide, so concurrent requests
   * queue up and the attempt cap holds instead of every racer reading `attempts = 0`.
   */
  private async claimAttempt(
    userId: string,
    channel: VerificationChannel,
  ): Promise<ActiveChallenge | null> {
    const maxAttempts = this.rateLimit.limits.codeMaxAttempts;
    const rows = await this.prisma.$queryRaw<ActiveChallenge[]>`
      UPDATE "verification_codes"
      SET "attempts" = "attempts" + 1
      WHERE "id" = (
        SELECT "id" FROM "verification_codes"
        WHERE "userId" = ${userId}
          AND "channel" = ${channel}::"VerificationChannel"
          AND "consumedAt" IS NULL
          AND "invalidatedAt" IS NULL
          AND "expiresAt" > NOW()
          AND "attempts" < ${maxAttempts}
        ORDER BY "createdAt" DESC
        LIMIT 1
      )
        AND "consumedAt" IS NULL
        AND "invalidatedAt" IS NULL
        AND "expiresAt" > NOW()
        AND "attempts" < ${maxAttempts}
      RETURNING "id", "codeHash", "destination", "attempts"
    `;
    return rows[0] ?? null;
  }

  private async markConsumed(id: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE "verification_codes"
      SET "consumedAt" = NOW()
      WHERE "id" = ${id} AND "consumedAt" IS NULL
      RETURNING "id"
    `;
    return rows.length > 0;
  }

  /**
   * Tells a locked-out challenge apart from a plain wrong code, so the user is told to ask
   * for a new one instead of guessing forever. Only reachable by the account owner, so it
   * discloses nothing to a third party.
   */
  private async assertNotAttemptLimited(
    userId: string,
    channel: VerificationChannel,
  ): Promise<void> {
    const exhausted = await this.prisma.verificationCode.findFirst({
      where: {
        userId,
        channel,
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { gte: this.rateLimit.limits.codeMaxAttempts },
      },
      select: { id: true },
    });
    if (exhausted) {
      throw new RateLimitExceededException(
        Math.ceil(this.rateLimit.limits.codeSendCooldown.windowMs / 1000),
        'Too many incorrect attempts. Request a new code.',
      );
    }
  }

  private sendRules(
    userId: string,
    channel: VerificationChannel,
    ip?: string | null,
  ): RateLimitRequest[] {
    const rules: RateLimitRequest[] = [
      {
        action: 'verification.send.cooldown',
        scope: { account: userId, channel },
        ...this.rateLimit.limits.codeSendCooldown,
      },
      {
        action: 'verification.send.account',
        scope: { account: userId, channel },
        ...this.rateLimit.limits.policy('codeSendPerAccount'),
      },
    ];
    if (ip) {
      rules.push({
        action: 'verification.send.ip',
        scope: { ip },
        ...this.rateLimit.limits.policy('codeSendPerIp'),
      });
    }
    return rules;
  }

  private confirmRules(
    userId: string,
    channel: VerificationChannel,
    ip?: string | null,
  ): RateLimitRequest[] {
    const rules: RateLimitRequest[] = [this.confirmAccountRule(userId, channel)];
    if (ip) {
      rules.push({
        action: 'verification.confirm.ip',
        scope: { ip },
        ...this.rateLimit.limits.policy('codeConfirmPerIp'),
      });
    }
    return rules;
  }

  private confirmAccountRule(userId: string, channel: VerificationChannel): RateLimitRequest {
    return {
      action: 'verification.confirm.account',
      scope: { account: userId, channel },
      ...this.rateLimit.limits.policy('codeConfirmPerAccount'),
    };
  }
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** Constant-time comparison so a wrong guess cannot be refined by timing the response. */
function hashesMatch(stored: string, candidate: string): boolean {
  const a = Buffer.from(stored, 'hex');
  const b = Buffer.from(candidate, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
