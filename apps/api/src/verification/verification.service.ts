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
  VerificationReasonCode,
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

const ALL_VERIFICATION_STATUSES = [
  VerificationStatus.unverified,
  VerificationStatus.pending,
  VerificationStatus.approved,
  VerificationStatus.rejected,
] as const;

/**
 * Statuses automatic completion may finish. A rejection is deliberately absent: only a new
 * submission (which moves the farm back to `pending`) or an explicit moderator approval may
 * undo it, so re-confirming an email or a phone can never quietly reverse a refusal.
 */
const AUTO_COMPLETABLE_STATUSES = [
  VerificationStatus.unverified,
  VerificationStatus.pending,
] as const;

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

    // The farm-level decision always wins over the documents behind it. A rejection that still
    // rendered as "done" or "in review" would hide the outcome and, worse, hide the upload
    // control the seller needs to apply again.
    const farmLevelIdentity: ProducerVerificationStatus['steps']['identity'] | null =
      farm?.verificationStatus === VerificationStatus.approved
        ? 'done'
        : farm?.verificationStatus === VerificationStatus.rejected
          ? 'rejected'
          : farm?.verificationStatus === VerificationStatus.pending
            ? 'pending_review'
            : null;

    let identity: ProducerVerificationStatus['steps']['identity'] = 'todo';
    if (farmLevelIdentity) {
      identity = farmLevelIdentity;
    } else if (path === 'company') {
      // A company is only done once the registry matched *and* a moderator accepted the
      // registration document. The registry check alone never finishes the step.
      const companyDocuments = farm?.documents.filter(
        (doc) => doc.kind === FarmDocumentKind.businessRegistration,
      );
      const hasApprovedCompanyDocument = companyDocuments?.some(
        (doc) => doc.reviewStatus === DocumentReviewStatus.approved,
      );
      const hasPendingCompanyDocument = companyDocuments?.some(
        (doc) => doc.reviewStatus === DocumentReviewStatus.pending,
      );
      const companyDocumentsRejectedOnly = Boolean(
        companyDocuments?.length && !hasApprovedCompanyDocument && !hasPendingCompanyDocument,
      );

      if (farm?.companyRegistryValid === true && hasApprovedCompanyDocument) {
        identity = 'done';
      } else if (hasPendingCompanyDocument) {
        identity = 'pending_review';
      } else if (farm?.companyRegistryValid === false || companyDocumentsRejectedOnly) {
        identity = 'rejected';
      }
    } else if (path === 'privateFarmer') {
      if (hasApprovedIdDocument) {
        identity = 'done';
      } else if (hasPendingIdDocument) {
        identity = 'pending_review';
      } else if (hasRejectedOnly) {
        identity = 'rejected';
      }
    }

    const emailVerified = Boolean(dbUser.emailVerifiedAt);
    const phoneVerified = Boolean(dbUser.phoneVerifiedAt);
    const verified = farm?.verificationStatus === VerificationStatus.approved;

    const reasonCode = farm?.verificationReasonCode ?? null;
    // Only a moderator's own words may reach the seller. Every other note is an internal
    // message, including the English strings rows carried before reason codes existed.
    const moderatorComment =
      reasonCode === 'moderatorRejected' ? (farm?.verificationNote ?? null) : null;

    return {
      verified,
      farmVerificationStatus: farm?.verificationStatus ?? VerificationStatus.unverified,
      verificationReasonCode: reasonCode,
      moderatorComment,
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
        // `confirmed`, not `valid`: an accepted code is not an answered registry. Null keeps
        // the farm out of both the approval gate and the "registry refused you" state.
        companyRegistryValid: result.confirmed,
      },
    });

    if (!result.valid) {
      // A failed retry clears an application that is still in flight, but the seller must not
      // be able to revoke a moderator's decision by mistyping their registration number.
      await this.applyFarmStatus({
        farmId: farm.id,
        from: [VerificationStatus.unverified, VerificationStatus.pending],
        to: VerificationStatus.unverified,
        reasonCode: VerificationReasonCode.registryNotConfirmed,
        note: null,
        verifiedById: null,
      });
      throw new BadRequestException(result.message);
    }

    if (result.confirmed === true) {
      // The registry now matches, so the refusal it caused is stale. Scoped to that one code so a
      // rejected document or a moderator's refusal keeps its own reason.
      // A merely accepted code clears nothing: the registry still has not confirmed anything.
      await this.prisma.farm.updateMany({
        where: { id: farm.id, verificationReasonCode: VerificationReasonCode.registryNotConfirmed },
        data: { verificationReasonCode: null },
      });
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

    await this.applyFarmStatus({
      farmId: farm.id,
      from: [VerificationStatus.unverified, VerificationStatus.rejected],
      to: VerificationStatus.pending,
      reasonCode: null,
      note: null,
      verifiedById: null,
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
          ? VerificationReasonCode.registryNotConfirmed
          : VerificationReasonCode.contactConfirmationRequired,
      );
      return;
    }

    if (reviewStatuses.has(DocumentReviewStatus.rejected)) {
      await this.leaveModeration(
        farm.id,
        VerificationStatus.rejected,
        VerificationReasonCode.documentRejected,
      );
      return;
    }

    // The seller withdrew the document, so there is no submission left to review.
    await this.leaveModeration(farm.id, VerificationStatus.unverified, null);
  }

  /**
   * Records a moderator's approval or rejection of the whole farm. Lives here rather than in
   * AdminService so every status change — automatic or manual — passes the same transition
   * guard and therefore the same exactly-once decision email.
   */
  async applyModeratorDecision(params: {
    farmId: string;
    adminId: string;
    approve: boolean;
    note: string | null;
  }): Promise<void> {
    const target = params.approve ? VerificationStatus.approved : VerificationStatus.rejected;
    const reasonCode = params.approve ? null : VerificationReasonCode.moderatorRejected;

    const changed = await this.applyFarmStatus({
      farmId: params.farmId,
      from: ALL_VERIFICATION_STATUSES.filter((status) => status !== target),
      to: target,
      reasonCode,
      note: params.note,
      verifiedById: params.adminId,
    });
    if (changed) return;

    // Repeating a decision is not a transition: the moderator may only refresh their comment,
    // and the producer must not be emailed again.
    await this.prisma.farm.update({
      where: { id: params.farmId },
      data: { verificationNote: params.note, verificationReasonCode: reasonCode },
    });
  }

  private async leaveModeration(
    farmId: string,
    status: VerificationStatus,
    reasonCode: VerificationReasonCode | null,
  ): Promise<void> {
    await this.applyFarmStatus({
      farmId,
      from: [VerificationStatus.pending],
      to: status,
      reasonCode,
      note: null,
      verifiedById: null,
    });
  }

  /**
   * The single writer of Farm.verificationStatus. The conditional update is what makes the
   * decision email exactly-once: a request that does not actually move the status changes
   * nothing and notifies nobody, so duplicate admin clicks and replayed transitions are safe.
   */
  private async applyFarmStatus(params: {
    farmId: string;
    from: readonly VerificationStatus[];
    to: VerificationStatus;
    reasonCode: VerificationReasonCode | null;
    note: string | null;
    verifiedById: string | null;
  }): Promise<boolean> {
    const approved = params.to === VerificationStatus.approved;
    const changed = await this.prisma.farm.updateMany({
      where: { id: params.farmId, verificationStatus: { in: [...params.from] } },
      data: {
        verificationStatus: params.to,
        verificationReasonCode: params.reasonCode,
        verificationNote: params.note,
        verifiedAt: approved ? new Date() : null,
        verifiedById: params.verifiedById,
      },
    });
    if (changed.count !== 1) return false;

    if (approved || params.to === VerificationStatus.rejected) {
      await this.notifyProducerDecision(params.farmId, params.to, params.reasonCode, params.note);
    }
    return true;
  }

  /**
   * Best-effort: a mail outage must never roll back a moderation decision that is already
   * stored, so this only logs. The producer can still see the outcome in the cabinet.
   */
  private async notifyProducerDecision(
    farmId: string,
    status: VerificationStatus,
    reasonCode: VerificationReasonCode | null,
    moderatorComment: string | null,
  ): Promise<void> {
    try {
      const farm = await this.prisma.farm.findUnique({
        where: { id: farmId },
        select: {
          name: true,
          owner: { select: { email: true, locale: true, displayName: true } },
        },
      });
      if (!farm) return;

      if (status === VerificationStatus.approved) {
        await this.notifications.notifyVerificationApproved({
          farmer: farm.owner,
          farmName: farm.name,
        });
        return;
      }
      await this.notifications.notifyVerificationRejected({
        farmer: farm.owner,
        farmName: farm.name,
        reasonCode,
        moderatorComment,
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify the producer about the verification decision for farm ${farmId}`,
        error instanceof Error ? error.name : 'unknown error',
      );
    }
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
        documents: {
          where: {
            kind: { in: [FarmDocumentKind.idCard, FarmDocumentKind.businessRegistration] },
          },
        },
      },
    });
    if (!dbUser || !farm) return;
    if (farm.verificationStatus === VerificationStatus.approved) return;
    if (!dbUser.emailVerifiedAt || !dbUser.phoneVerifiedAt) return;

    const hasApprovedDocument = (kind: FarmDocumentKind) =>
      farm.documents.some(
        (doc) => doc.kind === kind && doc.reviewStatus === DocumentReviewStatus.approved,
      );

    if (dbUser.sellerType === 'company') {
      // Both halves are required, and `true` means a registry actually answered. Where none
      // is connected the flag stays null, so this gate never opens on its own and the
      // company waits for a moderator's explicit decision instead.
      const registryConfirmed = farm.companyRegistryValid === true;
      if (!registryConfirmed || !hasApprovedDocument(FarmDocumentKind.businessRegistration)) {
        return;
      }
      await this.applyFarmStatus({
        farmId: farm.id,
        from: AUTO_COMPLETABLE_STATUSES,
        to: VerificationStatus.approved,
        reasonCode: null,
        note: null,
        verifiedById: null,
      });
      return;
    }

    if (dbUser.sellerType === 'privateFarmer' && hasApprovedDocument(FarmDocumentKind.idCard)) {
      await this.applyFarmStatus({
        farmId: farm.id,
        from: AUTO_COMPLETABLE_STATUSES,
        to: VerificationStatus.approved,
        reasonCode: null,
        note: null,
        verifiedById: null,
      });
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
