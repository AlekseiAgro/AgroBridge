import { BadRequestException, Injectable } from '@nestjs/common';
import type { AlertSubscription } from '@agrobridge/shared';
import {
  GEORGIA_REGIONS,
  PRODUCT_CATEGORIES,
  isGeorgiaRegion,
  isProductCategory,
} from '@agrobridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../mail/notifications.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpsertAlertSubscriptionDto } from './dto/upsert-alert-subscription.dto';

const defaultSubscription = (): Omit<AlertSubscription, 'id' | 'updatedAt'> => ({
  notifyProducts: false,
  notifyPurchaseRequests: false,
  allCategories: true,
  categories: [],
  allRegions: true,
  regions: [],
});

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getMine(user: AuthenticatedUser): Promise<AlertSubscription> {
    const existing = await this.prisma.alertSubscription.findUnique({
      where: { userId: user.id },
    });
    if (!existing) {
      return {
        id: 'default',
        ...defaultSubscription(),
        updatedAt: new Date().toISOString(),
      };
    }
    return this.toDto(existing);
  }

  async upsertMine(
    user: AuthenticatedUser,
    dto: UpsertAlertSubscriptionDto,
  ): Promise<AlertSubscription> {
    const categories = this.normalizeCategories(dto.categories);
    const regions = this.normalizeRegions(dto.regions);

    if (!dto.allCategories && categories.length === 0) {
      throw new BadRequestException('Select at least one category for a custom filter');
    }
    if (!dto.allRegions && regions.length === 0) {
      throw new BadRequestException('Select at least one region for a custom filter');
    }

    const saved = await this.prisma.alertSubscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        notifyProducts: dto.notifyProducts,
        notifyPurchaseRequests: dto.notifyPurchaseRequests,
        allCategories: dto.allCategories,
        categories: dto.allCategories ? [] : categories,
        allRegions: dto.allRegions,
        regions: dto.allRegions ? [] : regions,
      },
      update: {
        notifyProducts: dto.notifyProducts,
        notifyPurchaseRequests: dto.notifyPurchaseRequests,
        allCategories: dto.allCategories,
        categories: dto.allCategories ? [] : categories,
        allRegions: dto.allRegions,
        regions: dto.allRegions ? [] : regions,
      },
    });

    return this.toDto(saved);
  }

  async notifyNewProduct(params: {
    productId: string;
    productTitle: string;
    category: string | null;
    region: string | null;
    farmName: string;
    ownerUserId: string;
  }): Promise<void> {
    const subscriptions = await this.prisma.alertSubscription.findMany({
      where: {
        notifyProducts: true,
        user: { blockedAt: null, id: { not: params.ownerUserId } },
      },
      include: {
        user: {
          select: {
            email: true,
            locale: true,
            displayName: true,
          },
        },
      },
    });

    const matches = subscriptions.filter((sub) =>
      this.matchesFilters(sub, params.category, params.region),
    );

    await Promise.all(
      matches.map((sub) =>
        this.notifications.notifyNewProductListing({
          user: sub.user,
          productTitle: params.productTitle,
          productId: params.productId,
          farmName: params.farmName,
          category: params.category,
          region: params.region,
        }),
      ),
    );
  }

  async notifyNewPurchaseRequest(params: {
    requestId: string;
    title: string;
    category: string;
    quantity: string;
    unit: string | null;
    buyerUserId: string;
    buyerName: string;
  }): Promise<void> {
    const subscriptions = await this.prisma.alertSubscription.findMany({
      where: {
        notifyPurchaseRequests: true,
        user: { blockedAt: null, id: { not: params.buyerUserId } },
      },
      include: {
        user: {
          select: {
            email: true,
            locale: true,
            displayName: true,
          },
        },
      },
    });

    // Purchase requests have category but no Georgia farm region — match category only;
    // region custom filters still receive requests (category gate only).
    const matches = subscriptions.filter((sub) =>
      this.matchesCategory(sub, params.category),
    );

    await Promise.all(
      matches.map((sub) =>
        this.notifications.notifyNewPurchaseRequest({
          user: sub.user,
          title: params.title,
          requestId: params.requestId,
          buyerName: params.buyerName,
          category: params.category,
          quantity: params.quantity,
          unit: params.unit,
        }),
      ),
    );
  }

  private matchesFilters(
    sub: { allCategories: boolean; categories: string[]; allRegions: boolean; regions: string[] },
    category: string | null,
    region: string | null,
  ): boolean {
    if (!this.matchesCategory(sub, category)) {
      return false;
    }
    if (sub.allRegions) {
      return true;
    }
    if (!region) {
      return false;
    }
    return sub.regions.includes(region);
  }

  private matchesCategory(
    sub: { allCategories: boolean; categories: string[] },
    category: string | null,
  ): boolean {
    if (sub.allCategories) {
      return true;
    }
    if (!category) {
      return false;
    }
    return sub.categories.includes(category);
  }

  private normalizeCategories(values: string[]): string[] {
    const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    for (const value of unique) {
      if (!isProductCategory(value)) {
        throw new BadRequestException(`Unknown category: ${value}`);
      }
    }
    return unique.filter((value): value is (typeof PRODUCT_CATEGORIES)[number] =>
      isProductCategory(value),
    );
  }

  private normalizeRegions(values: string[]): string[] {
    const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    for (const value of unique) {
      if (!isGeorgiaRegion(value)) {
        throw new BadRequestException(`Unknown region: ${value}`);
      }
    }
    return unique.filter((value): value is (typeof GEORGIA_REGIONS)[number] =>
      isGeorgiaRegion(value),
    );
  }

  private toDto(row: {
    id: string;
    notifyProducts: boolean;
    notifyPurchaseRequests: boolean;
    allCategories: boolean;
    categories: string[];
    allRegions: boolean;
    regions: string[];
    updatedAt: Date;
  }): AlertSubscription {
    return {
      id: row.id,
      notifyProducts: row.notifyProducts,
      notifyPurchaseRequests: row.notifyPurchaseRequests,
      allCategories: row.allCategories,
      categories: row.categories.filter(isProductCategory),
      allRegions: row.allRegions,
      regions: row.regions.filter(isGeorgiaRegion),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
