import { BadRequestException } from '@nestjs/common';
import { VerificationChannel, type PrismaClient } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { PrismaRateLimitStore } from '../rate-limit/prisma-rate-limit.store';
import { RateLimitConfig } from '../rate-limit/rate-limit.config';
import { RateLimitExceededException } from '../rate-limit/rate-limit-exceeded.exception';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestPrismaClient, describeWithDatabase } from '../test-support/database';
import { VerificationCodeService } from './verification-code.service';

const CHANNEL = VerificationChannel.email;

describeWithDatabase()('VerificationCodeService (database)', () => {
  let prisma: PrismaClient;
  let userId: string;
  const createdUserIds: string[] = [];

  function buildService(env: Record<string, string> = {}) {
    const config = { get: (key: string) => env[key] } as unknown as ConfigService;
    const store = new PrismaRateLimitStore(prisma as unknown as PrismaService);
    const rateLimit = new RateLimitService(store, new RateLimitConfig(config), config);
    return new VerificationCodeService(prisma as unknown as PrismaService, rateLimit);
  }

  /** Every test gets its own account, so counters and challenges never leak between cases. */
  async function createUser(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `rate-limit-${randomUUID()}@example.test`,
        role: 'buyer',
        passwordHash: 'not-used',
      },
      select: { id: true },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  beforeAll(async () => {
    prisma = createTestPrismaClient();
  });

  beforeEach(async () => {
    userId = await createUser();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.rateLimitCounter.deleteMany({
      where: { key: { startsWith: 'verification.' } },
    });
    await prisma.$disconnect();
  });

  describe('issuing', () => {
    it('stores only a hash of the code', async () => {
      const service = buildService();
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });

      const stored = await prisma.verificationCode.findFirstOrThrow({ where: { userId } });
      expect(code).toMatch(/^\d{6}$/);
      expect(stored.codeHash).not.toContain(code);
      expect(stored.codeHash).toBe(createHash('sha256').update(code).digest('hex'));
      expect(stored.attempts).toBe(0);
    });

    it('retires the previous challenge so only one code is ever guessable', async () => {
      const service = buildService({ RATE_LIMIT_CODE_SEND_COOLDOWN_SEC: '1' });
      const first = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });
      await wait(1100);
      await service.issue({ userId, channel: CHANNEL, destination: 'user@example.test' });

      const active = await prisma.verificationCode.count({
        where: { userId, channel: CHANNEL, consumedAt: null, invalidatedAt: null },
      });
      expect(active).toBe(1);

      await expect(
        service.consume({ userId, channel: CHANNEL, code: first }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('holds the caller to the cooldown between codes', async () => {
      const service = buildService({ RATE_LIMIT_CODE_SEND_COOLDOWN_SEC: '60' });
      await service.issue({ userId, channel: CHANNEL, destination: 'user@example.test' });

      await expect(
        service.issue({ userId, channel: CHANNEL, destination: 'user@example.test' }),
      ).rejects.toBeInstanceOf(RateLimitExceededException);
    });

    it('caps how many codes one account can request per window', async () => {
      const service = buildService({
        RATE_LIMIT_CODE_SEND_COOLDOWN_SEC: '1',
        RATE_LIMIT_CODE_SEND_MAX: '2',
      });

      await service.issue({ userId, channel: CHANNEL, destination: 'user@example.test' });
      await wait(1100);
      await service.issue({ userId, channel: CHANNEL, destination: 'user@example.test' });
      await wait(1100);

      await expect(
        service.issue({ userId, channel: CHANNEL, destination: 'user@example.test' }),
      ).rejects.toBeInstanceOf(RateLimitExceededException);
    });

    it('caps how many codes one address can trigger across accounts', async () => {
      const service = buildService({
        RATE_LIMIT_CODE_SEND_COOLDOWN_SEC: '1',
        RATE_LIMIT_CODE_SEND_IP_MAX: '2',
      });
      const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;

      await service.issue({
        userId: await createUser(),
        channel: CHANNEL,
        destination: 'a@example.test',
        ip,
      });
      await service.issue({
        userId: await createUser(),
        channel: CHANNEL,
        destination: 'b@example.test',
        ip,
      });

      await expect(
        service.issue({
          userId: await createUser(),
          channel: CHANNEL,
          destination: 'c@example.test',
          ip,
        }),
      ).rejects.toBeInstanceOf(RateLimitExceededException);
    });

    it('counts each channel separately', async () => {
      const service = buildService({ RATE_LIMIT_CODE_SEND_COOLDOWN_SEC: '60' });
      await service.issue({ userId, channel: CHANNEL, destination: 'user@example.test' });

      await expect(
        service.issue({
          userId,
          channel: VerificationChannel.accountDeletion,
          destination: 'user@example.test',
        }),
      ).resolves.toMatch(/^\d{6}$/);
    });
  });

  describe('consuming', () => {
    it('accepts the correct code once', async () => {
      const service = buildService();
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });

      await expect(service.consume({ userId, channel: CHANNEL, code })).resolves.toMatchObject({
        destination: 'user@example.test',
      });

      const stored = await prisma.verificationCode.findFirstOrThrow({ where: { userId } });
      expect(stored.consumedAt).not.toBeNull();
    });

    it('refuses a replay of a code that already worked', async () => {
      const service = buildService();
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });
      await service.consume({ userId, channel: CHANNEL, code });

      await expect(
        service.consume({ userId, channel: CHANNEL, code }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('charges an attempt for every wrong guess', async () => {
      const service = buildService();
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });

      await expect(
        service.consume({ userId, channel: CHANNEL, code: wrongCode(code) }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const stored = await prisma.verificationCode.findFirstOrThrow({ where: { userId } });
      expect(stored.attempts).toBe(1);
      expect(stored.consumedAt).toBeNull();
    });

    it('kills the challenge after the configured number of failures', async () => {
      const service = buildService({ RATE_LIMIT_CODE_MAX_ATTEMPTS: '5' });
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await expect(
          service.consume({ userId, channel: CHANNEL, code: wrongCode(code) }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }

      // Sixth try: even the real code is worthless now.
      await expect(service.consume({ userId, channel: CHANNEL, code })).rejects.toBeInstanceOf(
        RateLimitExceededException,
      );

      const stored = await prisma.verificationCode.findFirstOrThrow({ where: { userId } });
      expect(stored.attempts).toBe(5);
      expect(stored.consumedAt).toBeNull();
    });

    it('still accepts the correct code on the last allowed attempt', async () => {
      const service = buildService({ RATE_LIMIT_CODE_MAX_ATTEMPTS: '3' });
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });

      await service
        .consume({ userId, channel: CHANNEL, code: wrongCode(code) })
        .catch(() => undefined);
      await service
        .consume({ userId, channel: CHANNEL, code: wrongCode(code) })
        .catch(() => undefined);

      await expect(service.consume({ userId, channel: CHANNEL, code })).resolves.toBeDefined();
    });

    it('holds the attempt cap when guesses arrive together', async () => {
      const maxAttempts = 5;
      const service = buildService({ RATE_LIMIT_CODE_MAX_ATTEMPTS: String(maxAttempts) });
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });

      const results = await Promise.allSettled(
        Array.from({ length: 40 }, () =>
          service.consume({ userId, channel: CHANNEL, code: wrongCode(code) }),
        ),
      );

      expect(results.every((result) => result.status === 'rejected')).toBe(true);

      // 40 parallel guesses must still consume exactly the configured budget.
      const stored = await prisma.verificationCode.findFirstOrThrow({ where: { userId } });
      expect(stored.attempts).toBe(maxAttempts);

      await expect(service.consume({ userId, channel: CHANNEL, code })).rejects.toBeInstanceOf(
        RateLimitExceededException,
      );
    });

    it('lets only one of several simultaneous correct guesses through', async () => {
      const service = buildService();
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });

      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => service.consume({ userId, channel: CHANNEL, code })),
      );

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    });

    it('rejects an expired code', async () => {
      const service = buildService();
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });
      await prisma.verificationCode.updateMany({
        where: { userId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(
        service.consume({ userId, channel: CHANNEL, code }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a code issued for another account', async () => {
      const service = buildService();
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });
      const stranger = await createUser();

      await expect(
        service.consume({ userId: stranger, channel: CHANNEL, code }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a code issued for another channel', async () => {
      const service = buildService();
      const code = await service.issue({
        userId,
        channel: VerificationChannel.accountDeletion,
        destination: 'user@example.test',
      });

      await expect(
        service.consume({ userId, channel: CHANNEL, code }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects malformed input without touching the challenge', async () => {
      const service = buildService();
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });

      for (const input of ['', '12345', '1234567', 'abcdef', '12 34 56']) {
        await expect(
          service.consume({ userId, channel: CHANNEL, code: input }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }

      const stored = await prisma.verificationCode.findFirstOrThrow({ where: { userId } });
      expect(stored.attempts).toBe(0);
      await expect(service.consume({ userId, channel: CHANNEL, code })).resolves.toBeDefined();
    });

    it('caps confirmation attempts per account even across fresh codes', async () => {
      const service = buildService({
        RATE_LIMIT_CODE_MAX_ATTEMPTS: '2',
        RATE_LIMIT_CODE_CONFIRM_MAX: '3',
        RATE_LIMIT_CODE_SEND_COOLDOWN_SEC: '1',
      });
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await service
          .consume({ userId, channel: CHANNEL, code: wrongCode(code) })
          .catch(() => undefined);
      }

      // A brand-new challenge does not buy a fresh confirmation budget.
      await wait(1100);
      const replacement = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });
      await expect(
        service.consume({ userId, channel: CHANNEL, code: replacement }),
      ).rejects.toBeInstanceOf(RateLimitExceededException);
    });

    it('caps confirmation attempts per address across accounts', async () => {
      const service = buildService({
        RATE_LIMIT_CODE_CONFIRM_MAX: '50',
        RATE_LIMIT_CODE_CONFIRM_IP_MAX: '2',
      });
      const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
      const victims = [await createUser(), await createUser(), await createUser()];
      for (const victim of victims) {
        await service.issue({
          userId: victim,
          channel: CHANNEL,
          destination: 'user@example.test',
        });
      }

      await service
        .consume({ userId: victims[0], channel: CHANNEL, code: '000000', ip })
        .catch(() => undefined);
      await service
        .consume({ userId: victims[1], channel: CHANNEL, code: '000000', ip })
        .catch(() => undefined);

      await expect(
        service.consume({ userId: victims[2], channel: CHANNEL, code: '000000', ip }),
      ).rejects.toBeInstanceOf(RateLimitExceededException);
    });

    it('gives the account its confirmation budget back after a success', async () => {
      const service = buildService({
        RATE_LIMIT_CODE_CONFIRM_MAX: '3',
        RATE_LIMIT_CODE_SEND_COOLDOWN_SEC: '1',
      });
      const code = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });
      await service
        .consume({ userId, channel: CHANNEL, code: wrongCode(code) })
        .catch(() => undefined);
      await service.consume({ userId, channel: CHANNEL, code });

      await wait(1100);
      const next = await service.issue({
        userId,
        channel: CHANNEL,
        destination: 'user@example.test',
      });
      await expect(service.consume({ userId, channel: CHANNEL, code: next })).resolves.toBeDefined();
    });
  });
});

function wrongCode(code: string): string {
  const wrong = String((Number(code) % 900000) + 100000);
  return wrong === code ? '111111' : wrong;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
