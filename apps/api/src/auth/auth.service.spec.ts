import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RateLimitExceededException } from '../rate-limit/rate-limit-exceeded.exception';
import { createTestRateLimit } from '../rate-limit/rate-limit.test-utils';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    rating: {
      aggregate: jest.fn().mockResolvedValue({
        _avg: { score: null },
        _count: { _all: 0 },
      }),
    },
    $transaction: jest.fn(),
  };

  const jwtService = {
    sign: jest.fn().mockReturnValue('test-token'),
  };

  const config = {
    get: jest.fn().mockReturnValue('7d'),
  };

  const notifications = {
    notifyWelcome: jest.fn().mockResolvedValue(undefined),
  };

  const verification = {
    sendEmailCode: jest.fn().mockResolvedValue({ sent: true, destination: 'farmer@example.com' }),
  };

  let service: AuthService;

  function buildService(env: Record<string, string> = {}) {
    const { service: rateLimit } = createTestRateLimit(env);
    return new AuthService(
      prisma as never,
      jwtService as unknown as JwtService,
      config as unknown as ConfigService,
      notifications as never,
      verification as never,
      rateLimit,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }
      return undefined;
    });
    service = buildService();
  });

  it('registers a farmer without seller/buyer subtypes', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user_1',
      email: 'farmer@example.com',
      role: 'farmer',
      sellerType: null,
      buyerType: null,
      locale: 'ka',
      displayName: 'Nino',
      passwordHash: 'hash',
      emailVerifiedAt: null,
    });

    const result = await service.register({
      email: 'Farmer@Example.com',
      password: 'password1',
      role: 'farmer',
      displayName: 'Nino',
      locale: 'ka',
    });

    expect(result.accessToken).toBe('test-token');
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user_1',
        email: 'farmer@example.com',
        ver: 0,
      }),
    );
    expect(result.user).toEqual({
      id: 'user_1',
      email: 'farmer@example.com',
      role: 'farmer',
      sellerType: null,
      buyerType: null,
      locale: 'ka',
      displayName: 'Nino',
      avatarUrl: null,
      emailVerified: false,
      rating: { average: null, count: 0 },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerType: null,
          buyerType: null,
          role: 'farmer',
        }),
      }),
    );
    expect(notifications.notifyWelcome).toHaveBeenCalledWith({
      email: 'farmer@example.com',
      locale: 'ka',
      displayName: 'Nino',
      role: 'farmer',
    });
    // Mail is fire-and-forget after account creation.
    await Promise.resolve();
    expect(verification.sendEmailCode).toHaveBeenCalled();
  });

  it('registers a buyer without seller/buyer subtypes', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user_2',
      email: 'buyer@example.com',
      role: 'buyer',
      sellerType: null,
      buyerType: null,
      locale: 'en',
      displayName: 'Elena',
      passwordHash: 'hash',
      emailVerifiedAt: null,
    });

    const result = await service.register({
      email: 'buyer@example.com',
      password: 'password1',
      role: 'buyer',
      displayName: 'Elena',
      locale: 'en',
    });

    expect(result.user.role).toBe('buyer');
    expect(result.user.buyerType).toBeNull();
    expect(result.user.sellerType).toBeNull();
    expect(result.user.emailVerified).toBe(false);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          buyerType: null,
          sellerType: null,
          role: 'buyer',
        }),
      }),
    );
  });

  it('rejects duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register({
        email: 'farmer@example.com',
        password: 'password1',
        role: 'farmer',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid login', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'password1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('rate limiting', () => {
    const CREDENTIALS = { email: 'victim@example.com', password: 'password1' };

    async function storedUser() {
      return {
        id: 'user_1',
        email: 'victim@example.com',
        role: 'farmer',
        sellerType: null,
        buyerType: null,
        locale: 'en',
        displayName: 'Nino',
        passwordHash: await bcrypt.hash('password1', 4),
        emailVerifiedAt: new Date(),
        blockedAt: null,
      };
    }

    it('stops guessing after the per-account budget is spent', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const limited = buildService({ RATE_LIMIT_LOGIN_MAX: '3' });

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await expect(limited.login(CREDENTIALS, '203.0.113.5')).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      }

      await expect(limited.login(CREDENTIALS, '203.0.113.5')).rejects.toBeInstanceOf(
        RateLimitExceededException,
      );
    });

    it('reports how long the caller has to wait', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const limited = buildService({
        RATE_LIMIT_LOGIN_MAX: '1',
        RATE_LIMIT_LOGIN_WINDOW_SEC: '900',
      });

      await expect(limited.login(CREDENTIALS, '203.0.113.5')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(limited.login(CREDENTIALS, '203.0.113.5')).rejects.toMatchObject({
        retryAfterSeconds: expect.any(Number),
      });
    });

    it('does not reveal which counter tripped', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const limited = buildService({ RATE_LIMIT_LOGIN_MAX: '1' });

      await limited.login(CREDENTIALS, '203.0.113.5').catch(() => undefined);
      const error = await limited.login(CREDENTIALS, '203.0.113.5').catch((e) => e);

      expect((error as RateLimitExceededException).getResponse()).toMatchObject({
        message: 'Too many attempts. Try again later.',
      });
    });

    it('clears the budget once the real password is used', async () => {
      const limited = buildService({ RATE_LIMIT_LOGIN_MAX: '3' });
      const user = await storedUser();

      prisma.user.findUnique.mockResolvedValue(null);
      await limited.login(CREDENTIALS, '203.0.113.5').catch(() => undefined);
      await limited.login(CREDENTIALS, '203.0.113.5').catch(() => undefined);

      prisma.user.findUnique.mockResolvedValue(user);
      await expect(limited.login(CREDENTIALS, '203.0.113.5')).resolves.toMatchObject({
        accessToken: 'test-token',
      });

      // Budget is back to full: three more failures are needed before the next 429.
      prisma.user.findUnique.mockResolvedValue(null);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await expect(limited.login(CREDENTIALS, '203.0.113.5')).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      }
      await expect(limited.login(CREDENTIALS, '203.0.113.5')).rejects.toBeInstanceOf(
        RateLimitExceededException,
      );
    });

    it('lets the owner sign in while an attacker is locked out elsewhere', async () => {
      const limited = buildService({ RATE_LIMIT_LOGIN_MAX: '2' });

      prisma.user.findUnique.mockResolvedValue(null);
      await limited.login(CREDENTIALS, '198.51.100.1').catch(() => undefined);
      await limited.login(CREDENTIALS, '198.51.100.1').catch(() => undefined);
      await expect(limited.login(CREDENTIALS, '198.51.100.1')).rejects.toBeInstanceOf(
        RateLimitExceededException,
      );

      prisma.user.findUnique.mockResolvedValue(await storedUser());
      await expect(limited.login(CREDENTIALS, '203.0.113.9')).resolves.toMatchObject({
        accessToken: 'test-token',
      });
    });

    it('caps spraying across many accounts from one address', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const limited = buildService({
        RATE_LIMIT_LOGIN_MAX: '50',
        RATE_LIMIT_LOGIN_IP_MAX: '4',
      });

      for (let attempt = 0; attempt < 4; attempt += 1) {
        await expect(
          limited.login({ email: `user${attempt}@example.com`, password: 'password1' }, '10.0.0.7'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }

      await expect(
        limited.login({ email: 'user99@example.com', password: 'password1' }, '10.0.0.7'),
      ).rejects.toBeInstanceOf(RateLimitExceededException);
    });

    it('treats email casing and padding as the same account', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const limited = buildService({ RATE_LIMIT_LOGIN_MAX: '2' });

      await limited
        .login({ email: 'Victim@Example.com', password: 'password1' }, '203.0.113.5')
        .catch(() => undefined);
      await limited
        .login({ email: ' victim@example.com ', password: 'password1' }, '203.0.113.5')
        .catch(() => undefined);

      await expect(limited.login(CREDENTIALS, '203.0.113.5')).rejects.toBeInstanceOf(
        RateLimitExceededException,
      );
    });

    it('caps registrations from one address without blocking other addresses', async () => {
      const limited = buildService({ RATE_LIMIT_REGISTER_IP_MAX: '2' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: { email: string } }) => ({
        id: 'user_x',
        email: data.email,
        role: 'buyer',
        sellerType: null,
        buyerType: null,
        locale: 'en',
        displayName: null,
        passwordHash: 'hash',
        emailVerifiedAt: null,
      }));

      const signUp = (email: string, ip: string) =>
        limited.register({ email, password: 'password1', role: 'buyer' }, ip);

      await expect(signUp('a@example.com', '192.0.2.1')).resolves.toBeDefined();
      await expect(signUp('b@example.com', '192.0.2.1')).resolves.toBeDefined();
      await expect(signUp('c@example.com', '192.0.2.1')).rejects.toBeInstanceOf(
        RateLimitExceededException,
      );

      await expect(signUp('d@example.com', '192.0.2.2')).resolves.toBeDefined();
    });
  });

  describe('changePassword', () => {
    async function storedUser(password = 'password1', authVersion = 0) {
      return {
        id: 'user_1',
        email: 'farmer@example.com',
        role: 'farmer' as const,
        sellerType: null,
        buyerType: null,
        locale: 'en',
        displayName: 'Nino',
        avatarUrl: null,
        passwordHash: await bcrypt.hash(password, 4),
        emailVerifiedAt: new Date(),
        blockedAt: null,
        authVersion,
      };
    }

    it('rejects the wrong current password', async () => {
      prisma.user.findUnique.mockResolvedValue(await storedUser());
      await expect(
        service.changePassword('user_1', {
          currentPassword: 'wrongpass',
          newPassword: 'newpass12',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a new password that matches the current one', async () => {
      prisma.user.findUnique.mockResolvedValue(await storedUser());
      await expect(
        service.changePassword('user_1', {
          currentPassword: 'password1',
          newPassword: 'password1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('issues a JWT with the incremented authVersion', async () => {
      const user = await storedUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({ ...user, authVersion: 1 });

      const result = await service.changePassword('user_1', {
        currentPassword: 'password1',
        newPassword: 'newpass12',
      });

      expect(result.accessToken).toBe('test-token');
      expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ ver: 1 }));
      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalled();
    });
  });
});
