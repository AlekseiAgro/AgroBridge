import { Injectable, NotFoundException } from '@nestjs/common';
import { presentFarmText, resolveCatalogLocale, type PublicUserProfile } from '@agrobridge/shared';
import { RfqStatus as PrismaRfqStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { publicProductWhere } from '../products/public-product.where';
import { RatingsService } from '../ratings/ratings.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratings: RatingsService,
  ) {}

  async getPublicProfile(
    id: string,
    localeInput?: string | null,
    viewerLocale?: string | null,
  ): Promise<PublicUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            region: true,
            description: true,
            sourceLocale: true,
            history: true,
            ownershipType: true,
            exportMarkets: true,
            translations: {
              select: {
                locale: true,
                description: true,
                history: true,
                ownershipType: true,
                exportMarkets: true,
                status: true,
              },
            },
            _count: {
              select: {
                products: {
                  where: publicProductWhere,
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
      this.prisma.rfq.count({
        where: {
          product: { ownerUserId: user.id },
          status: PrismaRfqStatus.completed,
        },
      }),
    ]);

    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      sellerType: user.sellerType,
      buyerType: user.buyerType,
      memberSince: user.createdAt.toISOString(),
      rating,
      completedDeals: completedAsBuyer + completedAsSeller,
      farm: user.farm
        ? this.toPublicFarm(user.farm, resolveCatalogLocale(localeInput, viewerLocale))
        : null,
    };
  }

  private toPublicFarm(
    farm: {
      id: string;
      name: string;
      region: string | null;
      description: string | null;
      sourceLocale: string | null;
      history: string | null;
      ownershipType: string | null;
      exportMarkets: string[];
      translations: {
        locale: string;
        description: string | null;
        history: string | null;
        ownershipType: string | null;
        exportMarkets: string[];
        status: string;
      }[];
      _count: { products: number };
    },
    locale: Parameters<typeof presentFarmText>[1],
  ): NonNullable<PublicUserProfile['farm']> {
    const copy = presentFarmText(farm, locale);
    return {
      id: farm.id,
      name: farm.name,
      region: farm.region,
      description: farm.description,
      source: { locale: copy.source.locale, description: copy.source.description },
      display: {
        locale: copy.display.locale,
        description: copy.display.description,
        translationStatus: copy.display.translationStatus,
      },
      productCount: farm._count.products,
    };
  }
}
