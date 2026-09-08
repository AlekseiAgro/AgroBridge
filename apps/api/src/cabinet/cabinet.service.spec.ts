import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RateLimitExceededException } from '../rate-limit/rate-limit-exceeded.exception';
import { CabinetService } from './cabinet.service';

describe('CabinetService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    farm: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    rfq: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    purchaseRequest: {
      count: jest.fn(),
    },
    conversation: {
      count: jest.fn(),
    },
  };

  // The code lifecycle itself (attempt cap, atomicity, replay) is covered against a real
  // database in verification/verification-code.service.integration.spec.ts.
  const codes = {
    issue: jest.fn().mockResolvedValue('123456'),
    consume: jest.fn().mockResolvedValue({ id: 'c1', destination: 'new@example.com' }),
  };

  const ratings = { summaryForUser: jest.fn() };
  const storage = {
    upload: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = {
    notifyAccountDeletionCode: jest.fn().mockResolvedValue(undefined),
    notifyEmailChangeCode: jest.fn().mockResolvedValue(undefined),
  };
  const chat = {
    unreadTotal: jest.fn().mockResolvedValue({ count: 0 }),
  };

  const service = new CabinetService(
    prisma as never,
    ratings as never,
    storage as never,
    notifications as never,
    chat as never,
    codes as never,
  );

  const farmer = {
    id: 'user_1',
    email: 'farmer@example.com',
    role: 'farmer' as const,
    sellerType: 'privateFarmer' as const,
    buyerType: 'individual' as const,
    locale: 'en' as const,
    displayName: 'Nino',
    avatarUrl: null,
    emailVerified: true,
  };

  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('password1', 4);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    codes.issue.mockResolvedValue('123456');
    codes.consume.mockResolvedValue({ id: 'c1', destination: 'new@example.com' });
  });

  it('includes open purchase requests in openRequests activity', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...farmer,
      avatarUrl: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      farm: null,
    });
    ratings.summaryForUser.mockResolvedValue({
      average: 0,
      count: 0,
    });
    prisma.rfq.count
      .mockResolvedValueOnce(0) // completed as buyer
      .mockResolvedValueOnce(0) // completed as seller
      .mockResolvedValueOnce(2) // open buyer RFQs
      .mockResolvedValueOnce(1); // open inbox RFQs
    prisma.purchaseRequest.count.mockResolvedValue(3);
    prisma.conversation.count.mockResolvedValue(0);
    prisma.product.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prisma.rfq.findMany.mockResolvedValue([]);

    await expect(service.overview(farmer)).resolves.toEqual(
      expect.objectContaining({
        activity: expect.objectContaining({
          openRequests: 6,
        }),
      }),
    );
    expect(prisma.purchaseRequest.count).toHaveBeenCalledWith({
      where: {
        buyerId: farmer.id,
        status: 'open',
      },
    });
  });

  it('refuses to delete admin accounts', async () => {
    await expect(
      service.requestAccountDeletion({ ...farmer, role: 'admin' }, 'password1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects incorrect password when requesting deletion', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Nino',
      passwordHash,
    });

    await expect(service.requestAccountDeletion(farmer, 'wrong-pass')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('sends a deletion code after password check', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Nino',
      passwordHash,
    });

    await expect(service.requestAccountDeletion(farmer, 'password1')).resolves.toEqual({
      sent: true,
      destination: 'farmer@example.com',
    });
    expect(notifications.notifyAccountDeletionCode).toHaveBeenCalled();
    expect(codes.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        channel: 'accountDeletion',
        destination: 'farmer@example.com',
      }),
    );
  });

  it('deletes the account after password and code confirmation', async () => {
    const code = '123456';

    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Nino',
      passwordHash,
      avatarKey: 'users/user_1/avatar.jpg',
    });
    prisma.farm.findUnique.mockResolvedValue({
      documents: [{ key: 'docs/id.pdf' }],
      images: [{ key: 'farms/1/photos/a.jpg' }],
    });
    prisma.product.findMany.mockResolvedValue([
      {
        images: [{ key: 'img/1.jpg' }],
        videos: [],
        certificates: [],
      },
    ]);
    prisma.user.delete.mockResolvedValue({ id: 'user_1' });

    await expect(service.confirmAccountDeletion(farmer, 'password1', code)).resolves.toEqual({
      ok: true,
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user_1' } });
    expect(storage.delete).toHaveBeenCalledWith('users/user_1/avatar.jpg');
    expect(storage.delete).toHaveBeenCalledWith('docs/id.pdf');
    expect(storage.delete).toHaveBeenCalledWith('farms/1/photos/a.jpg');
    expect(storage.delete).toHaveBeenCalledWith('img/1.jpg');
  });

  it('rejects invalid confirmation codes', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Nino',
      passwordHash,
    });
    codes.consume.mockRejectedValue(
      new BadRequestException('Invalid or expired confirmation code'),
    );

    await expect(
      service.confirmAccountDeletion(farmer, 'password1', '000000'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('uploads an avatar and replaces the previous file', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: 'users/user_1/old.webp' });
    storage.upload.mockResolvedValue({
      key: 'users/user_1/new.webp',
      url: '/api/uploads/users/user_1/new.webp',
    });
    prisma.user.update.mockResolvedValue({});

    await expect(
      service.uploadAvatar(farmer, {
        mimetype: 'image/webp',
        size: 1200,
        buffer: Buffer.from('x'),
        originalname: 'photo.webp',
      } as Express.Multer.File),
    ).resolves.toEqual({ avatarUrl: '/api/uploads/users/user_1/new.webp' });

    expect(storage.upload).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        avatarUrl: '/api/uploads/users/user_1/new.webp',
        avatarKey: 'users/user_1/new.webp',
      },
    });
    expect(storage.delete).toHaveBeenCalledWith('users/user_1/old.webp');
  });

  it('rejects unsupported avatar types', async () => {
    await expect(
      service.uploadAvatar(farmer, {
        mimetype: 'image/gif',
        size: 100,
        buffer: Buffer.from('x'),
        originalname: 'x.gif',
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates display name', async () => {
    prisma.user.update.mockResolvedValue({});
    await expect(service.updateProfile(farmer, '  Aleksei  ')).resolves.toEqual({
      displayName: 'Aleksei',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { displayName: 'Aleksei' },
    });
  });

  it('requests email change and mails the old address', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'user_1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Nino',
        passwordHash,
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.requestEmailChange(farmer, 'password1', 'New@Example.com'),
    ).resolves.toEqual({
      sent: true,
      destination: 'farmer@example.com',
      newEmail: 'new@example.com',
    });

    expect(notifications.notifyEmailChangeCode).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ email: 'farmer@example.com' }),
        newEmail: 'new@example.com',
      }),
    );
    expect(codes.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'emailChange',
        destination: 'new@example.com',
      }),
    );
  });

  it('rejects email change to an already registered address', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'user_1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Nino',
        passwordHash,
      })
      .mockResolvedValueOnce({ id: 'other' });

    await expect(
      service.requestEmailChange(farmer, 'password1', 'taken@example.com'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirms email change and clears verification', async () => {
    const code = '654321';
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'user_1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Nino',
        passwordHash,
      })
      .mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValue({});

    await expect(service.confirmEmailChange(farmer, 'password1', code)).resolves.toEqual({
      ok: true,
      email: 'new@example.com',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        email: 'new@example.com',
        emailVerifiedAt: null,
      },
    });
  });

  describe('confirmation-code protection', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user_1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Nino',
        passwordHash,
      });
    });

    it('reports the caller address so per-IP limits apply to cabinet codes', async () => {
      await service.requestAccountDeletion(farmer, 'password1', '203.0.113.44');
      expect(codes.issue).toHaveBeenCalledWith(
        expect.objectContaining({ ip: '203.0.113.44' }),
      );

      await service.confirmEmailChange(farmer, 'password1', '654321', '203.0.113.44');
      expect(codes.consume).toHaveBeenCalledWith(
        expect.objectContaining({ ip: '203.0.113.44', channel: 'emailChange' }),
      );
    });

    it('propagates throttling instead of sending another code', async () => {
      codes.issue.mockRejectedValue(new RateLimitExceededException(60));

      await expect(
        service.requestAccountDeletion(farmer, 'password1', '203.0.113.44'),
      ).rejects.toBeInstanceOf(RateLimitExceededException);
      expect(notifications.notifyAccountDeletionCode).not.toHaveBeenCalled();
    });

    it('refuses deletion when the challenge is out of attempts', async () => {
      codes.consume.mockRejectedValue(new RateLimitExceededException(60));

      await expect(
        service.confirmAccountDeletion(farmer, 'password1', '000000', '203.0.113.44'),
      ).rejects.toBeInstanceOf(RateLimitExceededException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });
});
