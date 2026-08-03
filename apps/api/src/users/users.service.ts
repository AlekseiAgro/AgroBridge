import { Injectable, NotFoundException } from '@nestjs/common';
import type { PublicUserProfile } from '@agrobridge/shared';
import {
  ModerationStatus as PrismaModerationStatus,
  RfqStatus as PrismaRfqStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RatingsService } from '../ratings/ratings.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratings: RatingsService,
  ) {}

  async getPublicProfile(id: string): Promise<PublicUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            region: true,
            description: true,
            _count: {
              select: {
                products: {
                  where: {
                    isPublished: true,
                    moderationStatus: PrismaModerationStatus.approved,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [rating, completedAsBuyer, completedAsSeller] = await Promise.all([
      this.ratings.summaryForUser(user.id),
      this.prisma.rfq.count({
        where: { buyerId: user.id, status: PrismaRfqStatus.completed },
      }),
      user.farm
        ? this.prisma.rfq.count({
            where: { farmId: user.farm.id, status: PrismaRfqStatus.completed },
          })
        : Promise.resolve(0),
    ]);

    return {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      sellerType: user.sellerType,
      buyerType: user.buyerType,
      memberSince: user.createdAt.toISOString(),
      rating,
      completedDeals: completedAsBuyer + completedAsSeller,
      farm: user.farm
        ? {
            id: user.farm.id,
            name: user.farm.name,
            region: user.farm.region,
            description: user.farm.description,
            productCount: user.farm._count.products,
          }
        : null,
    };
  }
}
