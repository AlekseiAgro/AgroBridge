import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  USER_AVATAR_MAX_BYTES,
  canTrade,
  isUserAvatarMimeType,
  type CabinetOverview,
} from '@agrobridge/shared';
import {
  ModerationStatus as PrismaModerationStatus,
  RfqStatus as PrismaRfqStatus,
  VerificationChannel,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ChatService } from '../chat/chat.service';
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
    private readonly chat: ChatService,
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
      unreadMessages,
    ] = await Promise.all([
      trader
        ? this.prisma.rfq.count({
            where: { buyerId: user.id, status: PrismaRfqStatus.completed },
          })
        : Promise.resolve(0),
      trader
        ? this.prisma.rfq.count({
            where: {
              product: { ownerUserId: user.id },
              status: PrismaRfqStatus.completed,
            },
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
      trader
        ? this.prisma.rfq.count({
            where: {
              product: { ownerUserId: user.id },
              status: { in: [PrismaRfqStatus.pending, PrismaRfqStatus.offered, PrismaRfqStatus.accepted] },
            },
          })
        : Promise.resolve(0),
      this.prisma.conversation.count({
        where: {
          OR: [{ buyerId: user.id }, { farmerId: user.id }],
        },
      }),
      trader
        ? this.prisma.product.count({
            where: {
              ownerUserId: user.id,
              isPublished: true,
              moderationStatus: PrismaModerationStatus.approved,
            },
          })
        : Promise.resolve(0),
      trader
        ? this.prisma.product.count({
            where: {
              ownerUserId: user.id,
              moderationStatus: PrismaModerationStatus.pending,
            },
          })
        : Promise.resolve(0),
      this.countAwaitingRating(user.id),
      this.chat.unreadTotal(user).then((result) => result.count),
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
        avatarUrl: dbUser.avatarUrl,
        rating,
        memberSince: dbUser.createdAt.toISOString(),
      },
      activity: {
        completedDeals: completedAsBuyer + completedAsSeller,
        openRequests: openBuyerRequests + openInboxRequests,
        conversations,
        unreadMessages,
        publishedProducts,
        pendingModeration,
        awaitingMyRating,
      },
    };
  }

  async uploadAvatar(
    user: AuthenticatedUser,
    file?: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!isUserAvatarMimeType(file.mimetype)) {
      throw new BadRequestException('Unsupported image type. Use JPEG, PNG, or WebP');
    }
    if (file.size > USER_AVATAR_MAX_BYTES) {
      throw new BadRequestException('Image is too large (max 5 MB)');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarKey: true },
    });
    if (!existing) {
      throw new UnauthorizedException('User not found');
    }

    const stored = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      folder: `users/${user.id}`,
    });

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: stored.url,
          avatarKey: stored.key,
        },
      });
    } catch (error) {
      await this.storage.delete(stored.key).catch(() => undefined);
      throw error;
    }

    if (existing.avatarKey && existing.avatarKey !== stored.key) {
      await this.storage.delete(existing.avatarKey).catch(() => undefined);
    }

    return { avatarUrl: stored.url };
  }

  async removeAvatar(user: AuthenticatedUser): Promise<{ avatarUrl: null }> {
    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarKey: true },
    });
    if (!existing) {
      throw new UnauthorizedException('User not found');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        avatarUrl: null,
        avatarKey: null,
      },
    });

    if (existing.avatarKey) {
      await this.storage.delete(existing.avatarKey).catch(() => undefined);
    }

    return { avatarUrl: null };
  }

  async updateProfile(
    user: AuthenticatedUser,
    displayNameRaw: string,
  ): Promise<{ displayName: string | null }> {
    const displayName = displayNameRaw.trim() || null;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { displayName },
    });
    return { displayName };
  }

  async requestEmailChange(
    user: AuthenticatedUser,
    password: string,
    newEmailRaw: string,
  ): Promise<{ sent: true; destination: string; newEmail: string }> {
    const dbUser = await this.requireUserWithPassword(user.id);
    await this.assertPassword(dbUser.passwordHash, password);

    const newEmail = newEmailRaw.trim().toLowerCase();
    if (!newEmail) {
      throw new BadRequestException('Enter a new email address');
    }
    if (newEmail === dbUser.email) {
      throw new BadRequestException('New email must be different from the current address');
    }

    const taken = await this.prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException('Email is already registered');
    }

    const code = String(randomInt(100000, 999999));
    await this.prisma.verificationCode.create({
      data: {
        userId: user.id,
        channel: VerificationChannel.emailChange,
        // Store the intended new email; the code itself is mailed to the old address.
        destination: newEmail,
        codeHash: this.hashCode(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    try {
      await this.notifications.notifyEmailChangeCode({
        user: {
          email: dbUser.email,
          locale: dbUser.locale,
          displayName: dbUser.displayName,
        },
        code,
        newEmail,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message.replace(/\s+/g, ' ').trim().slice(0, 180)
          : 'unknown mail error';
      throw new ServiceUnavailableException(
        `Could not send the email change confirmation (${detail}). Check SMTP settings and try again.`,
      );
    }

    return { sent: true, destination: dbUser.email, newEmail };
  }

  async confirmEmailChange(
    user: AuthenticatedUser,
    password: string,
    code: string,
  ): Promise<{ ok: true; email: string }> {
    const dbUser = await this.requireUserWithPassword(user.id);
    await this.assertPassword(dbUser.passwordHash, password);

    const latest = await this.consumeCode(user.id, VerificationChannel.emailChange, code);
    const newEmail = latest.destination.trim().toLowerCase();

    if (!newEmail || newEmail === dbUser.email) {
      throw new BadRequestException('Invalid email change request');
    }

    const taken = await this.prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (taken && taken.id !== user.id) {
      throw new ConflictException('Email is already registered');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: newEmail,
        emailVerifiedAt: null,
      },
    });

    return { ok: true, email: newEmail };
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
    await this.consumeCode(user.id, VerificationChannel.accountDeletion, code);

    const [avatarUser, farm, ownedProducts] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { avatarKey: true },
      }),
      this.prisma.farm.findUnique({
        where: { ownerId: user.id },
        select: {
          documents: { select: { key: true } },
          images: { select: { key: true } },
        },
      }),
      this.prisma.product.findMany({
        where: { ownerUserId: user.id },
        select: {
          images: { select: { key: true } },
          videos: { select: { key: true } },
          certificates: { select: { key: true } },
        },
      }),
    ]);

    const storageKeys: string[] = [];
    if (avatarUser?.avatarKey) storageKeys.push(avatarUser.avatarKey);
    if (farm) {
      for (const document of farm.documents) storageKeys.push(document.key);
      for (const image of farm.images) storageKeys.push(image.key);
    }
    for (const product of ownedProducts) {
      for (const image of product.images) storageKeys.push(image.key);
      for (const video of product.videos) storageKeys.push(video.key);
      for (const certificate of product.certificates) storageKeys.push(certificate.key);
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

  private async consumeCode(userId: string, channel: VerificationChannel, code: string) {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new BadRequestException('Enter the 6-digit confirmation code from your email');
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
      throw new BadRequestException('Invalid or expired confirmation code');
    }

    await this.prisma.verificationCode.update({
      where: { id: latest.id },
      data: { consumedAt: new Date() },
    });

    return latest;
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private async countAwaitingRating(userId: string) {
    const deals = await this.prisma.rfq.findMany({
      where: {
        status: PrismaRfqStatus.completed,
        OR: [{ buyerId: userId }, { product: { ownerUserId: userId } }],
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
