import { BadRequestException } from '@nestjs/common';
import { VerificationService } from './verification.service';

describe('VerificationService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    farm: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    verificationCode: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const notifications = {
    notifyVerificationCode: jest.fn().mockResolvedValue(undefined),
  };
  const sms = { send: jest.fn().mockResolvedValue(undefined) };
  const registry = {
    lookup: jest.fn().mockResolvedValue({
      valid: true,
      registrationNumber: '123456789',
      legalName: 'Demo LLC',
      source: 'stub',
      message: 'ok',
    }),
  };

  const farmer = {
    id: 'u1',
    email: 'farmer@example.com',
    role: 'farmer' as const,
    locale: 'en' as const,
    displayName: 'Farmer',
    sellerType: 'privateFarmer' as const,
    buyerType: 'individual' as const,
    avatarUrl: null,
    emailVerified: false,
  };

  let service: VerificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VerificationService(
      prisma as never,
      notifications as never,
      sms as never,
      registry as never,
    );
  });

  it('allows marketplace buyers to request email verification', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'buyer@example.com',
      locale: 'en',
      displayName: 'Buyer',
      emailVerifiedAt: null,
      phone: null,
      phoneVerifiedAt: null,
      sellerType: 'privateFarmer',
    });
    prisma.verificationCode.create.mockResolvedValue({ id: 'c1' });

    const result = await service.sendEmailCode({
      ...farmer,
      role: 'buyer',
      email: 'buyer@example.com',
    });
    expect(result.sent).toBe(true);
  });

  it('sends an email verification code', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Farmer',
      emailVerifiedAt: null,
      phone: null,
      phoneVerifiedAt: null,
      sellerType: 'privateFarmer',
    });
    prisma.verificationCode.create.mockResolvedValue({ id: 'c1' });

    const result = await service.sendEmailCode(farmer);
    expect(result.sent).toBe(true);
    expect(notifications.notifyVerificationCode).toHaveBeenCalled();
    expect(prisma.verificationCode.create).toHaveBeenCalled();
  });

  it('rejects invalid phone numbers', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'farmer@example.com',
      phone: null,
      phoneVerifiedAt: null,
    });
    await expect(service.sendSmsCode(farmer, 'abc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
