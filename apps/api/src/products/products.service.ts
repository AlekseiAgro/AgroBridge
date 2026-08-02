import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_COUNT,
  isProductImageMimeType,
  type ModerationStatus,
  type ProductDetail,
  type ProductImage,
  type ProductSummary,
  type RatingSummary,
} from '@agrobridge/shared';
import { ModerationStatus as PrismaModerationStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RatingsService } from '../ratings/ratings.service';
import { StorageService } from '../storage/storage.service';
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
    select: { id: true, name: true, region: true, ownerId: true },
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
  ) {}

  async catalog(query: CatalogQueryDto): Promise<ProductSummary[]> {
    const q = query.q?.trim() || undefined;
    const category = query.category?.trim() || undefined;
    const region = query.region?.trim() || undefined;

    // Search works with q alone; category/region are optional refinements.
    const where: Prisma.ProductWhereInput = {
      ...publicProductWhere,
      ...(category ? { category } : {}),
      ...(region
        ? {
            farm: {
              region: {
                equals: region,
                mode: 'insensitive',
              },
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              { farm: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
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
    return this.toDetail(product, sellerRating);
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

    const product = await this.prisma.product.create({
      data: {
        farmId: farm.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category || null,
        unit: dto.unit || null,
        minQuantity: quantity.minQuantity,
        maxQuantity: quantity.maxQuantity,
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
        isPublished: nextPublished,
        moderationStatus,
        moderationNote,
        moderatedAt,
        moderatedById,
      },
      include: productDetailInclude,
    });

    return this.toDetail(updated);
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
      isPublished: product.isPublished,
      moderationStatus: product.moderationStatus as ModerationStatus,
      moderationNote: product.moderationNote,
      images: this.toImages(product.images),
      farm: {
        id: product.farm.id,
        name: product.farm.name,
        region: product.farm.region,
        sellerRating: sellerRating ?? { average: null, count: 0 },
      },
    };
  }

  private toDetail(
    product: ProductWithOwnerAndImages,
    sellerRating?: RatingSummary | null,
  ): ProductDetail {
    return {
      ...this.toSummary(product, sellerRating),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}
