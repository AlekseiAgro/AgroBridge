import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { canTrade, type ProducerVerificationStatus, type SellerType } from '@agrobridge/shared';
import {
  DocumentReviewStatus,
  FarmDocumentKind,
  VerificationChannel,
  VerificationStatus,
} from '@prisma/client';
import { createHash, randomInt } from 'crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { GeorgiaCompanyRegistryService } from './georgia-company-registry.service';

const CODE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly sms: SmsService,
    private readonly registry: GeorgiaCompanyRegistryService,
  ) {}

  async getStatus(user: AuthenticatedUser): Promise<ProducerVerificationStatus> {
    this.assertProducer(user);
    const dbUser = await this.requireUser(user.id);
    const farm = await this.prisma.farm.findUnique({
      where: { ownerId: user.id },
      include: {
        documents: {
          where: { kind: FarmDocumentKind.idCard },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const hasApprovedIdDocument = Boolean(
      farm?.documents.some((doc) => doc.reviewStatus === DocumentReviewStatus.approved),
    );
    const hasPendingIdDocument = Boolean(
      farm?.documents.some((doc) => doc.reviewStatus === DocumentReviewStatus.pending),
    );
    const hasRejectedOnly =
      Boolean(farm?.documents.length) &&
      farm!.documents.every((doc) => doc.reviewStatus === DocumentReviewStatus.rejected) &&
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
      path,
      steps: {
        email: emailVerified ? 'done' : 'todo',
        phone: phoneVerified ? 'done' : 'todo',
        identity,
      },
    };
  }

  async sendEmailCode(user: AuthenticatedUser): Promise<{ sent: true; destination: string }> {
    this.assertProducer(user);
    const dbUser = await this.requireUser(user.id);
    if (dbUser.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }
    const code = await this.issueCode(user.id, VerificationChannel.email, dbUser.email);
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
      throw new ServiceUnavailableException(
        'Could not send the verification email. Please try again in a moment.',
      );
    }
    return { sent: true, destination: dbUser.email };
  }

  async confirmEmailCode(
    user: AuthenticatedUser,
    code: string,
  ): Promise<ProducerVerificationStatus> {
    this.assertProducer(user);
    await this.consumeCode(user.id, VerificationChannel.email, code);
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
  ): Promise<{ sent: true; destination: string }> {
    this.assertProducer(user);
    const phone = this.normalizePhone(phoneRaw);
    const dbUser = await this.requireUser(user.id);
    if (dbUser.phoneVerifiedAt && dbUser.phone === phone) {
      throw new BadRequestException('Phone is already verified');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        phone,
        phoneVerifiedAt: null,
      },
    });

    const code = await this.issueCode(user.id, VerificationChannel.sms, phone);
    await this.sms.send({
      to: phone,
      text: `AgroBridge verification code: ${code}`,
    });
    return { sent: true, destination: phone };
  }

  async confirmSmsCode(
    user: AuthenticatedUser,
    code: string,
  ): Promise<ProducerVerificationStatus> {
    this.assertProducer(user);
    await this.consumeCode(user.id, VerificationChannel.sms, code);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerifiedAt: new Date() },
    });
    await this.tryCompleteVerification(user.id);
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

  private async issueCode(
    userId: string,
    channel: VerificationChannel,
    destination: string,
  ): Promise<string> {
    const code = String(randomInt(100000, 999999));
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await this.prisma.verificationCode.create({
      data: {
        userId,
        channel,
        destination,
        codeHash,
        expiresAt,
      },
    });

    return code;
  }

  private async consumeCode(
    userId: string,
    channel: VerificationChannel,
    code: string,
  ): Promise<void> {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new BadRequestException('Enter the 6-digit verification code');
    }

    const latest = await this.prisma.verificationCode.findFirst({
      where: {
        userId,
        channel,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest || latest.codeHash !== this.hashCode(trimmed)) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.verificationCode.update({
      where: { id: latest.id },
      data: { consumedAt: new Date() },
    });
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private normalizePhone(value: string): string {
    const trimmed = value.trim().replace(/[()\s-]/g, '');
    if (!/^\+?[0-9]{9,15}$/.test(trimmed)) {
      throw new BadRequestException('Enter a valid phone number with country code');
    }
    return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
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
