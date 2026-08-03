import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    rating: {
      aggregate: jest.fn().mockResolvedValue({
        _avg: { score: null },
        _count: { _all: 0 },
      }),
    },
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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      jwtService as unknown as JwtService,
      config as unknown as ConfigService,
      notifications as never,
      verification as never,
    );
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
});
