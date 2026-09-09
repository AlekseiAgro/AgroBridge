import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { canTrade, isSellerType, normalizeInternationalPhone, type ProducerVerificationStatus, type SellerType } from '@agrobridge/shared';
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
import { SmsService } from '../sms/sms.service';
import { GeorgiaCompanyRegistryService } from './georgia-company-registry.service';
import { VerificationCodeService } from './verification-code.service';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly sms: SmsService,
    private readonly registry: GeorgiaCompanyRegistryService,
    private readonly codes: VerificationCodeService,
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
        if (error.kind === 'invalid_destination' || error.kind === 'rejected') {
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

    await this.prisma.farm.update({
      where: { id: farm.id },
      data: {
        verificationStatus: VerificationStatus.pending,
        verificationNote: 'Awaiting moderator review of ID document',
        verifiedAt: null,
        verifiedById: null,
      },
    });

    return this.getStatus(user);
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
