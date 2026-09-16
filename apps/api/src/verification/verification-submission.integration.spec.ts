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
    notifyVerificationApproved: jest.fn().mockResolvedValue(true),
    notifyVerificationRejected: jest.fn().mockResolvedValue(true),
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
    notifications.notifyVerificationApproved.mockResolvedValue(true);
    notifications.notifyVerificationRejected.mockResolvedValue(true);
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
    expect(notifications.notifyVerificationApproved).toHaveBeenCalledTimes(1);
  });

  it('names the missing requirement when an approved document cannot finish verification', async () => {
    const document = await uploadIdCard('id.pdf');
    await prisma.user.update({ where: { id: ownerId }, data: { phoneVerifiedAt: null } });

    await admin.reviewDocument(adminUser, document.id, true, {});

    let farm = await farmRow();
    expect(farm.verificationStatus).toBe('unverified');
    expect(farm.verificationReasonCode).toBe('contactConfirmationRequired');
    // The requirement is a code, never an English sentence stored for the seller to read.
    expect(farm.verificationNote).toBeNull();

    await verification.confirmSmsCode(owner(), '123456');

    farm = await farmRow();
    expect(farm.verificationStatus).toBe('approved');
    expect(farm.verificationReasonCode).toBeNull();
  });

  it('leaves a rejected producer a way back even when their document was accepted', async () => {
    const document = await uploadIdCard('id.pdf');
    await admin.reviewDocument(adminUser, document.id, true, {});
    expect((await farmRow()).verificationStatus).toBe('approved');

    await admin.verifyFarm(adminUser, farmId, false, { note: 'the farm is not what it claims' });

    // 'done' would hide the upload control and strand the seller with no way to reapply.
    const status = await verification.getStatus(owner());
    expect(status.steps.identity).toBe('rejected');
    expect(status.verified).toBe(false);

    const replacement = await uploadIdCard('id-2.pdf');
    expect((await farmRow()).verificationStatus).toBe('pending');
    expect((await verification.getStatus(owner())).steps.identity).toBe('pending_review');
    expect(replacement.reviewStatus).toBe('pending');
  });

  it('does not let a contact re-confirmation undo a moderator refusal', async () => {
    const document = await uploadIdCard('id.pdf');
    await admin.reviewDocument(adminUser, document.id, true, {});
    await admin.verifyFarm(adminUser, farmId, false, { note: 'the farm is not what it claims' });
    notifications.notifyVerificationApproved.mockClear();

    // What an email or phone confirmation runs. The approved document is still on file, so
    // without the transition guard this would quietly reinstate the badge.
    await verification.tryCompleteVerification(ownerId);

    expect((await farmRow()).verificationStatus).toBe('rejected');
    expect(notifications.notifyVerificationApproved).not.toHaveBeenCalled();
  });

  it('never shows a producer an internal note as if a moderator had written it', async () => {
    const document = await uploadIdCard('id.pdf');
    await admin.reviewDocument(adminUser, document.id, false, { note: 'illegible scan' });

    const status = await verification.getStatus(owner());

    expect(status.farmVerificationStatus).toBe('rejected');
    expect(status.verificationReasonCode).toBe('documentRejected');
    expect(status.moderatorComment).toBeNull();
  });

  describe('producer decision emails', () => {
    it('sends exactly one approval email per real transition', async () => {
      const document = await uploadIdCard('id.pdf');

      await admin.reviewDocument(adminUser, document.id, true, {});
      await admin.verifyFarm(adminUser, farmId, true, { note: 'looks good' });

      expect((await farmRow()).verificationStatus).toBe('approved');
      expect(notifications.notifyVerificationApproved).toHaveBeenCalledTimes(1);
      expect(notifications.notifyVerificationRejected).not.toHaveBeenCalled();
    });

    it('sends exactly one rejection email per real transition', async () => {
      await uploadIdCard('id.pdf');

      await admin.verifyFarm(adminUser, farmId, false, { note: 'documents do not match' });
      await admin.verifyFarm(adminUser, farmId, false, { note: 'documents do not match' });

      expect((await farmRow()).verificationStatus).toBe('rejected');
      expect(notifications.notifyVerificationRejected).toHaveBeenCalledTimes(1);
      expect(notifications.notifyVerificationRejected).toHaveBeenCalledWith(
        expect.objectContaining({
          reasonCode: 'moderatorRejected',
          moderatorComment: 'documents do not match',
        }),
      );
    });

    it('lets a moderator refresh the comment without emailing the producer again', async () => {
      await uploadIdCard('id.pdf');
      await admin.verifyFarm(adminUser, farmId, false, { note: 'first reason' });
      notifications.notifyVerificationRejected.mockClear();

      await admin.verifyFarm(adminUser, farmId, false, { note: 'second reason' });

      expect((await farmRow()).verificationNote).toBe('second reason');
      expect(notifications.notifyVerificationRejected).not.toHaveBeenCalled();
    });

    it('uses the producer locale and keeps the decision when the mail fails', async () => {
      await prisma.user.update({ where: { id: ownerId }, data: { locale: 'ka' } });
      notifications.notifyVerificationRejected.mockRejectedValue(new Error('resend down'));
      await uploadIdCard('id.pdf');

      await admin.verifyFarm(adminUser, farmId, false, { note: 'unreadable' });

      expect((await farmRow()).verificationStatus).toBe('rejected');
      expect(notifications.notifyVerificationRejected).toHaveBeenCalledWith(
        expect.objectContaining({ farmer: expect.objectContaining({ locale: 'ka' }) }),
      );
    });
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
      expect(farm.verificationReasonCode).toBe('moderatorRejected');
      expect(farm.verificationNote).toBe('documents do not match');
      expect(alertsForFarm()).toHaveLength(0);

      // The stale pending document must not present the refusal as "still in review".
      const rejectedStatus = await verification.getStatus(owner());
      expect(rejectedStatus.steps.identity).toBe('rejected');
      expect(rejectedStatus.verificationReasonCode).toBe('moderatorRejected');
      expect(rejectedStatus.moderatorComment).toBe('documents do not match');

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

    it('refuses to remove the approved document a verified producer rests on', async () => {
      const document = await uploadIdCard('id.pdf');
      await admin.reviewDocument(adminUser, document.id, true, {});
      expect((await farmRow()).verificationStatus).toBe('approved');

      await expect(farms.removeDocument(owner(), document.id)).rejects.toThrow(
        'The approved verification document cannot be deleted while the producer is verified',
      );

      expect(await prisma.farmDocument.count({ where: { id: document.id } })).toBe(1);
      expect((await farmRow()).verificationStatus).toBe('approved');
    });

    it('still removes a rejected primary document from a verified producer', async () => {
      const rejected = await uploadIdCard('id.pdf');
      await admin.reviewDocument(adminUser, rejected.id, false, { note: 'unreadable' });
      const approved = await uploadIdCard('id-2.pdf');
      await admin.reviewDocument(adminUser, approved.id, true, {});
      expect((await farmRow()).verificationStatus).toBe('approved');

      await farms.removeDocument(owner(), rejected.id);

      expect(await prisma.farmDocument.count({ where: { id: rejected.id } })).toBe(0);
      expect((await farmRow()).verificationStatus).toBe('approved');
    });

    it('still removes supporting documents from a verified producer', async () => {
      const document = await uploadIdCard('id.pdf');
      await admin.reviewDocument(adminUser, document.id, true, {});
      const supporting = await uploadDocument('other', 'prices.pdf');

      await farms.removeDocument(owner(), supporting.id);

      expect(await prisma.farmDocument.count({ where: { id: supporting.id } })).toBe(0);
    });
  });

  describe('company verification', () => {
    beforeEach(async () => {
      await prisma.user.update({ where: { id: ownerId }, data: { sellerType: 'company' } });
    });

    const registryMatches = (registrationNumber = '123456789') => {
      registry.lookup.mockResolvedValue({
        valid: true,
        registrationNumber,
        legalName: `Registry stub company ${registrationNumber}`,
        source: 'stub',
        message: 'ok',
      });
    };

    it('never stays pending after the moderator approves the registration document', async () => {
      const document = await uploadDocument('businessRegistration', 'registration.pdf');

      expect((await farmRow()).verificationStatus).toBe('pending');
      expect(alertsForFarm()).toHaveLength(1);

      await admin.reviewDocument(adminUser, document.id, true, {});

      // Registry verification is still the company rule, so the farm leaves the queue
      // instead of being approved by the document alone.
      const farm = await farmRow();
      expect(farm.verificationStatus).toBe('unverified');
      expect(farm.verificationReasonCode).toBe('registryNotConfirmed');
      expect(farm.verificationNote).toBeNull();
      expect(notifications.notifyVerificationApproved).not.toHaveBeenCalled();

      registryMatches();
      const status = await verification.checkCompanyRegistry(owner(), '123456789');

      expect(status.verified).toBe(true);
      expect((await farmRow()).verificationStatus).toBe('approved');
      expect(notifications.notifyVerificationApproved).toHaveBeenCalledTimes(1);
    });

    it('stops blaming the registry once a retry matches', async () => {
      registry.lookup.mockResolvedValue({
        valid: false,
        registrationNumber: '1234567',
        legalName: null,
        source: 'stub',
        message: 'Identification code must be exactly 9 digits',
      });
      await expect(verification.checkCompanyRegistry(owner(), '1234567')).rejects.toThrow(
        'Identification code must be exactly 9 digits',
      );
      expect((await farmRow()).verificationReasonCode).toBe('registryNotConfirmed');

      registryMatches();
      const status = await verification.checkCompanyRegistry(owner(), '123456789');

      // Telling the seller the registry failed while showing them the matched company name
      // would be a contradiction they cannot act on.
      expect(status.companyRegistryValid).toBe(true);
      expect(status.verificationReasonCode).toBeNull();
      expect(status.steps.identity).toBe('todo');
    });

    it('keeps a document refusal when a later registry retry matches', async () => {
      const document = await uploadDocument('businessRegistration', 'registration.pdf');
      await admin.reviewDocument(adminUser, document.id, false, { note: 'unreadable' });
      expect((await farmRow()).verificationReasonCode).toBe('documentRejected');

      registryMatches();
      const status = await verification.checkCompanyRegistry(owner(), '123456789');

      expect(status.farmVerificationStatus).toBe('rejected');
      expect(status.verificationReasonCode).toBe('documentRejected');
    });

    it('does not approve on a registry match while the document is still under review', async () => {
      await uploadDocument('businessRegistration', 'registration.pdf');
      registryMatches();

      const status = await verification.checkCompanyRegistry(owner(), '123456789');

      // The registry lookup is a stub that trusts any 9-digit code, so on its own it must
      // never be enough: the farm stays in the moderation queue.
      expect(status.verified).toBe(false);
      expect((await farmRow()).verificationStatus).toBe('pending');
      expect(notifications.notifyVerificationApproved).not.toHaveBeenCalled();
    });

    it('does not approve a company on a made-up nine-digit code with no approved document', async () => {
      registryMatches('987654321');

      const status = await verification.checkCompanyRegistry(owner(), '987654321');

      expect(status.verified).toBe(false);
      const farm = await farmRow();
      expect(farm.companyRegistryValid).toBe(true);
      expect(farm.verificationStatus).toBe('unverified');
      expect(notifications.notifyVerificationApproved).not.toHaveBeenCalled();
    });

    it('does not approve a company whose registration document was rejected', async () => {
      const document = await uploadDocument('businessRegistration', 'registration.pdf');
      await admin.reviewDocument(adminUser, document.id, false, { note: 'unreadable' });
      registryMatches();

      const status = await verification.checkCompanyRegistry(owner(), '123456789');

      expect(status.verified).toBe(false);
      expect((await farmRow()).verificationStatus).toBe('rejected');
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

    it('does not let a mistyped registration number revoke a granted badge', async () => {
      const document = await uploadDocument('businessRegistration', 'registration.pdf');
      await admin.reviewDocument(adminUser, document.id, true, {});
      registryMatches();
      await verification.checkCompanyRegistry(owner(), '123456789');
      expect((await farmRow()).verificationStatus).toBe('approved');

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
      expect(farm.verificationStatus).toBe('approved');
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
