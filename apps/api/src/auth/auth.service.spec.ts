import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
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

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      jwtService as unknown as JwtService,
      config as unknown as ConfigService,
      notifications as never,
    );
  });

  it('registers a farmer and returns a token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user_1',
      email: 'farmer@example.com',
      role: 'farmer',
      sellerType: 'privateFarmer',
      buyerType: 'individual',
      locale: 'ka',
      displayName: 'Nino',
      passwordHash: 'hash',
    });

    const result = await service.register({
      email: 'Farmer@Example.com',
      password: 'password1',
      role: 'farmer',
      sellerType: 'privateFarmer',
      displayName: 'Nino',
      locale: 'ka',
    });

    expect(result.accessToken).toBe('test-token');
    expect(result.user).toEqual({
      id: 'user_1',
      email: 'farmer@example.com',
      role: 'farmer',
      sellerType: 'privateFarmer',
      buyerType: 'individual',
      locale: 'ka',
      displayName: 'Nino',
      rating: { average: null, count: 0 },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerType: 'privateFarmer',
          buyerType: 'individual',
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
  });

  it('requires seller type for farmers', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.register({
        email: 'farmer@example.com',
        password: 'password1',
        role: 'farmer',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires buyer type for buyers', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.register({
        email: 'buyer@example.com',
        password: 'password1',
        role: 'buyer',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('registers a buyer with buyer type', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user_2',
      email: 'buyer@example.com',
      role: 'buyer',
      sellerType: 'privateFarmer',
      buyerType: 'company',
      locale: 'en',
      displayName: 'Elena',
      passwordHash: 'hash',
    });

    const result = await service.register({
      email: 'buyer@example.com',
      password: 'password1',
      role: 'buyer',
      buyerType: 'company',
      displayName: 'Elena',
      locale: 'en',
    });

    expect(result.user.buyerType).toBe('company');
    expect(result.user.sellerType).toBe('privateFarmer');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          buyerType: 'company',
          sellerType: 'privateFarmer',
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
        sellerType: 'privateFarmer',
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
