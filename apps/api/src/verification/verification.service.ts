import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  canTrade,
  isSellerType,
  normalizeInternationalPhone,
  PRIMARY_VERIFICATION_DOCUMENT_KIND,
  type ProducerVerificationStatus,
  type SellerType,
} from '@agrobridge/shared';
import {
  DocumentReviewStatus,
  FarmDocumentKind,
  VerificationChannel,
  VerificationStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { MAIL_UNAVAILABLE_CLIENT_MESSAGE } from '../mail/mail.config';
import {
  SMS_INVALID_PHONE_CLIENT_MESSAGE,
  SMS_UNAVAILABLE_CLIENT_MESSAGE,
  SmsDeliveryError,
} from '../sms/sms.errors';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitExceededException } from '../rate-limit/rate-limit-exceeded.exception';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { SmsService } from '../sms/sms.service';
import { GeorgiaCompanyRegistryService } from './georgia-company-registry.service';
import { VerificationCodeService } from './verification-code.service';

/**
 * A farm may announce a few submissions per hour. That covers a genuine resubmission after a
 * rejection, but not an upload/delete loop used to spam moderators.
 */
const SUBMISSION_NOTIFICATION_ACTION = 'verification.submission.notify';
const SUBMISSION_NOTIFICATION_LIMIT = 3;
const SUBMISSION_NOTIFICATION_WINDOW_MS = 60 * 60 * 1000;

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly sms: SmsService,
    private readonly registry: GeorgiaCompanyRegistryService,
    private readonly codes: VerificationCodeService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async getStatus(user: AuthenticatedUser): Promise<ProducerVerificationStatus> {
    this.assertProducer(user);
    const dbUser = await this.requireUser(user.id);
    const farm = await this.prisma.farm.findUnique({
      where: { ownerId: user.id },
      include: {
        documents: {
          where: {
            kind: {
              in: [FarmDocumentKind.idCard, FarmDocumentKind.businessRegistration],
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const idDocuments = farm?.documents.filter((doc) => doc.kind === FarmDocumentKind.idCard) ?? [];
    const hasApprovedIdDocument = idDocuments.some(
      (doc) => doc.reviewStatus === DocumentReviewStatus.approved,
    );
    const hasPendingIdDocument = idDocuments.some(
      (doc) => doc.reviewStatus === DocumentReviewStatus.pending,
    );
    const hasRejectedOnly =
      idDocuments.length > 0 &&
      idDocuments.every((doc) => doc.reviewStatus === DocumentReviewStatus.rejected) &&
      !hasApprovedIdDocument &&
      !hasPendingIdDocument;

    const sellerType = (dbUser.sellerType as SellerType | null) ?? null;
    const path =
      sellerType === 'company'
        ? 'company'
        : sellerType === 'privateFarmer'
          ? 'privateFarmer'
          : 'unknown';

    const primaryKind = sellerType ? PRIMARY_VERIFICATION_DOCUMENT_KIND[sellerType] : null;
    const hasPendingVerificationDocument = Boolean(
      primaryKind &&
      farm?.documents.some(
        (doc) => doc.kind === primaryKind && doc.reviewStatus === DocumentReviewStatus.pending,
      ),
    );

    let identity: ProducerVerificationStatus['steps']['identity'] = 'todo';
    if (path === 'company') {
      if (farm?.companyRegistryValid === true) identity = 'done';
      else if (farm?.companyRegistryValid === false) identity = 'rejected';
    } else if (path === 'privateFarmer') {
      if (hasApprovedIdDocument || farm?.verificationStatus === VerificationStatus.approved) {
        identity = 'done';
      } else if (farm?.verificationStatus === VerificationStatus.pending || hasPendingIdDocument) {
        identity = 'pending_review';
      } else if (hasRejectedOnly || farm?.verificationStatus === VerificationStatus.rejected) {
        identity = 'rejected';
      }
    }

    const emailVerified = Boolean(dbUser.emailVerifiedAt);
    const phoneVerified = Boolean(dbUser.phoneVerifiedAt);
    const verified = farm?.verificationStatus === VerificationStatus.approved;

    return {
      verified,
      farmVerificationStatus: (farm?.verificationStatus ??
        VerificationStatus.unverified) as ProducerVerificationStatus['farmVerificationStatus'],
      verificationNote: farm?.verificationNote ?? null,
      sellerType,
      emailVerified,
      phone: dbUser.phone,
      phoneVerified,
      companyRegistrationNumber: farm?.companyRegistrationNumber ?? null,
      companyRegistryName: farm?.companyRegistryName ?? null,
      companyRegistryValid: farm?.companyRegistryValid ?? null,
      hasApprovedIdDocument,
      hasPendingIdDocument,
      hasPendingVerificationDocument,
      sellerTypeLocked: this.isSellerTypeChangeLocked(farm, sellerType),
      path,
      steps: {
        email: emailVerified ? 'done' : 'todo',
        phone: phoneVerified ? 'done' : 'todo',
        identity,
      },
    };
  }

  async sendEmailCode(
    user: AuthenticatedUser,
    ip?: string | null,
  ): Promise<{ sent: true; destination: string }> {
    this.assertProducer(user);
    const dbUser = await this.requireUser(user.id);
    if (dbUser.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }
    const code = await this.codes.issue({
      userId: user.id,
      channel: VerificationChannel.email,
      destination: dbUser.email,
      ip,
    });
    try {
      await this.notifications.notifyVerificationCode({
        user: {
          email: dbUser.email,
          locale: dbUser.locale,
          displayName: dbUser.displayName,
        },
        code,
        channel: 'email',
      });
    } catch {
      throw new ServiceUnavailableException(MAIL_UNAVAILABLE_CLIENT_MESSAGE);
    }
    return { sent: true, destination: dbUser.email };
  }

  async confirmEmailCode(
    user: AuthenticatedUser,
    code: string,
    ip?: string | null,
  ): Promise<ProducerVerificationStatus> {
    this.assertProducer(user);
    await this.codes.consume({
      userId: user.id,
      channel: VerificationChannel.email,
      code,
      ip,
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    await this.tryCompleteVerification(user.id);
    await this.ensureIdentityReviewSubmitted(user.id);
    return this.getStatus(user);
  }

  async sendSmsCode(
    user: AuthenticatedUser,
    phoneRaw: string,
    ip?: string | null,
    country?: string | null,
  ): Promise<{ sent: true; destination: string }> {
    this.assertProducer(user);
    const phone = this.normalizePhone(phoneRaw, country);
    const dbUser = await this.requireUser(user.id);
    if (dbUser.phoneVerifiedAt && dbUser.phone === phone) {
      throw new BadRequestException('Phone is already verified');
    }

    // Throttle before touching the profile so a blocked request cannot reset phoneVerifiedAt.
    const code = await this.codes.issue({
      userId: user.id,
      channel: VerificationChannel.sms,
      destination: phone,
      ip,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        phone,
        phoneVerifiedAt: null,
      },
    });

    try {
      await this.sms.send({
        to: phone,
        text: `AgroBridge verification code: ${code}`,
      });
    } catch (error) {
      if (error instanceof SmsDeliveryError) {
        if (error.kind === 'invalid_destination') {
          throw new BadRequestException(SMS_INVALID_PHONE_CLIENT_MESSAGE);
        }
        throw new ServiceUnavailableException(SMS_UNAVAILABLE_CLIENT_MESSAGE);
      }
      throw new ServiceUnavailableException(SMS_UNAVAILABLE_CLIENT_MESSAGE);
    }
    return { sent: true, destination: phone };
  }

  async confirmSmsCode(
    user: AuthenticatedUser,
    code: string,
    ip?: string | null,
  ): Promise<ProducerVerificationStatus> {
    this.assertProducer(user);
    await this.codes.consume({
      userId: user.id,
      channel: VerificationChannel.sms,
      code,
      ip,
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerifiedAt: new Date() },
    });
    await this.tryCompleteVerification(user.id);
    await this.ensureIdentityReviewSubmitted(user.id);
    return this.getStatus(user);
  }

  async setSellerType(
    user: AuthenticatedUser,
    sellerTypeRaw: string,
  ): Promise<ProducerVerificationStatus> {
    this.assertProducer(user);
    if (!isSellerType(sellerTypeRaw)) {
      throw new BadRequestException('Seller type is invalid');
    }

    const dbUser = await this.requireUser(user.id);
    const current = (dbUser.sellerType as SellerType | null) ?? null;
    if (current === sellerTypeRaw) {
      return this.getStatus(user);
    }

    const farm = await this.prisma.farm.findUnique({
      where: { ownerId: user.id },
      select: {
        verificationStatus: true,
        companyRegistryValid: true,
        documents: {
          where: {
            kind: {
              in: [FarmDocumentKind.idCard, FarmDocumentKind.businessRegistration],
            },
          },
          select: { kind: true },
        },
      },
    });
    if (this.isSellerTypeChangeLocked(farm, current)) {
      throw new BadRequestException('Seller type cannot be changed after verification has started');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { sellerType: sellerTypeRaw },
    });

    return this.getStatus(user);
  }

  async checkCompanyRegistry(
    user: AuthenticatedUser,
    registrationNumber: string,
  ): Promise<ProducerVerificationStatus> {
    this.assertProducer(user);
    const dbUser = await this.requireUser(user.id);
    if (dbUser.sellerType !== 'company') {
      throw new BadRequestException('Company registry check is only for company sellers');
    }
    const farm = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    if (!farm) {
      throw new NotFoundException('Create a farm profile before company verification');
    }

    const result = await this.registry.lookup(registrationNumber);
    await this.prisma.farm.update({
      where: { id: farm.id },
      data: {
        companyRegistrationNumber: result.registrationNumber,
        companyRegistryName: result.legalName,
        companyRegistryCheckedAt: new Date(),
        companyRegistryValid: result.valid,
        ...(result.valid
          ? {}
          : {
              verificationStatus: VerificationStatus.unverified,
              verificationNote: result.message,
              verifiedAt: null,
              verifiedById: null,
            }),
      },
    });

    if (!result.valid) {
      throw new BadRequestException(result.message);
    }

    await this.tryCompleteVerification(user.id);
    return this.getStatus(user);
  }

  /**
   * Legacy explicit submission endpoint. Uploading the identity document already
   * submits the review, so this only validates the private-farmer preconditions and
   * replays the same idempotent transition for API clients that still call it.
   */
  async submitPrivateFarmerReview(
    user: AuthenticatedUser,
  ): Promise<ProducerVerificationStatus> {
    this.assertProducer(user);
    const dbUser = await this.requireUser(user.id);
    if (dbUser.sellerType !== 'privateFarmer') {
      throw new BadRequestException('Manual ID review is only for private farmers');
    }
    if (!dbUser.emailVerifiedAt || !dbUser.phoneVerifiedAt) {
      throw new BadRequestException('Verify email and phone before submitting for review');
    }

    const farm = await this.prisma.farm.findUnique({
      where: { ownerId: user.id },
      include: {
        documents: { where: { kind: FarmDocumentKind.idCard } },
      },
    });
    if (!farm) {
      throw new NotFoundException('Create a farm profile before verification');
    }
    const hasId = farm.documents.some(
      (doc) =>
        doc.reviewStatus === DocumentReviewStatus.pending ||
        doc.reviewStatus === DocumentReviewStatus.approved,
    );
    if (!hasId) {
      throw new BadRequestException('Upload an ID card document before submitting');
    }

    await this.ensureIdentityReviewSubmitted(user.id);

    return this.getStatus(user);
  }

  /**
   * Authoritative submission transition. Uploading a primary identity document puts the
   * farm into moderation and notifies admins exactly once per submitted document.
   *
   * Only write paths call this (document upload, email/SMS confirmation). Reads such as
   * GET /verification/me never reach it, so refreshes and polling cannot notify anyone.
   */
  async ensureIdentityReviewSubmitted(userId: string): Promise<void> {
    const dbUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const sellerType = (dbUser?.sellerType as SellerType | null) ?? null;
    if (!dbUser || !sellerType) return;
    // Email and SMS remain mandatory before a producer enters the moderation queue.
    if (!dbUser.emailVerifiedAt || !dbUser.phoneVerifiedAt) return;

    const primaryKind = PRIMARY_VERIFICATION_DOCUMENT_KIND[sellerType] as FarmDocumentKind;
    const farm = await this.prisma.farm.findUnique({
      where: { ownerId: userId },
      include: {
        documents: {
          // Only a document moderation has never been told about is a submission. That is
          // what stops an email or SMS confirmation from reopening a decided application.
          where: {
            kind: primaryKind,
            reviewStatus: DocumentReviewStatus.pending,
            moderationNotifiedAt: null,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!farm || farm.verificationStatus === VerificationStatus.approved) return;

    const document = farm.documents[0];
    if (!document) return;

    await this.prisma.farm.updateMany({
      where: {
        id: farm.id,
        verificationStatus: {
          in: [VerificationStatus.unverified, VerificationStatus.rejected],
        },
      },
      data: {
        verificationStatus: VerificationStatus.pending,
        verificationNote: 'Awaiting moderator review of the verification document',
        verifiedAt: null,
        verifiedById: null,
      },
    });

    // The conditional update is the idempotency claim: only the request that flips
    // moderationNotifiedAt from null sends the email.
    const claimedAt = new Date();
    const claimed = await this.prisma.farmDocument.updateMany({
      where: { id: document.id, moderationNotifiedAt: null },
      data: { moderationNotifiedAt: claimedAt },
    });
    if (claimed.count !== 1) return;

    if (!(await this.allowSubmissionNotification(farm.id))) {
      // The farm is in the moderator queue either way; only the repeated mail is dropped.
      this.logger.warn(
        `Suppressed repeated verification submission notification for farm ${farm.id}`,
      );
      return;
    }

    const delivered = await this.notifyAdminsVerificationPending({
      farmId: farm.id,
      farmName: farm.name,
      sellerType,
      submittedAt: document.createdAt,
    });
    if (!delivered) {
      // Nothing reached an admin, so the claim must not block a later attempt. Matching the
      // timestamp keeps this from releasing a claim another request has taken meanwhile.
      await this.prisma.farmDocument.updateMany({
        where: { id: document.id, moderationNotifiedAt: claimedAt },
        data: { moderationNotifiedAt: null },
      });
    }
  }

  /**
   * Reconciles the farm with its primary documents after a moderation decision or after the
   * seller removed one. Only a farm currently in moderation can change here: an approved farm
   * is terminal, and an unverified or rejected one has no submission left to reconcile.
   */
  async syncPrimaryDocumentState(userId: string): Promise<void> {
    const dbUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const sellerType = (dbUser?.sellerType as SellerType | null) ?? null;
    if (!dbUser || !sellerType) return;

    const primaryKind = PRIMARY_VERIFICATION_DOCUMENT_KIND[sellerType] as FarmDocumentKind;
    const farm = await this.prisma.farm.findUnique({
      where: { ownerId: userId },
      include: { documents: { where: { kind: primaryKind } } },
    });
    if (!farm || farm.verificationStatus !== VerificationStatus.pending) return;

    const reviewStatuses = new Set(farm.documents.map((doc) => doc.reviewStatus));
    if (reviewStatuses.has(DocumentReviewStatus.pending)) return;

    if (reviewStatuses.has(DocumentReviewStatus.approved)) {
      // Document moderation is done, but tryCompleteVerification did not finish the farm, so
      // a path requirement is still open: the registry check, or a contact to re-confirm.
      await this.leaveModeration(
        farm.id,
        VerificationStatus.unverified,
        sellerType === 'company'
          ? 'Registration document approved; complete the company registry check'
          : 'Identity document approved; confirm email and phone to finish verification',
      );
      return;
    }

    if (reviewStatuses.has(DocumentReviewStatus.rejected)) {
      await this.leaveModeration(
        farm.id,
        VerificationStatus.rejected,
        'Verification document rejected',
      );
      return;
    }

    // The seller withdrew the document, so there is no submission left to review.
    await this.leaveModeration(farm.id, VerificationStatus.unverified, null);
  }

  private async leaveModeration(
    farmId: string,
    status: VerificationStatus,
    note: string | null,
  ): Promise<void> {
    await this.prisma.farm.update({
      where: { id: farmId },
      data: {
        verificationStatus: status,
        verificationNote: note,
        verifiedAt: null,
        verifiedById: null,
      },
    });
  }

  /**
   * Caps how often one farm can page the moderators. Exceeding the budget only drops the
   * mail: the farm is already queued, and counter problems must never silence a submission.
   */
  private async allowSubmissionNotification(farmId: string): Promise<boolean> {
    try {
      await this.rateLimit.consume([
        {
          action: SUBMISSION_NOTIFICATION_ACTION,
          scope: { account: farmId },
          limit: SUBMISSION_NOTIFICATION_LIMIT,
          windowMs: SUBMISSION_NOTIFICATION_WINDOW_MS,
        },
      ]);
      return true;
    } catch (error) {
      if (error instanceof RateLimitExceededException) {
        return false;
      }
      this.logger.error(
        `Verification notification throttle unavailable for farm ${farmId}`,
        error instanceof Error ? error.name : 'unknown error',
      );
      return true;
    }
  }

  /**
   * Best-effort: a mail failure must not undo a stored document or state transition. Returns
   * false when nothing reached an admin, so the caller can release the notification claim.
   */
  private async notifyAdminsVerificationPending(params: {
    farmId: string;
    farmName: string;
    sellerType: SellerType;
    submittedAt: Date;
  }): Promise<boolean> {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'admin', blockedAt: null },
        select: { email: true, locale: true, displayName: true },
      });
      // Without a recipient there is nothing a retry could deliver.
      if (admins.length === 0) return true;

      const results = await Promise.all(
        admins.map((admin) =>
          this.notifications.notifyVerificationPendingModeration({
            admin,
            farmId: params.farmId,
            farmName: params.farmName,
            sellerType: params.sellerType,
            submittedAt: params.submittedAt,
          }),
        ),
      );
      return results.some(Boolean);
    } catch (error) {
      // Never log document contents, keys, or URLs: only the farm id and the error name.
      this.logger.error(
        `Failed to notify admins about verification submission for farm ${params.farmId}`,
        error instanceof Error ? error.name : 'unknown error',
      );
      return false;
    }
  }

  /** Called after admin approves farm or ID document. */
  async tryCompleteVerification(userId: string): Promise<void> {
    const dbUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const farm = await this.prisma.farm.findUnique({
      where: { ownerId: userId },
      include: {
        documents: { where: { kind: FarmDocumentKind.idCard } },
      },
    });
    if (!dbUser || !farm) return;
    if (farm.verificationStatus === VerificationStatus.approved) return;
    if (!dbUser.emailVerifiedAt || !dbUser.phoneVerifiedAt) return;

    if (dbUser.sellerType === 'company' && farm.companyRegistryValid === true) {
      await this.prisma.farm.update({
        where: { id: farm.id },
        data: {
          verificationStatus: VerificationStatus.approved,
          verificationNote: 'Verified via email, SMS, and company registry check',
          verifiedAt: new Date(),
          verifiedById: null,
        },
      });
      return;
    }

    if (dbUser.sellerType === 'privateFarmer') {
      const hasApprovedId = farm.documents.some(
        (doc) => doc.reviewStatus === DocumentReviewStatus.approved,
      );
      if (hasApprovedId) {
        await this.prisma.farm.update({
          where: { id: farm.id },
          data: {
            verificationStatus: VerificationStatus.approved,
            verificationNote: 'Verified via email, SMS, and ID document review',
            verifiedAt: new Date(),
          },
        });
      }
    }
  }

  /**
   * First selection is allowed. Switching is locked once identity evidence or a
   * farm verification status other than unverified exists. Email/SMS alone do not lock.
   */
  private isSellerTypeChangeLocked(
    farm: {
      verificationStatus: VerificationStatus;
      companyRegistryValid: boolean | null;
      documents: Array<{ kind: FarmDocumentKind }>;
    } | null,
    currentSellerType: SellerType | null,
  ): boolean {
    if (farm?.verificationStatus === VerificationStatus.approved) {
      return true;
    }
    if (!currentSellerType) {
      return false;
    }
    return this.hasIdentityVerificationStarted(farm);
  }

  private hasIdentityVerificationStarted(
    farm: {
      verificationStatus: VerificationStatus;
      companyRegistryValid: boolean | null;
      documents: Array<{ kind: FarmDocumentKind }>;
    } | null,
  ): boolean {
    if (!farm) {
      return false;
    }
    if (
      farm.verificationStatus === VerificationStatus.pending ||
      farm.verificationStatus === VerificationStatus.approved ||
      farm.verificationStatus === VerificationStatus.rejected
    ) {
      return true;
    }
    if (farm.companyRegistryValid !== null) {
      return true;
    }
    return farm.documents.some(
      (doc) =>
        doc.kind === FarmDocumentKind.idCard ||
        doc.kind === FarmDocumentKind.businessRegistration,
    );
  }

  private normalizePhone(value: string, country?: string | null): string {
    const e164 = normalizeInternationalPhone(value, country);
    if (!e164) {
      throw new BadRequestException(SMS_INVALID_PHONE_CLIENT_MESSAGE);
    }
    return e164;
  }

  private assertProducer(user: AuthenticatedUser) {
    if (!canTrade(user.role)) {
      throw new ForbiddenException('Sign in to use producer verification');
    }
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
