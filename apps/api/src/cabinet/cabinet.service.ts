import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { canTrade, type CabinetOverview } from '@agrobridge/shared';
import {
  ModerationStatus as PrismaModerationStatus,
  RfqStatus as PrismaRfqStatus,
  VerificationChannel,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RatingsService } from '../ratings/ratings.service';
import { StorageService } from '../storage/storage.service';

const CODE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class CabinetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratings: RatingsService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async overview(user: AuthenticatedUser): Promise<CabinetOverview> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { farm: { select: { id: true } } },
    });
    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    const rating = await this.ratings.summaryForUser(user.id);
    const trader = canTrade(user.role);

    const [
      completedAsBuyer,
      completedAsSeller,
      openBuyerRequests,
      openInboxRequests,
      conversations,
      publishedProducts,
      pendingModeration,
      awaitingMyRating,
    ] = await Promise.all([
      trader
        ? this.prisma.rfq.count({
            where: { buyerId: user.id, status: PrismaRfqStatus.completed },
          })
        : Promise.resolve(0),
      trader && dbUser.farm
        ? this.prisma.rfq.count({
            where: { farmId: dbUser.farm.id, status: PrismaRfqStatus.completed },
          })
        : Promise.resolve(0),
      trader
        ? this.prisma.rfq.count({
            where: {
              buyerId: user.id,
              status: { in: [PrismaRfqStatus.pending, PrismaRfqStatus.offered, PrismaRfqStatus.accepted] },
            },
          })
        : Promise.resolve(0),
      trader && dbUser.farm
        ? this.prisma.rfq.count({
            where: {
              farmId: dbUser.farm.id,
              status: { in: [PrismaRfqStatus.pending, PrismaRfqStatus.offered, PrismaRfqStatus.accepted] },
            },
          })
        : Promise.resolve(0),
      this.prisma.conversation.count({
        where: {
          OR: [{ buyerId: user.id }, { farmerId: user.id }],
        },
      }),
      trader && dbUser.farm
        ? this.prisma.product.count({
            where: {
              farmId: dbUser.farm.id,
              isPublished: true,
              moderationStatus: PrismaModerationStatus.approved,
            },
          })
        : Promise.resolve(0),
      trader && dbUser.farm
        ? this.prisma.product.count({
            where: {
              farmId: dbUser.farm.id,
              moderationStatus: PrismaModerationStatus.pending,
            },
          })
        : Promise.resolve(0),
      this.countAwaitingRating(user.id, dbUser.farm?.id ?? null),
    ]);

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        sellerType: dbUser.sellerType,
        buyerType: dbUser.buyerType,
        locale: dbUser.locale,
        displayName: dbUser.displayName,
        rating,
        memberSince: dbUser.createdAt.toISOString(),
      },
      activity: {
        completedDeals: completedAsBuyer + completedAsSeller,
        openRequests: openBuyerRequests + openInboxRequests,
        conversations,
        publishedProducts,
        pendingModeration,
        awaitingMyRating,
      },
    };
  }

  async requestAccountDeletion(
    user: AuthenticatedUser,
    password: string,
  ): Promise<{ sent: true; destination: string }> {
    this.assertDeletable(user);
    const dbUser = await this.requireUserWithPassword(user.id);
    await this.assertPassword(dbUser.passwordHash, password);

    const code = String(randomInt(100000, 999999));
    await this.prisma.verificationCode.create({
      data: {
        userId: user.id,
        channel: VerificationChannel.accountDeletion,
        destination: dbUser.email,
        codeHash: this.hashCode(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    try {
      await this.notifications.notifyAccountDeletionCode({
        user: {
          email: dbUser.email,
          locale: dbUser.locale,
          displayName: dbUser.displayName,
        },
        code,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message.replace(/\s+/g, ' ').trim().slice(0, 180)
          : 'unknown mail error';
      throw new ServiceUnavailableException(
        `Could not send the deletion confirmation email (${detail}). Check SMTP settings and try again.`,
      );
    }

    return { sent: true, destination: dbUser.email };
  }

  async confirmAccountDeletion(
    user: AuthenticatedUser,
    password: string,
    code: string,
  ): Promise<{ ok: true }> {
    this.assertDeletable(user);
    const dbUser = await this.requireUserWithPassword(user.id);
    await this.assertPassword(dbUser.passwordHash, password);
    await this.consumeDeletionCode(user.id, code);

    const farm = await this.prisma.farm.findUnique({
      where: { ownerId: user.id },
      select: {
        documents: { select: { key: true } },
        products: {
          select: {
            images: { select: { key: true } },
            videos: { select: { key: true } },
            certificates: { select: { key: true } },
          },
        },
      },
    });

    const storageKeys: string[] = [];
    if (farm) {
      for (const document of farm.documents) storageKeys.push(document.key);
      for (const product of farm.products) {
        for (const image of product.images) storageKeys.push(image.key);
        for (const video of product.videos) storageKeys.push(video.key);
        for (const certificate of product.certificates) storageKeys.push(certificate.key);
      }
    }

    await this.prisma.user.delete({ where: { id: user.id } });

    await Promise.all(
      storageKeys.map(async (key) => {
        try {
          await this.storage.delete(key);
        } catch {
          // Best-effort cleanup after the account row is already gone.
        }
      }),
    );

    return { ok: true };
  }

  private assertDeletable(user: AuthenticatedUser) {
    if (user.role === 'admin') {
      throw new ForbiddenException('Admin accounts cannot be deleted from the cabinet');
    }
  }

  private async requireUserWithPassword(userId: string) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        locale: true,
        displayName: true,
        passwordHash: true,
      },
    });
    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }
    return dbUser;
  }

  private async assertPassword(passwordHash: string | null, password: string) {
    if (!passwordHash) {
      throw new BadRequestException('Password login is not configured for this account');
    }
    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Incorrect password');
    }
  }

  private async consumeDeletionCode(userId: string, code: string) {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new BadRequestException('Enter the 6-digit confirmation code from your email');
    }

    const latest = await this.prisma.verificationCode.findFirst({
      where: {
        userId,
        channel: VerificationChannel.accountDeletion,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest || latest.codeHash !== this.hashCode(trimmed)) {
      throw new BadRequestException('Invalid or expired confirmation code');
    }

    await this.prisma.verificationCode.update({
      where: { id: latest.id },
      data: { consumedAt: new Date() },
    });
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private async countAwaitingRating(userId: string, farmId: string | null) {
    const deals = await this.prisma.rfq.findMany({
      where: {
        status: PrismaRfqStatus.completed,
        OR: [{ buyerId: userId }, ...(farmId ? [{ farmId }] : [])],
      },
      select: {
        id: true,
        ratings: { select: { fromUserId: true } },
      },
    });

    return deals.filter((deal) => !deal.ratings.some((rating) => rating.fromUserId === userId))
      .length;
  }
}
