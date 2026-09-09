import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { RateLimitExceededException } from '../rate-limit/rate-limit-exceeded.exception';
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
  };

  // Issue/consume semantics are covered against a real database in
  // verification-code.service.integration.spec.ts; here we only check the wiring.
  const codes = {
    issue: jest.fn().mockResolvedValue('123456'),
    consume: jest.fn().mockResolvedValue({ id: 'c1', destination: 'farmer@example.com' }),
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
    codes.issue.mockResolvedValue('123456');
    codes.consume.mockResolvedValue({ id: 'c1', destination: 'farmer@example.com' });
    service = new VerificationService(
      prisma as never,
      notifications as never,
      sms as never,
      registry as never,
      codes as never,
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

    const result = await service.sendEmailCode(farmer, '203.0.113.7');
    expect(result.sent).toBe(true);
    expect(notifications.notifyVerificationCode).toHaveBeenCalled();
    expect(codes.issue).toHaveBeenCalledWith({
      userId: 'u1',
      channel: 'email',
      destination: 'farmer@example.com',
      ip: '203.0.113.7',
    });
  });

  it('does not leak SMTP details when verification mail cannot be delivered', async () => {
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
    notifications.notifyVerificationCode.mockRejectedValue(
      new Error('Invalid login SMTP_PASSWORD=s3cret-token-value'),
    );

    const error = await service.sendEmailCode(farmer, '203.0.113.7').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const message = error instanceof Error ? error.message : String(error);
    expect(message).not.toContain('s3cret-token-value');
    expect(message).not.toContain('SMTP_PASSWORD');
    expect(message).toContain('Please try again later');
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

  it('stops sending mail once the code budget is spent', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Farmer',
      emailVerifiedAt: null,
    });
    codes.issue.mockRejectedValue(new RateLimitExceededException(60));

    await expect(service.sendEmailCode(farmer, '203.0.113.7')).rejects.toBeInstanceOf(
      RateLimitExceededException,
    );
    expect(notifications.notifyVerificationCode).not.toHaveBeenCalled();
  });

  it('leaves the verified phone alone when an SMS request is throttled', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'farmer@example.com',
      phone: '+995500000000',
      phoneVerifiedAt: new Date(),
    });
    codes.issue.mockRejectedValue(new RateLimitExceededException(60));

    await expect(
      service.sendSmsCode(farmer, '+995511111111', '203.0.113.7'),
    ).rejects.toBeInstanceOf(RateLimitExceededException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('marks the email verified only after the challenge is consumed', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Farmer',
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      sellerType: 'privateFarmer',
    });
    prisma.farm.findUnique.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({});

    await service.confirmEmailCode(farmer, '123456', '203.0.113.7');

    expect(codes.consume).toHaveBeenCalledWith({
      userId: 'u1',
      channel: 'email',
      code: '123456',
      ip: '203.0.113.7',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });

  it('does not verify the email when the code is rejected', async () => {
    codes.consume.mockRejectedValue(new BadRequestException('Invalid or expired verification code'));

    await expect(
      service.confirmEmailCode(farmer, '000000', '203.0.113.7'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('stores seller type on the user and returns the matching verification path', async () => {
    prisma.farm.findUnique.mockResolvedValue({
      verificationStatus: 'unverified',
      verificationNote: null,
      companyRegistrationNumber: null,
      companyRegistryName: null,
      companyRegistryValid: null,
      documents: [],
    });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Farmer',
        emailVerifiedAt: new Date(),
        phone: null,
        phoneVerifiedAt: null,
        sellerType: null,
      })
      .mockResolvedValue({
        id: 'u1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Farmer',
        emailVerifiedAt: new Date(),
        phone: null,
        phoneVerifiedAt: null,
        sellerType: 'company',
      });
    prisma.user.update.mockResolvedValue({});

    const status = await service.setSellerType(farmer, 'company');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { sellerType: 'company' },
    });
    expect(status.path).toBe('company');
    expect(status.sellerType).toBe('company');
    expect(status.sellerTypeLocked).toBe(false);
  });

  it('stores privateFarmer seller type and returns that verification path', async () => {
    prisma.farm.findUnique.mockResolvedValue({
      verificationStatus: 'unverified',
      verificationNote: null,
      companyRegistrationNumber: null,
      companyRegistryName: null,
      companyRegistryValid: null,
      documents: [],
    });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Farmer',
        emailVerifiedAt: new Date(),
        phone: null,
        phoneVerifiedAt: null,
        sellerType: null,
      })
      .mockResolvedValue({
        id: 'u1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Farmer',
        emailVerifiedAt: new Date(),
        phone: null,
        phoneVerifiedAt: null,
        sellerType: 'privateFarmer',
      });
    prisma.user.update.mockResolvedValue({});

    const status = await service.setSellerType(farmer, 'privateFarmer');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { sellerType: 'privateFarmer' },
    });
    expect(status.path).toBe('privateFarmer');
    expect(status.sellerType).toBe('privateFarmer');
    expect(status.sellerTypeLocked).toBe(false);
  });

  it('lets a marketplace buyer set seller type before verification starts', async () => {
    prisma.farm.findUnique.mockResolvedValue({
      verificationStatus: 'unverified',
      companyRegistryValid: null,
      documents: [],
    });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'buyer@example.com',
        locale: 'en',
        displayName: 'Buyer',
        emailVerifiedAt: new Date(),
        phone: null,
        phoneVerifiedAt: null,
        sellerType: null,
      })
      .mockResolvedValue({
        id: 'u1',
        email: 'buyer@example.com',
        locale: 'en',
        displayName: 'Buyer',
        emailVerifiedAt: new Date(),
        phone: null,
        phoneVerifiedAt: null,
        sellerType: 'privateFarmer',
      });
    prisma.user.update.mockResolvedValue({});

    const status = await service.setSellerType(
      { ...farmer, role: 'buyer', email: 'buyer@example.com' },
      'privateFarmer',
    );

    expect(prisma.user.update).toHaveBeenCalled();
    expect(status.sellerType).toBe('privateFarmer');
    expect(status.sellerTypeLocked).toBe(false);
  });

  it('allows switching seller type before identity verification starts', async () => {
    prisma.farm.findUnique.mockResolvedValue({
      verificationStatus: 'unverified',
      companyRegistryValid: null,
      documents: [],
    });
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Farmer',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        phone: '+995500000000',
        sellerType: 'privateFarmer',
      })
      .mockResolvedValue({
        id: 'u1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Farmer',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        phone: '+995500000000',
        sellerType: 'company',
      });
    prisma.user.update.mockResolvedValue({});

    const status = await service.setSellerType(farmer, 'company');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { sellerType: 'company' },
    });
    expect(status.path).toBe('company');
  });

  it('rejects seller type changes after the farm is pending review', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      sellerType: 'privateFarmer',
    });
    prisma.farm.findUnique.mockResolvedValue({
      verificationStatus: 'pending',
      companyRegistryValid: null,
      documents: [{ kind: 'idCard' }],
    });

    await expect(service.setSellerType(farmer, 'company')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects seller type changes after an ID card was uploaded', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      sellerType: 'privateFarmer',
    });
    prisma.farm.findUnique.mockResolvedValue({
      verificationStatus: 'unverified',
      companyRegistryValid: null,
      documents: [{ kind: 'idCard' }],
    });

    await expect(service.setSellerType(farmer, 'company')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects seller type changes after a company registration document was uploaded', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      sellerType: 'company',
    });
    prisma.farm.findUnique.mockResolvedValue({
      verificationStatus: 'unverified',
      companyRegistryValid: null,
      documents: [{ kind: 'businessRegistration' }],
    });

    await expect(service.setSellerType(farmer, 'privateFarmer')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects seller type changes after a company registry result exists', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      sellerType: 'company',
    });
    prisma.farm.findUnique.mockResolvedValue({
      verificationStatus: 'unverified',
      companyRegistryValid: true,
      documents: [],
    });

    await expect(service.setSellerType(farmer, 'privateFarmer')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects seller type changes after the farm is verified', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      sellerType: 'privateFarmer',
    });
    prisma.farm.findUnique.mockResolvedValue({ verificationStatus: 'approved' });

    await expect(service.setSellerType(farmer, 'company')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects seller type changes after verification was rejected', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      sellerType: 'privateFarmer',
    });
    prisma.farm.findUnique.mockResolvedValue({
      verificationStatus: 'rejected',
      companyRegistryValid: null,
      documents: [{ kind: 'idCard' }],
    });

    await expect(service.setSellerType(farmer, 'company')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('still submits private farmer review on the privateFarmer path', async () => {
    const privateUser = {
      id: 'u1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Farmer',
      emailVerifiedAt: new Date(),
      phone: '+995500000000',
      phoneVerifiedAt: new Date(),
      sellerType: 'privateFarmer',
    };
    prisma.user.findUnique.mockResolvedValue(privateUser);
    prisma.farm.findUnique.mockResolvedValue({
      id: 'farm1',
      ownerId: 'u1',
      verificationStatus: 'unverified',
      verificationNote: null,
      companyRegistrationNumber: null,
      companyRegistryName: null,
      companyRegistryValid: null,
      documents: [{ kind: 'idCard', reviewStatus: 'pending' }],
    });
    prisma.farm.update.mockResolvedValue({});

    const status = await service.submitPrivateFarmerReview(farmer);

    expect(prisma.farm.update).toHaveBeenCalledWith({
      where: { id: 'farm1' },
      data: {
        verificationStatus: 'pending',
        verificationNote: 'Awaiting moderator review of ID document',
        verifiedAt: null,
        verifiedById: null,
      },
    });
    expect(status.path).toBe('privateFarmer');
    expect(status.sellerTypeLocked).toBe(true);
  });

  it('still checks the company registry on the company path', async () => {
    const companyUser = {
      id: 'u1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Farmer',
      emailVerifiedAt: new Date(),
      phone: '+995500000000',
      phoneVerifiedAt: new Date(),
      sellerType: 'company',
    };
    prisma.user.findUnique.mockResolvedValue(companyUser);
    prisma.farm.findUnique.mockResolvedValue({
      id: 'farm1',
      ownerId: 'u1',
      verificationStatus: 'unverified',
      verificationNote: null,
      companyRegistrationNumber: '123456789',
      companyRegistryName: 'Demo LLC',
      companyRegistryValid: true,
      documents: [],
    });
    prisma.farm.update.mockResolvedValue({});

    const status = await service.checkCompanyRegistry(farmer, '123456789');

    expect(registry.lookup).toHaveBeenCalledWith('123456789');
    expect(prisma.farm.update).toHaveBeenCalled();
    expect(status.path).toBe('company');
    expect(status.sellerType).toBe('company');
    expect(status.sellerTypeLocked).toBe(true);
  });

  it('rejects an invalid seller type before writing', async () => {
    await expect(service.setSellerType(farmer, 'cooperative')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
