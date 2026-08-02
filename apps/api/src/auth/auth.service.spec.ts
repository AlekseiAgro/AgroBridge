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
      locale: 'ka',
      displayName: 'Nino',
      passwordHash: 'hash',
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
      locale: 'ka',
      displayName: 'Nino',
      rating: { average: null, count: 0 },
    });
    expect(prisma.user.create).toHaveBeenCalled();
    expect(notifications.notifyWelcome).toHaveBeenCalledWith({
      email: 'farmer@example.com',
      locale: 'ka',
      displayName: 'Nino',
      role: 'farmer',
    });
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
