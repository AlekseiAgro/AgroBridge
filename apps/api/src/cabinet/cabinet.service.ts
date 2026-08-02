import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CabinetOverview } from '@agrobridge/shared';
import {
  ModerationStatus as PrismaModerationStatus,
  RfqStatus as PrismaRfqStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RatingsService } from '../ratings/ratings.service';

@Injectable()
export class CabinetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratings: RatingsService,
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
    const isFarmer = user.role === 'farmer' || user.role === 'admin';
    const isBuyer = user.role === 'buyer' || user.role === 'admin';

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
      isBuyer
        ? this.prisma.rfq.count({
            where: { buyerId: user.id, status: PrismaRfqStatus.completed },
          })
        : Promise.resolve(0),
      isFarmer && dbUser.farm
        ? this.prisma.rfq.count({
            where: { farmId: dbUser.farm.id, status: PrismaRfqStatus.completed },
          })
        : Promise.resolve(0),
      isBuyer
        ? this.prisma.rfq.count({
            where: {
              buyerId: user.id,
              status: { in: [PrismaRfqStatus.pending, PrismaRfqStatus.offered, PrismaRfqStatus.accepted] },
            },
          })
        : Promise.resolve(0),
      isFarmer && dbUser.farm
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
      isFarmer && dbUser.farm
        ? this.prisma.product.count({
            where: {
              farmId: dbUser.farm.id,
              isPublished: true,
              moderationStatus: PrismaModerationStatus.approved,
            },
          })
        : Promise.resolve(0),
      isFarmer && dbUser.farm
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

  private async countAwaitingRating(userId: string, farmId: string | null) {
    const deals = await this.prisma.rfq.findMany({
      where: {
        status: PrismaRfqStatus.completed,
        OR: [
          { buyerId: userId },
          ...(farmId ? [{ farmId }] : []),
        ],
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
