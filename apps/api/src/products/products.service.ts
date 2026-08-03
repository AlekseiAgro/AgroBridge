import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_COUNT,
  isHarvestStatus,
  isProductImageMimeType,
  normalizeSeasonMonths,
  type HarvestStatus,
  type ModerationStatus,
  type ProductDetail,
  type ProductImage,
  type ProductSummary,
  type RatingSummary,
  type SeasonMonth,
  type VerificationStatus,
} from '@agrobridge/shared';
import {
  HarvestStatus as PrismaHarvestStatus,
  ModerationStatus as PrismaModerationStatus,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RatingsService } from '../ratings/ratings.service';
import { StorageService } from '../storage/storage.service';
import { CategoriesService } from '../categories/categories.service';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const publicProductWhere: Prisma.ProductWhereInput = {
  isPublished: true,
  moderationStatus: PrismaModerationStatus.approved,
};

const imageOrderBy: Prisma.ProductImageOrderByWithRelationInput[] = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

const productListInclude = {
  farm: {
    select: {
      id: true,
      name: true,
      region: true,
      ownerId: true,
      verificationStatus: true,
    },
  },
  images: {
    orderBy: imageOrderBy,
  },
} satisfies Prisma.ProductInclude;

const productDetailInclude = {
  farm: {
    select: {
      id: true,
      name: true,
      region: true,
      ownerId: true,
      verificationStatus: true,
    },
  },
  images: {
    orderBy: imageOrderBy,
  },
} satisfies Prisma.ProductInclude;

type ProductWithFarmAndImages = Prisma.ProductGetPayload<{
  include: typeof productListInclude;
}>;

type ProductWithOwnerAndImages = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ratings: RatingsService,
    private readonly categories: CategoriesService,
    private readonly notifications: NotificationsService,
  ) {}

  async catalog(query: CatalogQueryDto): Promise<ProductSummary[]> {
    const q = query.q?.trim() || undefined;
    const category = query.category?.trim() || undefined;
    const region = query.region?.trim() || undefined;
    const harvestStatus =
      query.harvestStatus && isHarvestStatus(query.harvestStatus)
        ? query.harvestStatus
        : undefined;
    const preorder = query.preorder === true;
    const inSeason = query.inSeason === true;
    const enabledCategories = await this.categories.enabledIds();

    const and: Prisma.ProductWhereInput[] = [];

    if (category) {
      if (enabledCategories && !enabledCategories.includes(category)) {
        and.push({ id: '__none__' });
      } else {
        and.push({ category });
      }
    } else if (enabledCategories) {
      and.push({
        OR: [{ category: { in: enabledCategories } }, { category: null }],
      });
    }

    if (region) {
      and.push({
        farm: {
          region: {
            equals: region,
            mode: 'insensitive',
          },
        },
      });
    }

    if (q) {
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { farm: { name: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    if (harvestStatus) {
      and.push({ harvestStatus: harvestStatus as PrismaHarvestStatus });
    }

    if (preorder) {
      and.push({ preorderEnabled: true });
    }

    if (inSeason) {
      and.push({ seasonMonths: { has: new Date().getUTCMonth() + 1 } });
    }

    const where: Prisma.ProductWhereInput = {
      ...publicProductWhere,
      ...(and.length > 0 ? { AND: and } : {}),
    };

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: productListInclude,
    });

    const ratings = await this.ratings.summariesForUsers(
      products.map((product) => product.farm.ownerId),
    );

    return products.map((product) =>
      this.toSummary(product, ratings.get(product.farm.ownerId)),
    );
  }

  async getById(id: string, viewer?: AuthenticatedUser | null): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const isOwner =
      viewer &&
      (viewer.role === 'admin' || product.farm.ownerId === viewer.id);

    const isPublic =
      product.isPublished && product.moderationStatus === PrismaModerationStatus.approved;

    if (!isPublic && !isOwner) {
      throw new NotFoundException('Product not found');
    }

    const sellerRating = await this.ratings.summaryForUser(product.farm.ownerId);
    const watching = viewer
      ? Boolean(
          await this.prisma.harvestWatch.findUnique({
            where: {
              userId_productId: { userId: viewer.id, productId: product.id },
            },
            select: { id: true },
          }),
        )
      : false;
    return this.toDetail(product, sellerRating, watching);
  }

  async listMine(user: AuthenticatedUser): Promise<ProductSummary[]> {
    this.assertFarmer(user);

    const farm = await this.requireFarm(user.id);
    const products = await this.prisma.product.findMany({
      where: { farmId: farm.id },
      orderBy: { updatedAt: 'desc' },
      include: productListInclude,
    });
    const sellerRating = await this.ratings.summaryForUser(user.id);

    return products.map((product) => this.toSummary(product, sellerRating));
  }

  async create(user: AuthenticatedUser, dto: CreateProductDto): Promise<ProductDetail> {
    this.assertFarmer(user);
    const farm = await this.requireFarm(user.id);
    const isPublished = dto.isPublished ?? false;
    const quantity = this.normalizeQuantityRange(dto.minQuantity, dto.maxQuantity);

    const harvest = this.normalizeHarvestInput(dto);

    const product = await this.prisma.product.create({
      data: {
        farmId: farm.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category || null,
        unit: dto.unit || null,
        minQuantity: quantity.minQuantity,
        maxQuantity: quantity.maxQuantity,
        seasonMonths: harvest.seasonMonths,
        harvestStartAt: harvest.harvestStartAt,
        harvestEndAt: harvest.harvestEndAt,
        forecastQuantity: harvest.forecastQuantity,
        harvestStatus: harvest.harvestStatus,
        preorderEnabled: harvest.preorderEnabled,
        isPublished,
        moderationStatus: isPublished
          ? PrismaModerationStatus.pending
          : PrismaModerationStatus.draft,
        moderationNote: null,
      },
      include: productDetailInclude,
    });

    return this.toDetail(product);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, id);

    const nextPublished = dto.isPublished ?? product.isPublished;
    const nextMin =
      dto.minQuantity === undefined
        ? this.toNumberOrNull(product.minQuantity)
        : dto.minQuantity;
    const nextMax =
      dto.maxQuantity === undefined
        ? this.toNumberOrNull(product.maxQuantity)
        : dto.maxQuantity;
    const quantity = this.normalizeQuantityRange(nextMin, nextMax);
    const harvest = this.normalizeHarvestInput(dto, {
      seasonMonths: product.seasonMonths,
      harvestStartAt: product.harvestStartAt,
      harvestEndAt: product.harvestEndAt,
      forecastQuantity: this.toNumberOrNull(product.forecastQuantity),
      harvestStatus: product.harvestStatus,
      preorderEnabled: product.preorderEnabled,
    });

    const contentChanged =
      (dto.title !== undefined && dto.title.trim() !== product.title) ||
      (dto.description !== undefined &&
        (dto.description.trim() || null) !== product.description) ||
      (dto.category !== undefined && (dto.category || null) !== product.category) ||
      (dto.unit !== undefined && (dto.unit || null) !== product.unit) ||
      (dto.minQuantity !== undefined &&
        quantity.minQuantity !== this.toNumberOrNull(product.minQuantity)) ||
      (dto.maxQuantity !== undefined &&
        quantity.maxQuantity !== this.toNumberOrNull(product.maxQuantity));

    let moderationStatus = product.moderationStatus;
    let moderationNote = product.moderationNote;
    let moderatedAt = product.moderatedAt;
    let moderatedById = product.moderatedById;

    if (!nextPublished) {
      moderationStatus = PrismaModerationStatus.draft;
      moderationNote = null;
      moderatedAt = null;
      moderatedById = null;
    } else if (
      !product.isPublished ||
      contentChanged ||
      product.moderationStatus === PrismaModerationStatus.rejected ||
      product.moderationStatus === PrismaModerationStatus.draft
    ) {
      moderationStatus = PrismaModerationStatus.pending;
      moderationNote = null;
      moderatedAt = null;
      moderatedById = null;
    }

    const previousStatus = product.harvestStatus;
    const previousPreorder = product.preorderEnabled;

    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        title: dto.title?.trim(),
        description:
          dto.description === undefined ? undefined : dto.description.trim() || null,
        category: dto.category === undefined ? undefined : dto.category || null,
        unit: dto.unit === undefined ? undefined : dto.unit || null,
        minQuantity:
          dto.minQuantity === undefined && dto.maxQuantity === undefined
            ? undefined
            : quantity.minQuantity,
        maxQuantity:
          dto.minQuantity === undefined && dto.maxQuantity === undefined
            ? undefined
            : quantity.maxQuantity,
        seasonMonths:
          dto.seasonMonths === undefined ? undefined : harvest.seasonMonths,
        harvestStartAt:
          dto.harvestStartAt === undefined ? undefined : harvest.harvestStartAt,
        harvestEndAt:
          dto.harvestEndAt === undefined ? undefined : harvest.harvestEndAt,
        forecastQuantity:
          dto.forecastQuantity === undefined ? undefined : harvest.forecastQuantity,
        harvestStatus:
          dto.harvestStatus === undefined ? undefined : harvest.harvestStatus,
        preorderEnabled:
          dto.preorderEnabled === undefined ? undefined : harvest.preorderEnabled,
        isPublished: nextPublished,
        moderationStatus,
        moderationNote,
        moderatedAt,
        moderatedById,
      },
      include: productDetailInclude,
    });

    await this.notifyHarvestWatchersIfNeeded({
      product: updated,
      previousStatus,
      previousPreorder,
      nextStatus: updated.harvestStatus,
      nextPreorder: updated.preorderEnabled,
      isPublic:
        updated.isPublished &&
        updated.moderationStatus === PrismaModerationStatus.approved,
    });

    return this.toDetail(updated);
  }

  async getWatchStatus(
    user: AuthenticatedUser,
    productId: string,
  ): Promise<{ watching: boolean; productId: string }> {
    await this.requirePublicOrOwnedProduct(productId, user);
    const watch = await this.prisma.harvestWatch.findUnique({
      where: { userId_productId: { userId: user.id, productId } },
      select: { id: true },
    });
    return { watching: Boolean(watch), productId };
  }

  async watchProduct(
    user: AuthenticatedUser,
    productId: string,
  ): Promise<{ watching: true; productId: string }> {
    if (user.role === 'farmer') {
      const owned = await this.prisma.product.findFirst({
        where: { id: productId, farm: { ownerId: user.id } },
        select: { id: true },
      });
      if (owned) {
        throw new BadRequestException('You cannot watch your own product');
      }
    }

    await this.requirePublicProduct(productId);
    await this.prisma.harvestWatch.upsert({
      where: { userId_productId: { userId: user.id, productId } },
      create: { userId: user.id, productId },
      update: {},
    });
    return { watching: true, productId };
  }

  async unwatchProduct(
    user: AuthenticatedUser,
    productId: string,
  ): Promise<{ watching: false; productId: string }> {
    await this.prisma.harvestWatch.deleteMany({
      where: { userId: user.id, productId },
    });
    return { watching: false, productId };
  }

  async remove(user: AuthenticatedUser, id: string): Promise<{ ok: true }> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, id);
    const images = await this.prisma.productImage.findMany({
      where: { productId: product.id },
      select: { key: true },
    });

    await this.prisma.product.delete({ where: { id: product.id } });

    await Promise.all(
      images.map(async (image) => {
        try {
          await this.storage.delete(image.key);
        } catch {
          // Best-effort cleanup; DB row is already gone.
        }
      }),
    );

    return { ok: true };
  }

  async addImage(
    user: AuthenticatedUser,
    productId: string,
    file?: Express.Multer.File,
  ): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, productId);

    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    if (!isProductImageMimeType(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      throw new BadRequestException('Image must be 5MB or smaller');
    }

    const existingCount = await this.prisma.productImage.count({
      where: { productId: product.id },
    });

    if (existingCount >= PRODUCT_IMAGE_MAX_COUNT) {
      throw new BadRequestException(
        `A product can have at most ${PRODUCT_IMAGE_MAX_COUNT} images`,
      );
    }

    const stored = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname || 'image',
      folder: `products/${product.id}`,
    });

    const isPrimary = existingCount === 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productImage.create({
          data: {
            productId: product.id,
            url: stored.url,
            key: stored.key,
            sortOrder: existingCount,
            isPrimary,
          },
        });

        await this.markPendingForImageChange(tx, product);
      });
    } catch (error) {
      await this.storage.delete(stored.key).catch(() => undefined);
      throw error;
    }

    return this.getById(product.id, user);
  }

  async removeImage(
    user: AuthenticatedUser,
    productId: string,
    imageId: string,
  ): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, productId);

    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId: product.id },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: image.id } });

      if (image.isPrimary) {
        const next = await tx.productImage.findFirst({
          where: { productId: product.id },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
        if (next) {
          await tx.productImage.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }

      await this.markPendingForImageChange(tx, product);
    });

    try {
      await this.storage.delete(image.key);
    } catch {
      // Best-effort cleanup.
    }

    return this.getById(product.id, user);
  }

  async setPrimaryImage(
    user: AuthenticatedUser,
    productId: string,
    imageId: string,
  ): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, productId);

    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId: product.id },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: { productId: product.id, isPrimary: true },
        data: { isPrimary: false },
      });
      await tx.productImage.update({
        where: { id: image.id },
        data: { isPrimary: true },
      });
      await this.markPendingForImageChange(tx, product);
    });

    return this.getById(product.id, user);
  }

  private async markPendingForImageChange(
    tx: Prisma.TransactionClient,
    product: { id: string; isPublished: boolean; moderationStatus: PrismaModerationStatus },
  ) {
    if (!product.isPublished) {
      return;
    }

    if (
      product.moderationStatus === PrismaModerationStatus.approved ||
      product.moderationStatus === PrismaModerationStatus.rejected
    ) {
      await tx.product.update({
        where: { id: product.id },
        data: {
          moderationStatus: PrismaModerationStatus.pending,
          moderationNote: null,
          moderatedAt: null,
          moderatedById: null,
        },
      });
    }
  }

  private async requireFarm(ownerId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { ownerId } });
    if (!farm) {
      throw new NotFoundException('Create a farm profile before adding products');
    }
    return farm;
  }

  private async requireOwnedProduct(ownerId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { farm: true },
    });

    if (!product || product.farm.ownerId !== ownerId) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private assertFarmer(user: AuthenticatedUser) {
    if (user.role !== 'farmer' && user.role !== 'admin') {
      throw new ForbiddenException('Only farmers can manage products');
    }
  }

  private toNumberOrNull(value: Prisma.Decimal | number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    return typeof value === 'number' ? value : Number(value);
  }

  private normalizeQuantityRange(
    minQuantity?: number | null,
    maxQuantity?: number | null,
  ): { minQuantity: number | null; maxQuantity: number | null } {
    const min =
      minQuantity === undefined || minQuantity === null || Number.isNaN(minQuantity)
        ? null
        : minQuantity;
    const max =
      maxQuantity === undefined || maxQuantity === null || Number.isNaN(maxQuantity)
        ? null
        : maxQuantity;

    if (min !== null && min <= 0) {
      throw new BadRequestException('minQuantity must be greater than 0');
    }
    if (max !== null && max <= 0) {
      throw new BadRequestException('maxQuantity must be greater than 0');
    }
    if (min !== null && max !== null && min > max) {
      throw new BadRequestException('minQuantity cannot be greater than maxQuantity');
    }

    return { minQuantity: min, maxQuantity: max };
  }

  private toImages(
    images: Array<{
      id: string;
      url: string;
      sortOrder: number;
      isPrimary: boolean;
    }>,
  ): ProductImage[] {
    return images.map((image) => ({
      id: image.id,
      url: image.url,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
    }));
  }

  private toSummary(
    product: ProductWithFarmAndImages | ProductWithOwnerAndImages,
    sellerRating?: RatingSummary | null,
  ): ProductSummary {
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      category: product.category,
      unit: product.unit,
      minQuantity: this.toNumberOrNull(product.minQuantity),
      maxQuantity: this.toNumberOrNull(product.maxQuantity),
      seasonMonths: normalizeSeasonMonths(product.seasonMonths),
      harvestStartAt: product.harvestStartAt?.toISOString() ?? null,
      harvestEndAt: product.harvestEndAt?.toISOString() ?? null,
      forecastQuantity: this.toNumberOrNull(product.forecastQuantity),
      harvestStatus: (product.harvestStatus as HarvestStatus | null) ?? null,
      preorderEnabled: product.preorderEnabled,
      isPublished: product.isPublished,
      moderationStatus: product.moderationStatus as ModerationStatus,
      moderationNote: product.moderationNote,
      images: this.toImages(product.images),
      farm: {
        id: product.farm.id,
        name: product.farm.name,
        region: product.farm.region,
        verificationStatus: product.farm.verificationStatus as VerificationStatus,
        verified: product.farm.verificationStatus === 'approved',
        sellerRating: sellerRating ?? { average: null, count: 0 },
      },
    };
  }

  private toDetail(
    product: ProductWithOwnerAndImages,
    sellerRating?: RatingSummary | null,
    watching = false,
  ): ProductDetail {
    return {
      ...this.toSummary(product, sellerRating),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      watching,
    };
  }

  private normalizeHarvestInput(
    dto: {
      seasonMonths?: number[];
      harvestStartAt?: string | null;
      harvestEndAt?: string | null;
      forecastQuantity?: number | null;
      harvestStatus?: string | null;
      preorderEnabled?: boolean;
    },
    fallback?: {
      seasonMonths: number[];
      harvestStartAt: Date | null;
      harvestEndAt: Date | null;
      forecastQuantity: number | null;
      harvestStatus: PrismaHarvestStatus | null;
      preorderEnabled: boolean;
    },
  ): {
    seasonMonths: SeasonMonth[];
    harvestStartAt: Date | null;
    harvestEndAt: Date | null;
    forecastQuantity: number | null;
    harvestStatus: PrismaHarvestStatus | null;
    preorderEnabled: boolean;
  } {
    const seasonMonths =
      dto.seasonMonths === undefined
        ? normalizeSeasonMonths(fallback?.seasonMonths ?? [])
        : normalizeSeasonMonths(dto.seasonMonths);

    const harvestStartAt =
      dto.harvestStartAt === undefined
        ? (fallback?.harvestStartAt ?? null)
        : dto.harvestStartAt
          ? new Date(dto.harvestStartAt)
          : null;
    const harvestEndAt =
      dto.harvestEndAt === undefined
        ? (fallback?.harvestEndAt ?? null)
        : dto.harvestEndAt
          ? new Date(dto.harvestEndAt)
          : null;

    if (
      harvestStartAt &&
      harvestEndAt &&
      harvestStartAt.getTime() > harvestEndAt.getTime()
    ) {
      throw new BadRequestException('harvestStartAt cannot be after harvestEndAt');
    }

    const forecastQuantity =
      dto.forecastQuantity === undefined
        ? (fallback?.forecastQuantity ?? null)
        : dto.forecastQuantity;

    if (forecastQuantity !== null && forecastQuantity !== undefined && forecastQuantity <= 0) {
      throw new BadRequestException('forecastQuantity must be greater than 0');
    }

    let harvestStatus: PrismaHarvestStatus | null =
      fallback?.harvestStatus ?? null;
    if (dto.harvestStatus !== undefined) {
      if (dto.harvestStatus === null || dto.harvestStatus === '') {
        harvestStatus = null;
      } else if (isHarvestStatus(dto.harvestStatus)) {
        harvestStatus = dto.harvestStatus as PrismaHarvestStatus;
      } else {
        throw new BadRequestException('harvestStatus is invalid');
      }
    }

    const preorderEnabled =
      dto.preorderEnabled === undefined
        ? (fallback?.preorderEnabled ?? false)
        : dto.preorderEnabled;

    return {
      seasonMonths,
      harvestStartAt,
      harvestEndAt,
      forecastQuantity: forecastQuantity ?? null,
      harvestStatus,
      preorderEnabled,
    };
  }

  private async requirePublicProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        isPublished: true,
        moderationStatus: true,
      },
    });
    if (
      !product ||
      !product.isPublished ||
      product.moderationStatus !== PrismaModerationStatus.approved
    ) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private async requirePublicOrOwnedProduct(
    productId: string,
    user: AuthenticatedUser,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        isPublished: true,
        moderationStatus: true,
        farm: { select: { ownerId: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const isOwner = user.role === 'admin' || product.farm.ownerId === user.id;
    const isPublic =
      product.isPublished &&
      product.moderationStatus === PrismaModerationStatus.approved;
    if (!isPublic && !isOwner) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private async notifyHarvestWatchersIfNeeded(params: {
    product: ProductWithOwnerAndImages;
    previousStatus: PrismaHarvestStatus | null;
    previousPreorder: boolean;
    nextStatus: PrismaHarvestStatus | null;
    nextPreorder: boolean;
    isPublic: boolean;
  }) {
    if (!params.isPublic) return;

    const becameAvailable =
      params.nextStatus !== params.previousStatus &&
      (params.nextStatus === PrismaHarvestStatus.available ||
        params.nextStatus === PrismaHarvestStatus.limited);

    const preorderOpened =
      !params.previousPreorder && params.nextPreorder === true;

    if (!becameAvailable && !preorderOpened) return;

    const watches = await this.prisma.harvestWatch.findMany({
      where: { productId: params.product.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            locale: true,
            displayName: true,
            blockedAt: true,
          },
        },
      },
    });

    await Promise.all(
      watches
        .filter((watch) => !watch.user.blockedAt)
        .filter((watch) => watch.user.id !== params.product.farm.ownerId)
        .map(async (watch) => {
          if (becameAvailable) {
            await this.notifications.notifyHarvestAvailable({
              user: watch.user,
              productId: params.product.id,
              productTitle: params.product.title,
              farmName: params.product.farm.name,
              harvestStatus: params.nextStatus ?? 'available',
            });
          }
          if (preorderOpened) {
            await this.notifications.notifyHarvestPreorderOpen({
              user: watch.user,
              productId: params.product.id,
              productTitle: params.product.title,
              farmName: params.product.farm.name,
            });
          }
        }),
    );
  }
}
