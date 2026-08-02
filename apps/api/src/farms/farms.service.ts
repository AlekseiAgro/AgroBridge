import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  FarmDetail,
  FarmSummary,
  ModerationStatus,
  RatingSummary,
} from '@agrobridge/shared';
import { ModerationStatus as PrismaModerationStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RatingsService } from '../ratings/ratings.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';

const publicProductWhere = {
  isPublished: true,
  moderationStatus: PrismaModerationStatus.approved,
};

@Injectable()
export class FarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratings: RatingsService,
  ) {}

  async list(): Promise<FarmSummary[]> {
    const farms = await this.prisma.farm.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: { select: { id: true, displayName: true } },
        _count: {
          select: { products: { where: publicProductWhere } },
        },
      },
    });

    return farms.map((farm) => this.toSummary(farm));
  }

  async getById(id: string): Promise<FarmDetail> {
    const farm = await this.prisma.farm.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, displayName: true } },
        products: {
          where: publicProductWhere,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            unit: true,
            minQuantity: true,
            maxQuantity: true,
            isPublished: true,
            moderationStatus: true,
            moderationNote: true,
            farmId: true,
            images: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                url: true,
                sortOrder: true,
                isPrimary: true,
              },
            },
          },
        },
        _count: {
          select: { products: { where: publicProductWhere } },
        },
      },
    });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    const sellerRating = await this.ratings.summaryForUser(farm.owner.id);

    return {
      ...this.toSummary(farm),
      createdAt: farm.createdAt.toISOString(),
      products: farm.products.map((product) =>
        this.toProductSummary(product, farm, sellerRating),
      ),
    };
  }

  async getMine(user: AuthenticatedUser): Promise<FarmDetail | null> {
    this.assertFarmer(user);

    const farm = await this.prisma.farm.findUnique({
      where: { ownerId: user.id },
      include: {
        owner: { select: { id: true, displayName: true } },
        products: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            unit: true,
            minQuantity: true,
            maxQuantity: true,
            isPublished: true,
            moderationStatus: true,
            moderationNote: true,
            images: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                url: true,
                sortOrder: true,
                isPrimary: true,
              },
            },
          },
        },
        _count: { select: { products: true } },
      },
    });

    if (!farm) {
      return null;
    }

    const sellerRating = await this.ratings.summaryForUser(farm.owner.id);

    return {
      ...this.toSummary(farm),
      createdAt: farm.createdAt.toISOString(),
      products: farm.products.map((product) =>
        this.toProductSummary(product, farm, sellerRating),
      ),
    };
  }

  async create(user: AuthenticatedUser, dto: CreateFarmDto): Promise<FarmDetail> {
    this.assertFarmer(user);

    const existing = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    if (existing) {
      throw new ConflictException('Farm profile already exists');
    }

    const farm = await this.prisma.farm.create({
      data: {
        ownerId: user.id,
        name: dto.name.trim(),
        region: dto.region?.trim() || null,
        description: dto.description?.trim() || null,
      },
    });

    return this.getById(farm.id);
  }

  async updateMine(user: AuthenticatedUser, dto: UpdateFarmDto): Promise<FarmDetail> {
    this.assertFarmer(user);

    const farm = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    if (!farm) {
      throw new NotFoundException('Farm profile not found');
    }

    await this.prisma.farm.update({
      where: { id: farm.id },
      data: {
        name: dto.name?.trim(),
        region: dto.region === undefined ? undefined : dto.region.trim() || null,
        description:
          dto.description === undefined ? undefined : dto.description.trim() || null,
      },
    });

    return this.getById(farm.id);
  }

  private assertFarmer(user: AuthenticatedUser) {
    if (user.role !== 'farmer' && user.role !== 'admin') {
      throw new ForbiddenException('Only farmers can manage farm profiles');
    }
  }

  private toSummary(farm: {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    owner: { id: string; displayName: string | null };
    _count: { products: number };
  }): FarmSummary {
    return {
      id: farm.id,
      name: farm.name,
      region: farm.region,
      description: farm.description,
      owner: farm.owner,
      productCount: farm._count.products,
    };
  }

  private toProductSummary(
    product: {
      id: string;
      title: string;
      description: string | null;
      category: string | null;
      unit: string | null;
      minQuantity: { toNumber(): number } | number | null;
      maxQuantity: { toNumber(): number } | number | null;
      isPublished: boolean;
      moderationStatus: ModerationStatus | string;
      moderationNote: string | null;
      images: Array<{
        id: string;
        url: string;
        sortOrder: number;
        isPrimary: boolean;
      }>;
    },
    farm: {
      id: string;
      name: string;
      region: string | null;
      owner: { id: string; displayName: string | null };
    },
    sellerRating?: RatingSummary | null,
  ) {
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      category: product.category,
      unit: product.unit,
      minQuantity:
        product.minQuantity == null
          ? null
          : typeof product.minQuantity === 'number'
            ? product.minQuantity
            : product.minQuantity.toNumber(),
      maxQuantity:
        product.maxQuantity == null
          ? null
          : typeof product.maxQuantity === 'number'
            ? product.maxQuantity
            : product.maxQuantity.toNumber(),
      isPublished: product.isPublished,
      moderationStatus: product.moderationStatus as ModerationStatus,
      moderationNote: product.moderationNote,
      images: product.images,
      farm: {
        id: farm.id,
        name: farm.name,
        region: farm.region,
        sellerRating: sellerRating ?? { average: null, count: 0 },
        owner: {
          id: farm.owner.id,
          displayName: farm.owner.displayName,
        },
      },
    };
  }
}
