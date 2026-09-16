import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { AdminService } from '../admin/admin.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FarmsService } from '../farms/farms.service';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestRateLimit } from '../rate-limit/rate-limit.test-utils';
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
  let admin: AdminService;

  const notifications = {
    notifyVerificationPendingModeration: jest.fn().mockResolvedValue(true),
    notifyProductApproved: jest.fn().mockResolvedValue(undefined),
    notifyProductRejected: jest.fn().mockResolvedValue(undefined),
  };

  const registry = { lookup: jest.fn() };

  const storage = {
    upload: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  let ownerId: string;
  let farmId: string;
  let adminUser: AuthenticatedUser;
  const adminEmail = `admin-${randomUUID()}@example.test`;
  const createdUserIds: string[] = [];

  const owner = (): AuthenticatedUser =>
    ({
      id: ownerId,
      email: 'owner@example.test',
      role: 'farmer',
      locale: 'en',
      displayName: 'Owner',
    }) as AuthenticatedUser;

  /**
   * Production notifies every active admin, so the raw call count depends on rows other
   * suites may create. Counting only this farm's alerts to this suite's own admin keeps the
   * assertion about the submission, not about the contents of the shared database.
   */
  const alertsForFarm = (id: string = farmId) =>
    notifications.notifyVerificationPendingModeration.mock.calls.filter(
      ([params]: [{ farmId: string; admin: { email: string } }]) =>
        params.farmId === id && params.admin.email === adminEmail,
    );

  async function uploadDocument(kind: 'idCard' | 'businessRegistration' | 'other', name: string) {
    storage.upload.mockResolvedValue({
      key: `farms/${farmId}/documents/${randomUUID()}.pdf`,
      url: '',
    });
    return farms.uploadDocument(
      owner(),
      'Verification document',
      {
        buffer: Buffer.from('pdf'),
        mimetype: 'application/pdf',
        originalname: name,
        size: 1024,
      } as Express.Multer.File,
      kind,
    );
  }

  const uploadIdCard = (name: string) => uploadDocument('idCard', name);

  const farmRow = () => prisma.farm.findUniqueOrThrow({ where: { id: farmId } });

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    verification = new VerificationService(
      prisma as unknown as PrismaService,
      notifications as never,
      { send: jest.fn() } as never,
      registry as never,
      { issue: jest.fn(), consume: jest.fn().mockResolvedValue({ id: 'code' }) } as never,
      createTestRateLimit().service,
    );
    farms = new FarmsService(
      prisma as unknown as PrismaService,
      { summaryForUser: jest.fn(), summariesForUsers: jest.fn() } as never,
      storage as never,
      verification,
    );
    // Subscriptions and products are never reached by farm or document review.
    admin = new AdminService(
      prisma as unknown as PrismaService,
      notifications as never,
      {} as never,
      verification,
      {} as never,
    );

    const adminRow = await prisma.user.create({
      data: {
        email: adminEmail,
        role: 'admin',
        passwordHash: 'not-used',
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    createdUserIds.push(adminRow.id);
    adminUser = { id: adminRow.id, role: 'admin' } as AuthenticatedUser;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    notifications.notifyVerificationPendingModeration.mockResolvedValue(true);
    const user = await prisma.user.create({
      data: {
        email: `producer-${randomUUID()}@example.test`,
        role: 'farmer',
        passwordHash: 'not-used',
        sellerType: 'privateFarmer',
        emailVerifiedAt: new Date(),
        phone: `+99555${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`,
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

    const farm = await farmRow();
    const stored = await prisma.farmDocument.findUniqueOrThrow({ where: { id: document.id } });

    expect(farm.verificationStatus).toBe('pending');
    expect(stored.reviewStatus).toBe('pending');
    expect(stored.moderationNotifiedAt).toBeInstanceOf(Date);
    expect(alertsForFarm()).toHaveLength(1);
    expect(alertsForFarm()[0][0]).toEqual(
      expect.objectContaining({ farmId, farmName: 'Kakheti Farm', sellerType: 'privateFarmer' }),
    );
  });

  it('does not notify again on repeated submissions or status reads', async () => {
    await uploadIdCard('id.pdf');
    notifications.notifyVerificationPendingModeration.mockClear();

    await verification.ensureIdentityReviewSubmitted(ownerId);
    await verification.getStatus(owner());
    await verification.getStatus(owner());

    expect((await farmRow()).verificationStatus).toBe('pending');
    expect(alertsForFarm()).toHaveLength(0);
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

    expect(alertsForFarm()).toHaveLength(1);
  });

  it('waits for email and phone before entering the moderation queue', async () => {
    await prisma.user.update({ where: { id: ownerId }, data: { phoneVerifiedAt: null } });

    const document = await uploadIdCard('id.pdf');

    let stored = await prisma.farmDocument.findUniqueOrThrow({ where: { id: document.id } });
    expect((await farmRow()).verificationStatus).toBe('unverified');
    expect(stored.moderationNotifiedAt).toBeNull();
    expect(alertsForFarm()).toHaveLength(0);

    await prisma.user.update({ where: { id: ownerId }, data: { phoneVerifiedAt: new Date() } });
    await verification.ensureIdentityReviewSubmitted(ownerId);

    stored = await prisma.farmDocument.findUniqueOrThrow({ where: { id: document.id } });
    expect((await farmRow()).verificationStatus).toBe('pending');
    expect(stored.moderationNotifiedAt).toBeInstanceOf(Date);
    expect(alertsForFarm()).toHaveLength(1);
  });

  it('treats a re-upload after rejection as a new submission', async () => {
    const first = await uploadIdCard('id.pdf');
    await admin.reviewDocument(adminUser, first.id, false, { note: 'illegible scan' });

    expect((await farmRow()).verificationStatus).toBe('rejected');

    notifications.notifyVerificationPendingModeration.mockClear();
    const second = await uploadIdCard('id-2.pdf');

    const stored = await prisma.farmDocument.findUniqueOrThrow({ where: { id: second.id } });
    expect((await farmRow()).verificationStatus).toBe('pending');
    expect(stored.moderationNotifiedAt).toBeInstanceOf(Date);
    expect(alertsForFarm()).toHaveLength(1);
  });

  it('keeps approved producers out of the submission path', async () => {
    await prisma.farm.update({
      where: { id: farmId },
      data: { verificationStatus: 'approved', verifiedAt: new Date() },
    });

    await uploadIdCard('id.pdf');

    expect((await farmRow()).verificationStatus).toBe('approved');
    expect(alertsForFarm()).toHaveLength(0);
  });

  it('approves the private farmer once the moderator accepts the ID document', async () => {
    const document = await uploadIdCard('id.pdf');

    await admin.reviewDocument(adminUser, document.id, true, {});

    const farm = await farmRow();
    expect(farm.verificationStatus).toBe('approved');
    expect((await verification.getStatus(owner())).verified).toBe(true);
    expect(alertsForFarm()).toHaveLength(1);
  });

  it('names the missing requirement when an approved document cannot finish verification', async () => {
    const document = await uploadIdCard('id.pdf');
    await prisma.user.update({ where: { id: ownerId }, data: { phoneVerifiedAt: null } });

    await admin.reviewDocument(adminUser, document.id, true, {});

    let farm = await farmRow();
    expect(farm.verificationStatus).toBe('unverified');
    expect(farm.verificationNote).toBe(
      'Identity document approved; confirm email and phone to finish verification',
    );

    await verification.confirmSmsCode(owner(), '123456');

    farm = await farmRow();
    expect(farm.verificationStatus).toBe('approved');
  });

  describe('moderator rejection of the farm', () => {
    it('is not undone by email or phone confirmation, only by a new document', async () => {
      await uploadIdCard('id.pdf');
      await admin.verifyFarm(adminUser, farmId, false, { note: 'documents do not match' });

      let farm = await farmRow();
      expect(farm.verificationStatus).toBe('rejected');
      // The old document is still pending: the moderator rejected the farm, not the file.
      expect(await prisma.farmDocument.count({ where: { farmId, reviewStatus: 'pending' } })).toBe(
        1,
      );

      notifications.notifyVerificationPendingModeration.mockClear();
      await prisma.user.update({ where: { id: ownerId }, data: { emailVerifiedAt: null } });
      await verification.confirmEmailCode(owner(), '123456');
      await verification.confirmSmsCode(owner(), '123456');

      farm = await farmRow();
      expect(farm.verificationStatus).toBe('rejected');
      expect(farm.verificationNote).toBe('documents do not match');
      expect(alertsForFarm()).toHaveLength(0);

      const replacement = await uploadIdCard('id-2.pdf');

      farm = await farmRow();
      const stored = await prisma.farmDocument.findUniqueOrThrow({
        where: { id: replacement.id },
      });
      expect(farm.verificationStatus).toBe('pending');
      expect(stored.moderationNotifiedAt).toBeInstanceOf(Date);
      expect(alertsForFarm()).toHaveLength(1);
    });
  });

  describe('withdrawing the submitted document', () => {
    it('takes the farm out of moderation and unlocks the seller type again', async () => {
      const document = await uploadIdCard('id.pdf');
      expect((await farmRow()).verificationStatus).toBe('pending');

      await farms.removeDocument(owner(), document.id);

      const farm = await farmRow();
      expect(farm.verificationStatus).toBe('unverified');
      expect(farm.verificationNote).toBeNull();
      expect(await prisma.farmDocument.count({ where: { farmId } })).toBe(0);

      const status = await verification.getStatus(owner());
      expect(status.steps.identity).toBe('todo');
      expect(status.hasPendingVerificationDocument).toBe(false);
      expect(status.sellerTypeLocked).toBe(false);
    });

    it('keeps the farm in moderation while another document is still under review', async () => {
      const first = await uploadIdCard('id.pdf');
      await uploadIdCard('id-2.pdf');

      await farms.removeDocument(owner(), first.id);

      expect((await farmRow()).verificationStatus).toBe('pending');
      expect((await verification.getStatus(owner())).steps.identity).toBe('pending_review');
    });

    it('ignores supporting documents', async () => {
      await uploadIdCard('id.pdf');
      const supporting = await uploadDocument('other', 'prices.pdf');

      await farms.removeDocument(owner(), supporting.id);

      expect((await farmRow()).verificationStatus).toBe('pending');
    });
  });

  describe('company verification', () => {
    beforeEach(async () => {
      await prisma.user.update({ where: { id: ownerId }, data: { sellerType: 'company' } });
    });

    it('never stays pending after the moderator approves the registration document', async () => {
      const document = await uploadDocument('businessRegistration', 'registration.pdf');

      expect((await farmRow()).verificationStatus).toBe('pending');
      expect(alertsForFarm()).toHaveLength(1);

      await admin.reviewDocument(adminUser, document.id, true, {});

      // Registry verification is still the company rule, so the farm leaves the queue
      // instead of being approved by the document alone.
      const farm = await farmRow();
      expect(farm.verificationStatus).toBe('unverified');
      expect(farm.verificationNote).toBe(
        'Registration document approved; complete the company registry check',
      );

      registry.lookup.mockResolvedValue({
        valid: true,
        registrationNumber: '123456789',
        legalName: 'Demo LLC',
        source: 'stub',
        message: 'ok',
      });
      const status = await verification.checkCompanyRegistry(owner(), '123456789');

      expect(status.verified).toBe(true);
      expect((await farmRow()).verificationStatus).toBe('approved');
    });

    it('approves as soon as the registry confirms the company, document review or not', async () => {
      await uploadDocument('businessRegistration', 'registration.pdf');
      registry.lookup.mockResolvedValue({
        valid: true,
        registrationNumber: '123456789',
        legalName: 'Demo LLC',
        source: 'stub',
        message: 'ok',
      });

      const status = await verification.checkCompanyRegistry(owner(), '123456789');

      expect(status.verified).toBe(true);
      expect((await farmRow()).verificationStatus).toBe('approved');
    });

    it('does not approve a company the registry rejects', async () => {
      await uploadDocument('businessRegistration', 'registration.pdf');
      registry.lookup.mockResolvedValue({
        valid: false,
        registrationNumber: '000000000',
        legalName: null,
        source: 'stub',
        message: 'Company not found in the registry',
      });

      await expect(verification.checkCompanyRegistry(owner(), '000000000')).rejects.toThrow(
        'Company not found in the registry',
      );

      const farm = await farmRow();
      expect(farm.verificationStatus).toBe('unverified');
      expect(farm.companyRegistryValid).toBe(false);
    });

    it('drops the company out of moderation when its document is rejected', async () => {
      const document = await uploadDocument('businessRegistration', 'registration.pdf');

      await admin.reviewDocument(adminUser, document.id, false, { note: 'unreadable' });

      expect((await farmRow()).verificationStatus).toBe('rejected');
    });
  });

  describe('mail delivery failures', () => {
    it('releases the claim so a later attempt can still reach the admins', async () => {
      // Every recipient has to fail: the claim is only released when nothing was delivered.
      notifications.notifyVerificationPendingModeration.mockResolvedValue(false);

      const document = await uploadIdCard('id.pdf');

      let stored = await prisma.farmDocument.findUniqueOrThrow({ where: { id: document.id } });
      expect((await farmRow()).verificationStatus).toBe('pending');
      expect(stored.moderationNotifiedAt).toBeNull();

      notifications.notifyVerificationPendingModeration.mockResolvedValue(true);
      await verification.ensureIdentityReviewSubmitted(ownerId);

      stored = await prisma.farmDocument.findUniqueOrThrow({ where: { id: document.id } });
      expect(stored.moderationNotifiedAt).toBeInstanceOf(Date);
      expect(alertsForFarm()).toHaveLength(2);
    });

    it('keeps the claim once an admin actually received the alert', async () => {
      const document = await uploadIdCard('id.pdf');
      notifications.notifyVerificationPendingModeration.mockClear();

      await verification.ensureIdentityReviewSubmitted(ownerId);

      const stored = await prisma.farmDocument.findUniqueOrThrow({ where: { id: document.id } });
      expect(stored.moderationNotifiedAt).toBeInstanceOf(Date);
      expect(alertsForFarm()).toHaveLength(0);
    });
  });

  it('caps admin alerts when a seller loops uploads and deletions', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const document = await uploadIdCard(`id-${attempt}.pdf`);
      await farms.removeDocument(owner(), document.id);
    }

    // Every loop is a fresh submission, but the moderators are paged a bounded number of times.
    expect(alertsForFarm().length).toBeLessThanOrEqual(3);
    expect(alertsForFarm().length).toBeGreaterThan(0);
    expect((await farmRow()).verificationStatus).toBe('unverified');
  });
});
