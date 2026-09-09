import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import type { JwtPayload } from './auth.types';

describe('JwtStrategy', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const strategy = new JwtStrategy(
    { get: () => 'test-secret' } as unknown as ConfigService,
    prisma as never,
  );

  const payload: JwtPayload = {
    sub: 'user_1',
    email: 'farmer@example.com',
    role: 'farmer',
    locale: 'en',
    ver: 1,
  };

  const stored = {
    id: 'user_1',
    email: 'farmer@example.com',
    role: 'farmer',
    sellerType: null,
    buyerType: null,
    locale: 'en',
    displayName: 'Nino',
    avatarUrl: null,
    emailVerifiedAt: new Date(),
    blockedAt: null,
    blockedReason: null,
    authVersion: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a token whose version matches the account', async () => {
    prisma.user.findUnique.mockResolvedValue(stored);
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      id: 'user_1',
      email: 'farmer@example.com',
      role: 'farmer',
    });
  });

  it('rejects a token issued before a password change', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...stored, authVersion: 2 });
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('treats a token without ver as version 0, matching pre-migration sessions', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...stored, authVersion: 0 });
    const legacy: JwtPayload = {
      sub: 'user_1',
      email: 'farmer@example.com',
      role: 'farmer',
      locale: 'en',
    };
    await expect(strategy.validate(legacy)).resolves.toMatchObject({ id: 'user_1' });
  });

  it('still rejects a blocked account even with a matching version', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...stored,
      blockedAt: new Date(),
      blockedReason: 'This account has been blocked',
    });
    await expect(strategy.validate(payload)).rejects.toMatchObject({
      message: 'This account has been blocked',
    });
  });
});
