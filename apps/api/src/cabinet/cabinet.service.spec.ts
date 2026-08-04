import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
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
    },
    verificationCode: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
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
    prisma.verificationCode.create.mockResolvedValue({ id: 'c1' });

    await expect(service.requestAccountDeletion(farmer, 'password1')).resolves.toEqual({
      sent: true,
      destination: 'farmer@example.com',
    });
    expect(notifications.notifyAccountDeletionCode).toHaveBeenCalled();
    expect(prisma.verificationCode.create).toHaveBeenCalled();
  });

  it('deletes the account after password and code confirmation', async () => {
    const code = '123456';
    const codeHash = createHash('sha256').update(code).digest('hex');

    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'farmer@example.com',
      locale: 'en',
      displayName: 'Nino',
      passwordHash,
      avatarKey: 'users/user_1/avatar.jpg',
    });
    prisma.verificationCode.findFirst.mockResolvedValue({
      id: 'c1',
      codeHash,
    });
    prisma.verificationCode.update.mockResolvedValue({ id: 'c1' });
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
    prisma.verificationCode.findFirst.mockResolvedValue(null);

    await expect(
      service.confirmAccountDeletion(farmer, 'password1', '000000'),
    ).rejects.toBeInstanceOf(BadRequestException);
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
    prisma.verificationCode.create.mockResolvedValue({ id: 'c1' });

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
    expect(prisma.verificationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: 'emailChange',
          destination: 'new@example.com',
        }),
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
    const codeHash = createHash('sha256').update(code).digest('hex');
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'user_1',
        email: 'farmer@example.com',
        locale: 'en',
        displayName: 'Nino',
        passwordHash,
      })
      .mockResolvedValueOnce(null);
    prisma.verificationCode.findFirst.mockResolvedValue({
      id: 'c1',
      codeHash,
      destination: 'new@example.com',
    });
    prisma.verificationCode.update.mockResolvedValue({ id: 'c1' });
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
});
