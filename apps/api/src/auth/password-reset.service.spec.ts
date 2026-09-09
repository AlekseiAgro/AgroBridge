import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitExceededException } from '../rate-limit/rate-limit-exceeded.exception';
import { createTestRateLimit } from '../rate-limit/rate-limit.test-utils';
import { PasswordResetService } from './password-reset.service';
import { RESET_INVALID_MESSAGE } from './password-reset.constants';

describe('PasswordResetService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'prt_1' }),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const notifications = {
    notifyPasswordReset: jest.fn().mockResolvedValue(undefined),
  };

  function buildService(env: Record<string, string> = {}) {
    const { service: rateLimit } = createTestRateLimit(env);
    const config = { get: (key: string) => env[key] } as unknown as ConfigService;
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return undefined;
    });
    return new PasswordResetService(prisma as never, rateLimit, notifications as never, config);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.create.mockResolvedValue({ id: 'prt_1' });
  });

  describe('requestReset', () => {
    it('returns the same body for existing and missing accounts', async () => {
      const service = buildService();
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const missing = await service.requestReset({ email: 'nobody@example.com' }, '203.0.113.1');

      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user_1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Nino',
        passwordHash: 'hash',
      });
      const existing = await service.requestReset({ email: 'farmer@example.com' }, '203.0.113.2');

      expect(missing).toEqual({ ok: true });
      expect(existing).toEqual({ ok: true });
      expect(JSON.stringify(missing)).toBe(JSON.stringify(existing));
    });

    it('does not send mail or store a token when the account does not exist', async () => {
      const service = buildService();
      prisma.user.findUnique.mockResolvedValue(null);

      await service.requestReset({ email: 'nobody@example.com' }, '203.0.113.1');

      expect(notifications.notifyPasswordReset).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('does not put the raw token in the API response', async () => {
      const service = buildService();
      prisma.user.findUnique.mockResolvedValue({
        id: 'user_1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Nino',
        passwordHash: 'hash',
      });

      const result = await service.requestReset({ email: 'farmer@example.com' }, '203.0.113.1');
      const mailed = notifications.notifyPasswordReset.mock.calls[0][0] as { rawToken: string };

      expect(result).toEqual({ ok: true });
      expect(JSON.stringify(result)).not.toContain(mailed.rawToken);
      expect(mailed.rawToken.length).toBeGreaterThanOrEqual(40);
    });

    it('treats email casing and padding as the same rate-limit bucket', async () => {
      const service = buildService({ RATE_LIMIT_PASSWORD_RESET_MAX: '1' });
      prisma.user.findUnique.mockResolvedValue(null);

      await service.requestReset({ email: 'Victim@Example.com' }, '203.0.113.1');

      await expect(
        service.requestReset({ email: ' victim@example.com ' }, '203.0.113.1'),
      ).rejects.toBeInstanceOf(RateLimitExceededException);
    });

    it('caps spraying across many addresses from one IP', async () => {
      const service = buildService({
        RATE_LIMIT_PASSWORD_RESET_IP_MAX: '3',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      for (let i = 0; i < 3; i += 1) {
        await service.requestReset({ email: `user${i}@example.com` }, '10.0.0.7');
      }

      await expect(
        service.requestReset({ email: 'user99@example.com' }, '10.0.0.7'),
      ).rejects.toBeInstanceOf(RateLimitExceededException);
    });

    it('does not let rotating IPs bypass the per-email budget', async () => {
      const service = buildService({
        RATE_LIMIT_PASSWORD_RESET_MAX: '1',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await service.requestReset({ email: 'victim@example.com' }, '198.51.100.1');

      await expect(
        service.requestReset({ email: 'victim@example.com' }, '198.51.100.3'),
      ).rejects.toBeInstanceOf(RateLimitExceededException);
    });
  });

  describe('resetPassword', () => {
    it('rejects an unknown token with a generic error', async () => {
      const service = buildService();
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.resetPassword({ token: 'a'.repeat(32), password: 'newpass12' }, '203.0.113.1'),
      ).rejects.toMatchObject({
        constructor: BadRequestException,
        message: RESET_INVALID_MESSAGE,
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
