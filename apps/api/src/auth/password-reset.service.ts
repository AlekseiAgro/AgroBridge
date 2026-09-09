import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UNKNOWN_IP } from '../http/client-ip';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService, type RateLimitRequest } from '../rate-limit/rate-limit.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  PASSWORD_RESET_TTL_SEC_DEFAULT,
  PASSWORD_RESET_TTL_SEC_MAX,
  PASSWORD_RESET_TTL_SEC_MIN,
  RESET_INVALID_MESSAGE,
} from './password-reset.constants';

const BCRYPT_ROUNDS = 12;
const TOKEN_BYTES = 32;

export type ForgotPasswordResult = { ok: true };
export type ResetPasswordResult = { ok: true };

/**
 * Password-reset challenges are high-entropy opaque tokens. Only SHA-256(token) is stored.
 * The raw token exists in the email link and is never returned over the API or written to logs.
 */
@Injectable()
export class PasswordResetService {
  private readonly ttlMs: number;
  readonly expiresMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    const ttlSec = readBoundedInt(
      config.get<string>('PASSWORD_RESET_TTL_SEC'),
      PASSWORD_RESET_TTL_SEC_DEFAULT,
      PASSWORD_RESET_TTL_SEC_MIN,
      PASSWORD_RESET_TTL_SEC_MAX,
      'PASSWORD_RESET_TTL_SEC',
    );
    this.ttlMs = ttlSec * 1000;
    this.expiresMinutes = Math.max(1, Math.round(ttlSec / 60));
  }

  /**
   * Always returns the same body. Rate limits are charged before the account lookup so a
   * missing address still costs quota and cannot be distinguished via 429 vs 200.
   */
  async requestReset(dto: ForgotPasswordDto, ip?: string | null): Promise<ForgotPasswordResult> {
    const email = dto.email.trim().toLowerCase();
    await this.rateLimit.consume(this.requestRules(ip, email));

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        locale: true,
        displayName: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      return { ok: true };
    }

    const rawToken = await this.issueChallenge(user.id);
    void this.notifications
      .notifyPasswordReset({
        email: user.email,
        locale: user.locale,
        displayName: user.displayName,
        rawToken,
        expiresMinutes: this.expiresMinutes,
      })
      .catch(() => undefined);

    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto, ip?: string | null): Promise<ResetPasswordResult> {
    await this.rateLimit.consume(this.consumeRules(ip));

    const claimed = await this.claimToken(hashToken(dto.token.trim()));
    if (!claimed) {
      throw new BadRequestException(RESET_INVALID_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: claimed.userId },
        data: {
          passwordHash,
          authVersion: { increment: 1 },
        },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: claimed.userId,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: { invalidatedAt: now },
      }),
    ]);

    return { ok: true };
  }

  /**
   * Issues a fresh challenge and retires any earlier unused one for the same account, so an
   * old email cannot remain a second independent reset path.
   */
  private async issueChallenge(userId: string): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');
      const tokenHash = hashToken(rawToken);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.ttlMs);
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.passwordResetToken.updateMany({
            where: { userId, consumedAt: null, invalidatedAt: null },
            data: { invalidatedAt: now },
          });
          await tx.passwordResetToken.create({
            data: { userId, tokenHash, expiresAt },
          });
        });
        return rawToken;
      } catch (error) {
        if (isUniqueViolation(error)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Could not issue reset token');
  }

  /**
   * Marks the matching unexpired challenge consumed in one statement. Concurrent redeemers
   * of the same token serialize on the row; only one UPDATE returns a row.
   */
  private async claimToken(tokenHash: string): Promise<{ id: string; userId: string } | null> {
    const rows = await this.prisma.$queryRaw<{ id: string; userId: string }[]>`
      UPDATE "password_reset_tokens"
      SET "consumedAt" = NOW()
      WHERE "tokenHash" = ${tokenHash}
        AND "consumedAt" IS NULL
        AND "invalidatedAt" IS NULL
        AND "expiresAt" > NOW()
      RETURNING "id", "userId"
    `;
    return rows[0] ?? null;
  }

  private requestRules(ip: string | null | undefined, email: string): RateLimitRequest[] {
    return [
      {
        action: 'auth.password-reset.request.email',
        scope: { email },
        ...this.rateLimit.limits.policy('passwordResetRequestPerEmail'),
      },
      {
        action: 'auth.password-reset.request.ip',
        scope: { ip: ip ?? UNKNOWN_IP },
        ...this.rateLimit.limits.policy('passwordResetRequestPerIp'),
      },
      {
        action: 'auth.password-reset.request.cooldown',
        scope: { email },
        ...this.rateLimit.limits.passwordResetRequestCooldown,
      },
    ];
  }

  private consumeRules(ip: string | null | undefined): RateLimitRequest[] {
    return [
      {
        action: 'auth.password-reset.consume.ip',
        scope: { ip: ip ?? UNKNOWN_IP },
        ...this.rateLimit.limits.policy('passwordResetConsumePerIp'),
      },
    ];
  }
}

export function hashPasswordResetToken(raw: string): string {
  return hashToken(raw);
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function readBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return fallback;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max} (got "${raw}")`);
  }
  return parsed;
}
