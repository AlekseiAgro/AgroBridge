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

  it('rejects non-producers', async () => {
    await expect(
      service.getStatus({
        ...farmer,
        role: 'buyer',
      }),
    ).rejects.toBeInstanceOf(Error);
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
