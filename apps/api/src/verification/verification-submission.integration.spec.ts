import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FarmsService } from '../farms/farms.service';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestPrismaClient, describeWithDatabase } from '../test-support/database';
import { VerificationService } from './verification.service';

/**
 * The submission guarantees live in SQL: the farm only leaves `unverified`/`rejected`
 * through a conditional update, and the admin notification is claimed by flipping
 * `moderationNotifiedAt` from null. Both are only meaningful against a real database.
 */
describeWithDatabase()('producer verification submission (database)', () => {
  let prisma: PrismaClient;
  let verification: VerificationService;
  let farms: FarmsService;

  const notifications = {
    notifyVerificationPendingModeration: jest.fn().mockResolvedValue(undefined),
  };

  const storage = {
    upload: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  let ownerId: string;
  let farmId: string;
  const createdUserIds: string[] = [];

  const owner = (): AuthenticatedUser =>
    ({
      id: ownerId,
      email: 'owner@example.test',
      role: 'farmer',
      locale: 'en',
      displayName: 'Owner',
    }) as AuthenticatedUser;

  async function uploadIdCard(name: string) {
    storage.upload.mockResolvedValue({
      key: `farms/${farmId}/documents/${randomUUID()}.pdf`,
      url: '',
    });
    return farms.uploadDocument(
      owner(),
      'ID card',
      {
        buffer: Buffer.from('pdf'),
        mimetype: 'application/pdf',
        originalname: name,
        size: 1024,
      } as Express.Multer.File,
      'idCard',
    );
  }

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    verification = new VerificationService(
      prisma as unknown as PrismaService,
      notifications as never,
      { send: jest.fn() } as never,
      { lookup: jest.fn() } as never,
      { issue: jest.fn(), consume: jest.fn() } as never,
    );
    farms = new FarmsService(
      prisma as unknown as PrismaService,
      { summaryForUser: jest.fn(), summariesForUsers: jest.fn() } as never,
      storage as never,
      verification,
    );

    const admin = await prisma.user.create({
      data: {
        email: `admin-${randomUUID()}@example.test`,
        role: 'admin',
        passwordHash: 'not-used',
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    createdUserIds.push(admin.id);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const user = await prisma.user.create({
      data: {
        email: `producer-${randomUUID()}@example.test`,
        role: 'farmer',
        passwordHash: 'not-used',
        sellerType: 'privateFarmer',
        emailVerifiedAt: new Date(),
        phone: '+995555123456',
        phoneVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    ownerId = user.id;
    createdUserIds.push(user.id);

    const farm = await prisma.farm.create({
      data: { ownerId, name: 'Kakheti Farm' },
      select: { id: true },
    });
    farmId = farm.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('submits the farm for review and notifies admins once on upload', async () => {
    const document = await uploadIdCard('id.pdf');

    const farm = await prisma.farm.findUniqueOrThrow({ where: { id: farmId } });
    const stored = await prisma.farmDocument.findUniqueOrThrow({ where: { id: document.id } });

    expect(farm.verificationStatus).toBe('pending');
    expect(stored.reviewStatus).toBe('pending');
    expect(stored.moderationNotifiedAt).toBeInstanceOf(Date);
    expect(notifications.notifyVerificationPendingModeration).toHaveBeenCalledTimes(1);
    expect(notifications.notifyVerificationPendingModeration).toHaveBeenCalledWith(
      expect.objectContaining({ farmId, farmName: 'Kakheti Farm', sellerType: 'privateFarmer' }),
    );
  });

  it('does not notify again on repeated submissions or status reads', async () => {
    await uploadIdCard('id.pdf');
    notifications.notifyVerificationPendingModeration.mockClear();

    await verification.ensureIdentityReviewSubmitted(ownerId);
    await verification.getStatus(owner());
    await verification.getStatus(owner());

    const farm = await prisma.farm.findUniqueOrThrow({ where: { id: farmId } });
    expect(farm.verificationStatus).toBe('pending');
    expect(notifications.notifyVerificationPendingModeration).not.toHaveBeenCalled();
  });

  it('notifies exactly once when concurrent requests race on the same document', async () => {
    await prisma.farmDocument.create({
      data: {
        farmId,
        title: 'ID card',
        fileName: 'id.pdf',
        url: '',
        key: `farms/${farmId}/documents/${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        kind: 'idCard',
      },
    });

    await Promise.all([
      verification.ensureIdentityReviewSubmitted(ownerId),
      verification.ensureIdentityReviewSubmitted(ownerId),
      verification.ensureIdentityReviewSubmitted(ownerId),
    ]);

    expect(notifications.notifyVerificationPendingModeration).toHaveBeenCalledTimes(1);
  });

  it('waits for email and phone before entering the moderation queue', async () => {
    await prisma.user.update({
      where: { id: ownerId },
      data: { phoneVerifiedAt: null },
    });

    const document = await uploadIdCard('id.pdf');

    let farm = await prisma.farm.findUniqueOrThrow({ where: { id: farmId } });
    let stored = await prisma.farmDocument.findUniqueOrThrow({ where: { id: document.id } });
    expect(farm.verificationStatus).toBe('unverified');
    expect(stored.moderationNotifiedAt).toBeNull();
    expect(notifications.notifyVerificationPendingModeration).not.toHaveBeenCalled();

    await prisma.user.update({
      where: { id: ownerId },
      data: { phoneVerifiedAt: new Date() },
    });
    await verification.ensureIdentityReviewSubmitted(ownerId);

    farm = await prisma.farm.findUniqueOrThrow({ where: { id: farmId } });
    stored = await prisma.farmDocument.findUniqueOrThrow({ where: { id: document.id } });
    expect(farm.verificationStatus).toBe('pending');
    expect(stored.moderationNotifiedAt).toBeInstanceOf(Date);
    expect(notifications.notifyVerificationPendingModeration).toHaveBeenCalledTimes(1);
  });

  it('treats a re-upload after rejection as a new submission', async () => {
    const first = await uploadIdCard('id.pdf');
    await prisma.farmDocument.update({
      where: { id: first.id },
      data: { reviewStatus: 'rejected', reviewNote: 'illegible scan', reviewedAt: new Date() },
    });
    await verification.syncAfterIdentityDocumentRejected(ownerId);

    let farm = await prisma.farm.findUniqueOrThrow({ where: { id: farmId } });
    expect(farm.verificationStatus).toBe('rejected');

    notifications.notifyVerificationPendingModeration.mockClear();
    const second = await uploadIdCard('id-2.pdf');

    farm = await prisma.farm.findUniqueOrThrow({ where: { id: farmId } });
    const stored = await prisma.farmDocument.findUniqueOrThrow({ where: { id: second.id } });
    expect(farm.verificationStatus).toBe('pending');
    expect(stored.moderationNotifiedAt).toBeInstanceOf(Date);
    expect(notifications.notifyVerificationPendingModeration).toHaveBeenCalledTimes(1);
  });

  it('keeps approved producers out of the submission path', async () => {
    await prisma.farm.update({
      where: { id: farmId },
      data: { verificationStatus: 'approved', verifiedAt: new Date() },
    });

    await uploadIdCard('id.pdf');

    const farm = await prisma.farm.findUniqueOrThrow({ where: { id: farmId } });
    expect(farm.verificationStatus).toBe('approved');
    expect(notifications.notifyVerificationPendingModeration).not.toHaveBeenCalled();
  });
});
