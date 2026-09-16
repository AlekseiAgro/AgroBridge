import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { RateLimitExceededException } from '../rate-limit/rate-limit-exceeded.exception';
import { createTestRateLimit } from '../rate-limit/rate-limit.test-utils';
import { VerificationService } from './verification.service';
import { SmsDeliveryError } from '../sms/sms.errors';

describe('VerificationService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    farm: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    farmDocument: {
      updateMany: jest.fn(),
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
    // Mirrors production: the notification reports whether the mail was actually delivered.
    notifyVerificationPendingModeration: jest.fn().mockResolvedValue(true),
    notifyVerificationApproved: jest.fn().mockResolvedValue(true),
    notifyVerificationRejected: jest.fn().mockResolvedValue(true),
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
    notifications.notifyVerificationPendingModeration.mockResolvedValue(true);
    notifications.notifyVerificationApproved.mockResolvedValue(true);
    notifications.notifyVerificationRejected.mockResolvedValue(true);
    prisma.farm.updateMany.mockResolvedValue({ count: 1 });
    prisma.farmDocument.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findMany.mockResolvedValue([
      { email: 'admin@agrobridge.ge', locale: 'ru', displayName: 'Admin' },
    ]);
    // Real throttle on in-process counters, so the submission cap is exercised, not stubbed.
    service = new VerificationService(
      prisma as never,
      notifications as never,
      sms as never,
      registry as never,
      codes as never,
      createTestRateLimit().service,
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

  it('accepts a Georgian national number when the country is provided', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'farmer@example.com',
      phone: null,
      phoneVerifiedAt: null,
    });
    prisma.user.update.mockResolvedValue({});
    codes.issue.mockResolvedValue('123456');

    const result = await service.sendSmsCode(farmer, '555 12 34 56', '203.0.113.7', 'GE');

    expect(result.destination).toBe('+995555123456');
    expect(sms.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+995555123456' }),
    );
  });

  it('maps SMS provider failures to a generic unavailable error', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'farmer@example.com',
      phone: null,
      phoneVerifiedAt: null,
    });
    prisma.user.update.mockResolvedValue({});
    codes.issue.mockResolvedValue('123456');
    sms.send.mockRejectedValueOnce(
      new SmsDeliveryError('timeout', 'Could not send the SMS. Please try again later.'),
    );

    await expect(
      service.sendSmsCode(farmer, '+995555123456', '203.0.113.7'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps destination-specific SMS failures to a safe invalid-phone error', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'farmer@example.com',
      phone: null,
      phoneVerifiedAt: null,
    });
    prisma.user.update.mockResolvedValue({});
    codes.issue.mockResolvedValue('123456');
    sms.send.mockRejectedValueOnce(
      new SmsDeliveryError(
        'invalid_destination',
        'Enter a valid phone number with a country code.',
      ),
    );

    const error = await service
      .sendSmsCode(farmer, '+995555123456', '203.0.113.7')
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toBe('Enter a valid phone number with a country code.');
    expect(message).not.toContain('REJECTED');
    expect(message).not.toContain('Infobip');
  });

  it('maps rejected SMS delivery to generic unavailable rather than invalid phone', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'farmer@example.com',
      phone: null,
      phoneVerifiedAt: null,
    });
    prisma.user.update.mockResolvedValue({});
    codes.issue.mockResolvedValue('123456');
    sms.send.mockRejectedValueOnce(
      new SmsDeliveryError('rejected', 'Could not send the SMS. Please try again later.'),
    );

    const error = await service
      .sendSmsCode(farmer, '+995555123456', '203.0.113.7')
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toBe('Could not send the SMS. Please try again later.');
    expect(message).not.toContain('valid phone');
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
      service.sendSmsCode(farmer, '+995555123456', '203.0.113.7'),
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

  it('replays the same idempotent transition for the legacy submit endpoint', async () => {
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
      name: 'Kakheti Farm',
      verificationStatus: 'unverified',
      verificationNote: null,
      companyRegistrationNumber: null,
      companyRegistryName: null,
      companyRegistryValid: null,
      documents: [
        { id: 'doc1', kind: 'idCard', reviewStatus: 'pending', createdAt: new Date() },
      ],
    });

    const status = await service.submitPrivateFarmerReview(farmer);

    expect(prisma.farm.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'farm1',
        verificationStatus: { in: ['unverified', 'rejected'] },
      },
      data: expect.objectContaining({ verificationStatus: 'pending' }),
    });
    expect(status.path).toBe('privateFarmer');
    expect(status.sellerTypeLocked).toBe(true);
  });

  describe('identity review submission', () => {
    const submittedAt = new Date('2026-09-16T10:30:00.000Z');

    const producer = (overrides: Record<string, unknown> = {}) => ({
      id: 'u1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Farmer',
      emailVerifiedAt: new Date(),
      phone: '+995500000000',
      phoneVerifiedAt: new Date(),
      sellerType: 'privateFarmer',
      ...overrides,
    });

    const farmWithPendingId = (overrides: Record<string, unknown> = {}) => ({
      id: 'farm1',
      ownerId: 'u1',
      name: 'Kakheti Farm',
      owner: { email: 'farmer@example.com', locale: 'en', displayName: 'Farmer' },
      verificationStatus: 'unverified',
      verificationNote: null,
      verificationReasonCode: null,
      companyRegistrationNumber: null,
      companyRegistryName: null,
      companyRegistryValid: null,
      documents: [
        {
          id: 'doc1',
          kind: 'idCard',
          reviewStatus: 'pending',
          createdAt: submittedAt,
          key: 'farms/farm1/documents/secret.pdf',
          url: '/api/uploads/farms/farm1/documents/secret.pdf',
        },
      ],
      ...overrides,
    });

    it('moves the farm into moderation and notifies admins once', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(farmWithPendingId());

      await service.ensureIdentityReviewSubmitted('u1');

      // Only documents moderation has never seen are picked up as a submission.
      expect(prisma.farm.findUnique).toHaveBeenCalledWith({
        where: { ownerId: 'u1' },
        include: {
          documents: {
            where: {
              kind: 'idCard',
              reviewStatus: 'pending',
              moderationNotifiedAt: null,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      expect(prisma.farm.updateMany).toHaveBeenCalledWith({
        where: { id: 'farm1', verificationStatus: { in: ['unverified', 'rejected'] } },
        data: {
          verificationStatus: 'pending',
          verificationReasonCode: null,
          verificationNote: null,
          verifiedAt: null,
          verifiedById: null,
        },
      });
      // Entering the queue is not a decision, so the producer is not emailed yet.
      expect(notifications.notifyVerificationApproved).not.toHaveBeenCalled();
      expect(notifications.notifyVerificationRejected).not.toHaveBeenCalled();
      expect(prisma.farmDocument.updateMany).toHaveBeenCalledWith({
        where: { id: 'doc1', moderationNotifiedAt: null },
        data: { moderationNotifiedAt: expect.any(Date) },
      });
      expect(notifications.notifyVerificationPendingModeration).toHaveBeenCalledTimes(1);
      expect(notifications.notifyVerificationPendingModeration).toHaveBeenCalledWith({
        admin: { email: 'admin@agrobridge.ge', locale: 'ru', displayName: 'Admin' },
        farmId: 'farm1',
        farmName: 'Kakheti Farm',
        sellerType: 'privateFarmer',
        submittedAt,
      });
    });

    it('never puts document contents, storage keys, or URLs in the notification', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(farmWithPendingId());

      await service.ensureIdentityReviewSubmitted('u1');

      const payload = JSON.stringify(
        notifications.notifyVerificationPendingModeration.mock.calls[0][0],
      );
      expect(payload).not.toContain('secret.pdf');
      expect(payload).not.toContain('farms/farm1/documents');
      expect(payload).not.toContain('/api/uploads/');
    });

    it('does not notify twice for the same submitted document', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(
        farmWithPendingId({ verificationStatus: 'pending' }),
      );
      prisma.farmDocument.updateMany.mockResolvedValue({ count: 0 });

      await service.ensureIdentityReviewSubmitted('u1');

      expect(notifications.notifyVerificationPendingModeration).not.toHaveBeenCalled();
    });

    it('notifies again when a new document is uploaded after a rejection', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(
        farmWithPendingId({
          verificationStatus: 'rejected',
          documents: [
            { id: 'doc2', kind: 'idCard', reviewStatus: 'pending', createdAt: submittedAt },
          ],
        }),
      );

      await service.ensureIdentityReviewSubmitted('u1');

      expect(prisma.farmDocument.updateMany).toHaveBeenCalledWith({
        where: { id: 'doc2', moderationNotifiedAt: null },
        data: { moderationNotifiedAt: expect.any(Date) },
      });
      expect(notifications.notifyVerificationPendingModeration).toHaveBeenCalledTimes(1);
    });

    it('waits for email and SMS before entering the moderation queue', async () => {
      prisma.user.findUnique.mockResolvedValue(producer({ phoneVerifiedAt: null }));
      prisma.farm.findUnique.mockResolvedValue(farmWithPendingId());

      await service.ensureIdentityReviewSubmitted('u1');

      expect(prisma.farm.updateMany).not.toHaveBeenCalled();
      expect(notifications.notifyVerificationPendingModeration).not.toHaveBeenCalled();
    });

    it('does nothing without a pending primary document', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(farmWithPendingId({ documents: [] }));

      await service.ensureIdentityReviewSubmitted('u1');

      expect(prisma.farm.updateMany).not.toHaveBeenCalled();
      expect(notifications.notifyVerificationPendingModeration).not.toHaveBeenCalled();
    });

    it('leaves an approved farm untouched', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(
        farmWithPendingId({ verificationStatus: 'approved' }),
      );

      await service.ensureIdentityReviewSubmitted('u1');

      expect(prisma.farm.updateMany).not.toHaveBeenCalled();
      expect(notifications.notifyVerificationPendingModeration).not.toHaveBeenCalled();
    });

    it('submits automatically once the last contact channel is confirmed', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(farmWithPendingId());
      prisma.user.update.mockResolvedValue({});

      await service.confirmSmsCode(farmer, '123456', '203.0.113.7');

      expect(notifications.notifyVerificationPendingModeration).toHaveBeenCalledTimes(1);
    });

    it('never writes or notifies while reading the verification status', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(
        farmWithPendingId({ verificationStatus: 'pending' }),
      );

      const status = await service.getStatus(farmer);

      expect(status.steps.identity).toBe('pending_review');
      expect(status.hasPendingVerificationDocument).toBe(true);
      expect(prisma.farm.update).not.toHaveBeenCalled();
      expect(prisma.farm.updateMany).not.toHaveBeenCalled();
      expect(prisma.farmDocument.updateMany).not.toHaveBeenCalled();
      expect(notifications.notifyVerificationPendingModeration).not.toHaveBeenCalled();
    });

    it('keeps the upload stored when admin mail delivery fails', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(farmWithPendingId());
      notifications.notifyVerificationPendingModeration.mockRejectedValueOnce(
        new Error('smtp down'),
      );

      await expect(service.ensureIdentityReviewSubmitted('u1')).resolves.toBeUndefined();
      expect(prisma.farm.updateMany).toHaveBeenCalled();
    });

    it('releases the notification claim when the mail was not delivered', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(farmWithPendingId());
      notifications.notifyVerificationPendingModeration.mockResolvedValueOnce(false);

      await service.ensureIdentityReviewSubmitted('u1');

      const [claim, release] = prisma.farmDocument.updateMany.mock.calls;
      expect(claim[0]).toEqual({
        where: { id: 'doc1', moderationNotifiedAt: null },
        data: { moderationNotifiedAt: expect.any(Date) },
      });
      // Releasing matches the exact claim timestamp so a concurrent claim is never dropped.
      expect(release[0]).toEqual({
        where: { id: 'doc1', moderationNotifiedAt: claim[0].data.moderationNotifiedAt },
        data: { moderationNotifiedAt: null },
      });
    });

    it('keeps the claim when the mail was delivered', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(farmWithPendingId());

      await service.ensureIdentityReviewSubmitted('u1');

      expect(prisma.farmDocument.updateMany).toHaveBeenCalledTimes(1);
    });

    it('caps how often one farm can page the moderators', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(farmWithPendingId());

      for (let attempt = 0; attempt < 4; attempt += 1) {
        await service.ensureIdentityReviewSubmitted('u1');
      }

      expect(notifications.notifyVerificationPendingModeration).toHaveBeenCalledTimes(3);
      // The suppressed attempt still queues the farm and still consumes its claim.
      expect(prisma.farm.updateMany).toHaveBeenCalledTimes(4);
      expect(prisma.farmDocument.updateMany).toHaveBeenCalledTimes(4);
    });

    it('marks the farm rejected when the only submitted document is rejected', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(
        farmWithPendingId({
          verificationStatus: 'pending',
          documents: [{ id: 'doc1', kind: 'idCard', reviewStatus: 'rejected' }],
        }),
      );

      await service.syncPrimaryDocumentState('u1');

      expect(prisma.farm.updateMany).toHaveBeenCalledWith({
        where: { id: 'farm1', verificationStatus: { in: ['pending'] } },
        data: {
          verificationStatus: 'rejected',
          verificationReasonCode: 'documentRejected',
          verificationNote: null,
          verifiedAt: null,
          verifiedById: null,
        },
      });
      // The seller is told why, in their own language, from the reason code.
      expect(notifications.notifyVerificationRejected).toHaveBeenCalledTimes(1);
      expect(notifications.notifyVerificationRejected).toHaveBeenCalledWith({
        farmer: { email: 'farmer@example.com', locale: 'en', displayName: 'Farmer' },
        farmName: 'Kakheti Farm',
        reasonCode: 'documentRejected',
        moderatorComment: null,
      });
    });

    it('does not email the producer when the rejection was already recorded', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(
        farmWithPendingId({
          verificationStatus: 'pending',
          documents: [{ id: 'doc1', kind: 'idCard', reviewStatus: 'rejected' }],
        }),
      );
      prisma.farm.updateMany.mockResolvedValue({ count: 0 });

      await service.syncPrimaryDocumentState('u1');

      expect(notifications.notifyVerificationRejected).not.toHaveBeenCalled();
    });

    it('keeps the rejection recorded when the producer email fails', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(
        farmWithPendingId({
          verificationStatus: 'pending',
          documents: [{ id: 'doc1', kind: 'idCard', reviewStatus: 'rejected' }],
        }),
      );
      notifications.notifyVerificationRejected.mockRejectedValueOnce(new Error('smtp down'));

      await expect(service.syncPrimaryDocumentState('u1')).resolves.toBeUndefined();
      expect(prisma.farm.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ verificationStatus: 'rejected' }),
        }),
      );
    });

    it('stays pending while another submitted document is still in review', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(
        farmWithPendingId({ verificationStatus: 'pending' }),
      );

      await service.syncPrimaryDocumentState('u1');

      expect(prisma.farm.update).not.toHaveBeenCalled();
      expect(prisma.farm.updateMany).not.toHaveBeenCalled();
    });

    it('leaves moderation when the seller withdrew the submitted document', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(
        farmWithPendingId({ verificationStatus: 'pending', documents: [] }),
      );

      await service.syncPrimaryDocumentState('u1');

      expect(prisma.farm.updateMany).toHaveBeenCalledWith({
        where: { id: 'farm1', verificationStatus: { in: ['pending'] } },
        data: {
          verificationStatus: 'unverified',
          verificationReasonCode: null,
          verificationNote: null,
          verifiedAt: null,
          verifiedById: null,
        },
      });
      // Withdrawing is not a decision either.
      expect(notifications.notifyVerificationRejected).not.toHaveBeenCalled();
    });

    it('sends a company back to the registry check once its document is approved', async () => {
      prisma.user.findUnique.mockResolvedValue(producer({ sellerType: 'company' }));
      prisma.farm.findUnique.mockResolvedValue(
        farmWithPendingId({
          verificationStatus: 'pending',
          documents: [{ id: 'doc1', kind: 'businessRegistration', reviewStatus: 'approved' }],
        }),
      );

      await service.syncPrimaryDocumentState('u1');

      expect(prisma.farm.updateMany).toHaveBeenCalledWith({
        where: { id: 'farm1', verificationStatus: { in: ['pending'] } },
        data: {
          verificationStatus: 'unverified',
          verificationReasonCode: 'registryNotConfirmed',
          verificationNote: null,
          verifiedAt: null,
          verifiedById: null,
        },
      });
    });

    it('never touches a farm that is not in moderation', async () => {
      prisma.user.findUnique.mockResolvedValue(producer());
      prisma.farm.findUnique.mockResolvedValue(
        farmWithPendingId({ verificationStatus: 'approved', documents: [] }),
      );

      await service.syncPrimaryDocumentState('u1');

      expect(prisma.farm.update).not.toHaveBeenCalled();
      expect(prisma.farm.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('completion rules', () => {
    const confirmedUser = (sellerType: 'privateFarmer' | 'company') => ({
      id: 'u1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Farmer',
      emailVerifiedAt: new Date(),
      phone: '+995500000000',
      phoneVerifiedAt: new Date(),
      sellerType,
    });

    const companyFarm = (
      companyRegistryValid: boolean | null,
      documents: Array<{ kind: string; reviewStatus: string }>,
    ) => ({
      id: 'farm1',
      ownerId: 'u1',
      name: 'Kakheti Farm',
      owner: { email: 'farmer@example.com', locale: 'en', displayName: 'Farmer' },
      verificationStatus: 'pending',
      verificationNote: null,
      verificationReasonCode: null,
      companyRegistrationNumber: '123456789',
      companyRegistryName: 'Demo LLC',
      companyRegistryValid,
      documents,
    });

    it('does not approve a company on a registry match alone', async () => {
      prisma.user.findUnique.mockResolvedValue(confirmedUser('company'));
      prisma.farm.findUnique.mockResolvedValue(
        companyFarm(true, [{ kind: 'businessRegistration', reviewStatus: 'pending' }]),
      );

      await service.tryCompleteVerification('u1');

      expect(prisma.farm.updateMany).not.toHaveBeenCalled();
      expect(notifications.notifyVerificationApproved).not.toHaveBeenCalled();
    });

    it('does not approve a company whose registration document was rejected', async () => {
      prisma.user.findUnique.mockResolvedValue(confirmedUser('company'));
      prisma.farm.findUnique.mockResolvedValue(
        companyFarm(true, [{ kind: 'businessRegistration', reviewStatus: 'rejected' }]),
      );

      await service.tryCompleteVerification('u1');

      expect(prisma.farm.updateMany).not.toHaveBeenCalled();
    });

    it('does not approve a company without a confirmed registry match', async () => {
      prisma.user.findUnique.mockResolvedValue(confirmedUser('company'));
      prisma.farm.findUnique.mockResolvedValue(
        companyFarm(null, [{ kind: 'businessRegistration', reviewStatus: 'approved' }]),
      );

      await service.tryCompleteVerification('u1');

      expect(prisma.farm.updateMany).not.toHaveBeenCalled();
    });

    it('does not approve a company the registry rejected', async () => {
      prisma.user.findUnique.mockResolvedValue(confirmedUser('company'));
      prisma.farm.findUnique.mockResolvedValue(
        companyFarm(false, [{ kind: 'businessRegistration', reviewStatus: 'approved' }]),
      );

      await service.tryCompleteVerification('u1');

      expect(prisma.farm.updateMany).not.toHaveBeenCalled();
    });

    it('approves a company only with both the registry match and an approved document', async () => {
      prisma.user.findUnique.mockResolvedValue(confirmedUser('company'));
      prisma.farm.findUnique.mockResolvedValue(
        companyFarm(true, [{ kind: 'businessRegistration', reviewStatus: 'approved' }]),
      );

      await service.tryCompleteVerification('u1');

      expect(prisma.farm.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'farm1',
          verificationStatus: { in: ['unverified', 'pending'] },
        },
        data: {
          verificationStatus: 'approved',
          verificationReasonCode: null,
          verificationNote: null,
          verifiedAt: expect.any(Date),
          verifiedById: null,
        },
      });
      expect(notifications.notifyVerificationApproved).toHaveBeenCalledTimes(1);
      expect(notifications.notifyVerificationApproved).toHaveBeenCalledWith({
        farmer: { email: 'farmer@example.com', locale: 'en', displayName: 'Farmer' },
        farmName: 'Kakheti Farm',
      });
    });

    it('sends no second approval email when the farm was already approved', async () => {
      prisma.user.findUnique.mockResolvedValue(confirmedUser('company'));
      prisma.farm.findUnique.mockResolvedValue({
        ...companyFarm(true, [{ kind: 'businessRegistration', reviewStatus: 'approved' }]),
        verificationStatus: 'approved',
      });

      await service.tryCompleteVerification('u1');

      expect(prisma.farm.updateMany).not.toHaveBeenCalled();
      expect(notifications.notifyVerificationApproved).not.toHaveBeenCalled();
    });

    it('still approves a private farmer on an approved ID document', async () => {
      prisma.user.findUnique.mockResolvedValue(confirmedUser('privateFarmer'));
      prisma.farm.findUnique.mockResolvedValue({
        ...companyFarm(null, [{ kind: 'idCard', reviewStatus: 'approved' }]),
        companyRegistrationNumber: null,
        companyRegistryName: null,
      });

      await service.tryCompleteVerification('u1');

      expect(prisma.farm.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ verificationStatus: 'approved' }),
        }),
      );
      expect(notifications.notifyVerificationApproved).toHaveBeenCalledTimes(1);
    });

    it('never lifts a refusal on its own, only a new submission or a moderator can', async () => {
      prisma.user.findUnique.mockResolvedValue(confirmedUser('privateFarmer'));
      prisma.farm.findUnique.mockResolvedValue({
        ...companyFarm(null, [{ kind: 'idCard', reviewStatus: 'approved' }]),
        companyRegistrationNumber: null,
        companyRegistryName: null,
        verificationStatus: 'rejected',
      });

      await service.tryCompleteVerification('u1');

      expect(prisma.farm.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            verificationStatus: { in: ['unverified', 'pending'] },
          }),
        }),
      );
    });
  });

  describe('moderator decisions', () => {
    const farmRow = (verificationStatus: string) => ({
      id: 'farm1',
      ownerId: 'u1',
      name: 'Kakheti Farm',
      owner: { email: 'farmer@example.com', locale: 'ru', displayName: 'Farmer' },
      verificationStatus,
      verificationNote: null,
      verificationReasonCode: null,
      documents: [],
    });

    it('emails the producer once when a moderator approves the farm', async () => {
      prisma.farm.findUnique.mockResolvedValue(farmRow('pending'));

      await service.applyModeratorDecision({
        farmId: 'farm1',
        adminId: 'admin1',
        approve: true,
        note: null,
      });

      expect(prisma.farm.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'farm1',
          verificationStatus: { in: ['unverified', 'pending', 'rejected'] },
        },
        data: {
          verificationStatus: 'approved',
          verificationReasonCode: null,
          verificationNote: null,
          verifiedAt: expect.any(Date),
          verifiedById: 'admin1',
        },
      });
      expect(notifications.notifyVerificationApproved).toHaveBeenCalledTimes(1);
    });

    it('records the moderator reason and comment on a rejection', async () => {
      prisma.farm.findUnique.mockResolvedValue(farmRow('pending'));

      await service.applyModeratorDecision({
        farmId: 'farm1',
        adminId: 'admin1',
        approve: false,
        note: 'The scan is unreadable',
      });

      expect(prisma.farm.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'farm1',
          verificationStatus: { in: ['unverified', 'pending', 'approved'] },
        },
        data: {
          verificationStatus: 'rejected',
          verificationReasonCode: 'moderatorRejected',
          verificationNote: 'The scan is unreadable',
          verifiedAt: null,
          verifiedById: 'admin1',
        },
      });
      expect(notifications.notifyVerificationRejected).toHaveBeenCalledWith({
        farmer: { email: 'farmer@example.com', locale: 'ru', displayName: 'Farmer' },
        farmName: 'Kakheti Farm',
        reasonCode: 'moderatorRejected',
        moderatorComment: 'The scan is unreadable',
      });
    });

    it('repeating a decision only refreshes the comment and emails nobody', async () => {
      prisma.farm.findUnique.mockResolvedValue(farmRow('approved'));
      prisma.farm.updateMany.mockResolvedValue({ count: 0 });

      await service.applyModeratorDecision({
        farmId: 'farm1',
        adminId: 'admin1',
        approve: true,
        note: 'Checked again',
      });

      expect(prisma.farm.update).toHaveBeenCalledWith({
        where: { id: 'farm1' },
        data: { verificationNote: 'Checked again', verificationReasonCode: null },
      });
      expect(notifications.notifyVerificationApproved).not.toHaveBeenCalled();
      expect(notifications.notifyVerificationRejected).not.toHaveBeenCalled();
    });
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
