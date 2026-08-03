import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { CabinetService } from './cabinet.service';

describe('CabinetService account deletion', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    farm: {
      findUnique: jest.fn(),
    },
    verificationCode: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const ratings = { summaryForUser: jest.fn() };
  const storage = { delete: jest.fn().mockResolvedValue(undefined) };
  const notifications = {
    notifyAccountDeletionCode: jest.fn().mockResolvedValue(undefined),
  };

  const service = new CabinetService(
    prisma as never,
    ratings as never,
    storage as never,
    notifications as never,
  );

  const farmer = {
    id: 'user_1',
    email: 'farmer@example.com',
    role: 'farmer' as const,
    sellerType: 'privateFarmer' as const,
    buyerType: 'individual' as const,
    locale: 'en' as const,
    displayName: 'Nino',
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
    });
    prisma.verificationCode.findFirst.mockResolvedValue({
      id: 'c1',
      codeHash,
    });
    prisma.verificationCode.update.mockResolvedValue({ id: 'c1' });
    prisma.farm.findUnique.mockResolvedValue({
      documents: [{ key: 'docs/id.pdf' }],
      products: [
        {
          images: [{ key: 'img/1.jpg' }],
          videos: [],
          certificates: [],
        },
      ],
    });
    prisma.user.delete.mockResolvedValue({ id: 'user_1' });

    await expect(service.confirmAccountDeletion(farmer, 'password1', code)).resolves.toEqual({
      ok: true,
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user_1' } });
    expect(storage.delete).toHaveBeenCalledWith('docs/id.pdf');
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
});
