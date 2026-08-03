import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FARM_DOCUMENT_MAX_BYTES,
  FARM_DOCUMENT_MAX_COUNT,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_COUNT,
  PRODUCT_VIDEO_MAX_BYTES,
  PRODUCT_VIDEO_MAX_COUNT,
  PRODUCT_VIDEO_MIME_TYPES,
  canTrade,
  catalogSearchCanonicalMatches,
  isCarrier,
  isCertificateType,
  isFarmDocumentMimeType,
  isHarvestStatus,
  isIncoterm,
  isPackagingType,
  isPriceCurrency,
  isProductImageKind,
  isProductImageMimeType,
  normalizeSeasonMonths,
  type ProductDetail,
  type ProductSummary,
  type RatingSummary,
  type SeasonMonth,
} from '@agrobridge/shared';
import {
  CertificateType as PrismaCertificateType,
  HarvestStatus as PrismaHarvestStatus,
  ModerationStatus as PrismaModerationStatus,
  Prisma,
  ProductImageKind as PrismaProductImageKind,
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
import {
  asAttributes,
  mapProductDetail,
  mapProductSummary,
  sanitizeStringArray,
  toNumberOrNull,
} from './product-mapper';

const publicProductWhere: Prisma.ProductWhereInput = {
  isPublished: true,
  moderationStatus: PrismaModerationStatus.approved,
};

const imageOrderBy: Prisma.ProductImageOrderByWithRelationInput[] = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

const productOwnerSelect = {
  id: true,
  displayName: true,
} as const;

const productFarmSelect = {
  id: true,
  name: true,
  region: true,
  ownerId: true,
  verificationStatus: true,
  foundedYear: true,
  farmSizeHectares: true,
  ownershipType: true,
  exportMarkets: true,
  history: true,
} as const;

const productListInclude = {
  owner: {
    select: productOwnerSelect,
  },
  farm: {
    select: productFarmSelect,
  },
  images: {
    orderBy: imageOrderBy,
  },
  videos: {
    orderBy: { createdAt: 'desc' },
  },
  certificates: {
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.ProductInclude;

const productDetailInclude = {
  owner: {
    select: productOwnerSelect,
  },
  farm: {
    select: productFarmSelect,
  },
  images: {
    orderBy: imageOrderBy,
  },
  videos: {
    orderBy: { createdAt: 'desc' },
  },
  certificates: {
    orderBy: { createdAt: 'desc' },
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
      query.harvestStatus && isHarvestStatus(query.harvestStatus) ? query.harvestStatus : undefined;
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
      const localized = catalogSearchCanonicalMatches(q);
      const searchOr: Prisma.ProductWhereInput[] = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { variety: { contains: q, mode: 'insensitive' } },
        { farm: { name: { contains: q, mode: 'insensitive' } } },
        { owner: { displayName: { contains: q, mode: 'insensitive' } } },
      ];
      if (localized.titles.length > 0) {
        searchOr.push({ title: { in: localized.titles } });
      }
      if (localized.descriptions.length > 0) {
        searchOr.push({ description: { in: localized.descriptions } });
      }
      and.push({ OR: searchOr });
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
      products.map((product) => product.ownerUserId),
    );

    return products.map((product) => this.toSummary(product, ratings.get(product.ownerUserId)));
  }

  async getById(id: string, viewer?: AuthenticatedUser | null): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const isOwner = viewer && (viewer.role === 'admin' || product.ownerUserId === viewer.id);

    const isPublic =
      product.isPublished && product.moderationStatus === PrismaModerationStatus.approved;

    if (!isPublic && !isOwner) {
      throw new NotFoundException('Product not found');
    }

    const sellerRating = await this.ratings.summaryForUser(product.ownerUserId);
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
    const isCardOwner = Boolean(viewer && product.ownerUserId === viewer.id);
    return this.toDetail(product, sellerRating, watching, isCardOwner);
  }

  async listMine(user: AuthenticatedUser): Promise<ProductSummary[]> {
    this.assertFarmer(user);

    const products = await this.prisma.product.findMany({
      where: { ownerUserId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: productListInclude,
    });
    const sellerRating = await this.ratings.summaryForUser(user.id);

    return products.map((product) => this.toSummary(product, sellerRating));
  }

  async create(user: AuthenticatedUser, dto: CreateProductDto): Promise<ProductDetail> {
    this.assertFarmer(user);
    const farm = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    const input = dto as any;
    const isPublished = dto.isPublished ?? false;
    const quantity = this.normalizeQuantityRange(dto.minQuantity, dto.maxQuantity);
    const harvest = this.normalizeHarvestInput(dto);
    const packagingTypes = sanitizeStringArray(input.packagingTypes).filter(isPackagingType);
    const packagingWeights = sanitizeStringArray(input.packagingWeights);
    const incoterms = sanitizeStringArray(input.incoterms).filter(isIncoterm);
    const carriers = sanitizeStringArray(input.carriers).filter(isCarrier);

    const product = await this.prisma.product.create({
      data: {
        ownerUserId: user.id,
        farmId: farm?.id ?? null,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category || null,
        variety: this.normalizeOptionalString(input.variety),
        country: this.normalizeOptionalString(input.country) ?? 'Georgia',
        originPlace: this.normalizeOptionalString(input.originPlace),
        unit: dto.unit || null,
        minQuantity: quantity.minQuantity,
        maxQuantity: quantity.maxQuantity,
        currentStock: this.normalizeNullableNumber(input.currentStock),
        monthlyProduction: this.normalizeNullableNumber(input.monthlyProduction),
        maxAnnualProduction: this.normalizeNullableNumber(input.maxAnnualProduction),
        seasonMonths: harvest.seasonMonths,
        harvestStartAt: harvest.harvestStartAt,
        harvestEndAt: harvest.harvestEndAt,
        forecastQuantity: harvest.forecastQuantity,
        harvestStatus: harvest.harvestStatus,
        preorderEnabled: harvest.preorderEnabled,
        attributes: this.normalizeAttributes(input.attributes),
        packagingTypes,
        packagingWeights,
        palletSize: this.normalizeOptionalString(input.palletSize),
        incoterms,
        carriers,
        customDelivery: this.normalizeOptionalString(input.customDelivery),
        nearestPort: this.normalizeOptionalString(input.nearestPort),
        deliveryAvailable: input.deliveryAvailable ?? false,
        leadTimeDays: this.normalizeNullableNumber(input.leadTimeDays),
        priceFrom: this.normalizeNullableNumber(input.priceFrom),
        priceCurrency:
          typeof input.priceCurrency === 'string' && isPriceCurrency(input.priceCurrency)
            ? input.priceCurrency
            : null,
        priceNegotiable: input.priceNegotiable ?? false,
        priceDependsOnVolume: input.priceDependsOnVolume ?? false,
        isPublished,
        moderationStatus: isPublished
          ? PrismaModerationStatus.pending
          : PrismaModerationStatus.draft,
        moderationNote: null,
      },
      include: productDetailInclude,
    });

    return this.toDetail(product, null, false, true);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateProductDto): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, id);
    const input = dto as any;

    const nextPublished = dto.isPublished ?? product.isPublished;
    const nextMin =
      dto.minQuantity === undefined ? toNumberOrNull(product.minQuantity) : dto.minQuantity;
    const nextMax =
      dto.maxQuantity === undefined ? toNumberOrNull(product.maxQuantity) : dto.maxQuantity;
    const quantity = this.normalizeQuantityRange(nextMin, nextMax);
    const harvest = this.normalizeHarvestInput(dto, {
      seasonMonths: product.seasonMonths,
      harvestStartAt: product.harvestStartAt,
      harvestEndAt: product.harvestEndAt,
      forecastQuantity: toNumberOrNull(product.forecastQuantity),
      harvestStatus: product.harvestStatus,
      preorderEnabled: product.preorderEnabled,
    });
    const variety =
      input.variety === undefined ? undefined : this.normalizeOptionalString(input.variety);
    const country =
      input.country === undefined ? undefined : this.normalizeOptionalString(input.country);
    const originPlace =
      input.originPlace === undefined ? undefined : this.normalizeOptionalString(input.originPlace);
    const currentStock =
      input.currentStock === undefined
        ? undefined
        : this.normalizeNullableNumber(input.currentStock);
    const monthlyProduction =
      input.monthlyProduction === undefined
        ? undefined
        : this.normalizeNullableNumber(input.monthlyProduction);
    const maxAnnualProduction =
      input.maxAnnualProduction === undefined
        ? undefined
        : this.normalizeNullableNumber(input.maxAnnualProduction);
    const attributes =
      input.attributes === undefined ? undefined : this.normalizeAttributes(input.attributes);
    const packagingTypes =
      input.packagingTypes === undefined
        ? undefined
        : sanitizeStringArray(input.packagingTypes).filter(isPackagingType);
    const packagingWeights =
      input.packagingWeights === undefined
        ? undefined
        : sanitizeStringArray(input.packagingWeights);
    const palletSize =
      input.palletSize === undefined ? undefined : this.normalizeOptionalString(input.palletSize);
    const incoterms =
      input.incoterms === undefined
        ? undefined
        : sanitizeStringArray(input.incoterms).filter(isIncoterm);
    const carriers =
      input.carriers === undefined
        ? undefined
        : sanitizeStringArray(input.carriers).filter(isCarrier);
    const customDelivery =
      input.customDelivery === undefined
        ? undefined
        : this.normalizeOptionalString(input.customDelivery);
    const nearestPort =
      input.nearestPort === undefined ? undefined : this.normalizeOptionalString(input.nearestPort);
    const deliveryAvailable =
      input.deliveryAvailable === undefined ? undefined : input.deliveryAvailable;
    const leadTimeDays =
      input.leadTimeDays === undefined
        ? undefined
        : this.normalizeNullableNumber(input.leadTimeDays);
    const priceFrom =
      input.priceFrom === undefined ? undefined : this.normalizeNullableNumber(input.priceFrom);
    const priceCurrency =
      input.priceCurrency === undefined
        ? undefined
        : typeof input.priceCurrency === 'string' && isPriceCurrency(input.priceCurrency)
          ? input.priceCurrency
          : null;
    const priceNegotiable = input.priceNegotiable === undefined ? undefined : input.priceNegotiable;
    const priceDependsOnVolume =
      input.priceDependsOnVolume === undefined ? undefined : input.priceDependsOnVolume;

    const contentChanged =
      (dto.title !== undefined && dto.title.trim() !== product.title) ||
      (dto.description !== undefined && (dto.description.trim() || null) !== product.description) ||
      (dto.category !== undefined && (dto.category || null) !== product.category) ||
      (dto.unit !== undefined && (dto.unit || null) !== product.unit) ||
      (dto.minQuantity !== undefined &&
        quantity.minQuantity !== toNumberOrNull(product.minQuantity)) ||
      (dto.maxQuantity !== undefined &&
        quantity.maxQuantity !== toNumberOrNull(product.maxQuantity)) ||
      (variety !== undefined && variety !== product.variety) ||
      (country !== undefined && country !== product.country) ||
      (originPlace !== undefined && originPlace !== product.originPlace) ||
      (currentStock !== undefined && currentStock !== toNumberOrNull(product.currentStock)) ||
      (monthlyProduction !== undefined &&
        monthlyProduction !== toNumberOrNull(product.monthlyProduction)) ||
      (maxAnnualProduction !== undefined &&
        maxAnnualProduction !== toNumberOrNull(product.maxAnnualProduction)) ||
      (dto.seasonMonths !== undefined &&
        !this.valuesEqual(harvest.seasonMonths, product.seasonMonths)) ||
      (dto.harvestStartAt !== undefined &&
        harvest.harvestStartAt?.getTime() !== product.harvestStartAt?.getTime()) ||
      (dto.harvestEndAt !== undefined &&
        harvest.harvestEndAt?.getTime() !== product.harvestEndAt?.getTime()) ||
      (dto.forecastQuantity !== undefined &&
        harvest.forecastQuantity !== toNumberOrNull(product.forecastQuantity)) ||
      (attributes !== undefined &&
        !this.valuesEqual(attributes, asAttributes(product.attributes))) ||
      (packagingTypes !== undefined && !this.valuesEqual(packagingTypes, product.packagingTypes)) ||
      (packagingWeights !== undefined &&
        !this.valuesEqual(packagingWeights, product.packagingWeights)) ||
      (palletSize !== undefined && palletSize !== product.palletSize) ||
      (incoterms !== undefined && !this.valuesEqual(incoterms, product.incoterms)) ||
      (carriers !== undefined && !this.valuesEqual(carriers, product.carriers)) ||
      (customDelivery !== undefined && customDelivery !== product.customDelivery) ||
      (nearestPort !== undefined && nearestPort !== product.nearestPort) ||
      (deliveryAvailable !== undefined && deliveryAvailable !== product.deliveryAvailable) ||
      (leadTimeDays !== undefined && leadTimeDays !== product.leadTimeDays) ||
      (priceFrom !== undefined && priceFrom !== toNumberOrNull(product.priceFrom)) ||
      (priceCurrency !== undefined && priceCurrency !== product.priceCurrency) ||
      (priceNegotiable !== undefined && priceNegotiable !== product.priceNegotiable) ||
      (priceDependsOnVolume !== undefined && priceDependsOnVolume !== product.priceDependsOnVolume);

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
        description: dto.description === undefined ? undefined : dto.description.trim() || null,
        category: dto.category === undefined ? undefined : dto.category || null,
        variety,
        country,
        originPlace,
        unit: dto.unit === undefined ? undefined : dto.unit || null,
        minQuantity:
          dto.minQuantity === undefined && dto.maxQuantity === undefined
            ? undefined
            : quantity.minQuantity,
        maxQuantity:
          dto.minQuantity === undefined && dto.maxQuantity === undefined
            ? undefined
            : quantity.maxQuantity,
        currentStock,
        monthlyProduction,
        maxAnnualProduction,
        seasonMonths: dto.seasonMonths === undefined ? undefined : harvest.seasonMonths,
        harvestStartAt: dto.harvestStartAt === undefined ? undefined : harvest.harvestStartAt,
        harvestEndAt: dto.harvestEndAt === undefined ? undefined : harvest.harvestEndAt,
        forecastQuantity: dto.forecastQuantity === undefined ? undefined : harvest.forecastQuantity,
        harvestStatus: dto.harvestStatus === undefined ? undefined : harvest.harvestStatus,
        preorderEnabled: dto.preorderEnabled === undefined ? undefined : harvest.preorderEnabled,
        attributes,
        packagingTypes,
        packagingWeights,
        palletSize,
        incoterms,
        carriers,
        customDelivery,
        nearestPort,
        deliveryAvailable,
        leadTimeDays,
        priceFrom,
        priceCurrency,
        priceNegotiable,
        priceDependsOnVolume,
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
      isPublic: updated.isPublished && updated.moderationStatus === PrismaModerationStatus.approved,
    });

    return this.toDetail(updated, null, false, true);
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
    if (canTrade(user.role)) {
      const owned = await this.prisma.product.findFirst({
        where: { id: productId, ownerUserId: user.id },
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
    const [images, videos, certificates] = await Promise.all([
      this.prisma.productImage.findMany({
        where: { productId: product.id },
        select: { key: true },
      }),
      this.prisma.productVideo.findMany({
        where: { productId: product.id },
        select: { key: true },
      }),
      this.prisma.productCertificate.findMany({
        where: { productId: product.id },
        select: { key: true },
      }),
    ]);

    await this.prisma.product.delete({ where: { id: product.id } });

    await Promise.all(
      [...images, ...videos, ...certificates].map(async (media) => {
        try {
          await this.storage.delete(media.key);
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
    kindRaw?: string,
  ): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, productId);
    const kind = kindRaw ?? 'other';

    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    if (!isProductImageKind(kind)) {
      throw new BadRequestException('Image kind is invalid');
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
      throw new BadRequestException(`A product can have at most ${PRODUCT_IMAGE_MAX_COUNT} images`);
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
            kind: kind as PrismaProductImageKind,
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

  async addVideo(
    user: AuthenticatedUser,
    productId: string,
    file?: Express.Multer.File,
    durationSeconds?: number | string,
  ): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, productId);

    if (!file) {
      throw new BadRequestException('Video file is required');
    }
    if (!(PRODUCT_VIDEO_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException('Only MP4, WebM, and QuickTime videos are allowed');
    }
    if (file.size > PRODUCT_VIDEO_MAX_BYTES) {
      throw new BadRequestException('Video is too large');
    }

    const existingCount = await this.prisma.productVideo.count({
      where: { productId: product.id },
    });
    if (existingCount >= PRODUCT_VIDEO_MAX_COUNT) {
      throw new BadRequestException(`A product can have at most ${PRODUCT_VIDEO_MAX_COUNT} videos`);
    }

    const duration = this.normalizeDurationSeconds(durationSeconds);
    const stored = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname || 'video',
      folder: `products/${product.id}/videos`,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productVideo.create({
          data: {
            productId: product.id,
            url: stored.url,
            key: stored.key,
            fileName: file.originalname || 'video',
            mimeType: file.mimetype,
            sizeBytes: file.size,
            durationSeconds: duration,
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

  async removeVideo(
    user: AuthenticatedUser,
    productId: string,
    videoId: string,
  ): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, productId);
    const video = await this.prisma.productVideo.findFirst({
      where: { id: videoId, productId: product.id },
    });
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productVideo.delete({ where: { id: video.id } });
      await this.markPendingForImageChange(tx, product);
    });
    await this.storage.delete(video.key).catch(() => undefined);

    return this.getById(product.id, user);
  }

  async addCertificate(
    user: AuthenticatedUser,
    productId: string,
    typeRaw: string,
    title: string,
    file?: Express.Multer.File,
  ): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, productId);
    const trimmedTitle = title?.trim();

    if (!isCertificateType(typeRaw)) {
      throw new BadRequestException('Certificate type is invalid');
    }
    if (!trimmedTitle) {
      throw new BadRequestException('Certificate title is required');
    }
    if (!file) {
      throw new BadRequestException('Certificate file is required');
    }
    if (!isFarmDocumentMimeType(file.mimetype)) {
      throw new BadRequestException('Only PDF, JPEG, PNG, and WebP certificates are allowed');
    }
    if (file.size > FARM_DOCUMENT_MAX_BYTES) {
      throw new BadRequestException('Certificate is too large');
    }

    const existingCount = await this.prisma.productCertificate.count({
      where: { productId: product.id },
    });
    if (existingCount >= FARM_DOCUMENT_MAX_COUNT) {
      throw new BadRequestException(
        `A product can have at most ${FARM_DOCUMENT_MAX_COUNT} certificates`,
      );
    }

    const stored = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname || 'certificate',
      folder: `products/${product.id}/certificates`,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productCertificate.create({
          data: {
            productId: product.id,
            type: typeRaw as PrismaCertificateType,
            title: trimmedTitle,
            fileName: file.originalname || 'certificate',
            url: stored.url,
            key: stored.key,
            mimeType: file.mimetype,
            sizeBytes: file.size,
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

  async removeCertificate(
    user: AuthenticatedUser,
    productId: string,
    certificateId: string,
  ): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, productId);
    const certificate = await this.prisma.productCertificate.findFirst({
      where: { id: certificateId, productId: product.id },
    });
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productCertificate.delete({ where: { id: certificate.id } });
      await this.markPendingForImageChange(tx, product);
    });
    await this.storage.delete(certificate.key).catch(() => undefined);

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

  private async requireOwnedProduct(ownerId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { farm: true, owner: { select: productOwnerSelect } },
    });

    if (!product || product.ownerUserId !== ownerId) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private assertFarmer(user: AuthenticatedUser) {
    if (!canTrade(user.role)) {
      throw new ForbiddenException('Sign in to manage products');
    }
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

  private normalizeOptionalString(value: unknown): string | null {
    return typeof value === 'string' ? value.trim() || null : null;
  }

  private normalizeNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
  }

  private normalizeAttributes(value: unknown): Prisma.InputJsonObject {
    return asAttributes(value as Prisma.JsonValue) as Prisma.InputJsonObject;
  }

  private normalizeDurationSeconds(value: number | string | undefined): number | null {
    if (value === undefined || value === '') {
      return null;
    }
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized < 0) {
      throw new BadRequestException('durationSeconds must be a non-negative integer');
    }
    return normalized;
  }

  private valuesEqual(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private toSummary(
    product: ProductWithFarmAndImages | ProductWithOwnerAndImages,
    sellerRating?: RatingSummary | null,
  ): ProductSummary {
    return mapProductSummary(product, sellerRating);
  }

  private toDetail(
    product: ProductWithOwnerAndImages,
    sellerRating?: RatingSummary | null,
    watching = false,
    isOwner = false,
  ): ProductDetail {
    return mapProductDetail(product, sellerRating, watching, isOwner);
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

    if (harvestStartAt && harvestEndAt && harvestStartAt.getTime() > harvestEndAt.getTime()) {
      throw new BadRequestException('harvestStartAt cannot be after harvestEndAt');
    }

    const forecastQuantity =
      dto.forecastQuantity === undefined
        ? (fallback?.forecastQuantity ?? null)
        : dto.forecastQuantity;

    if (forecastQuantity !== null && forecastQuantity !== undefined && forecastQuantity <= 0) {
      throw new BadRequestException('forecastQuantity must be greater than 0');
    }

    let harvestStatus: PrismaHarvestStatus | null = fallback?.harvestStatus ?? null;
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

  private async requirePublicOrOwnedProduct(productId: string, user: AuthenticatedUser) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        isPublished: true,
        moderationStatus: true,
        ownerUserId: true,
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const isOwner = user.role === 'admin' || product.ownerUserId === user.id;
    const isPublic =
      product.isPublished && product.moderationStatus === PrismaModerationStatus.approved;
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

    const preorderOpened = !params.previousPreorder && params.nextPreorder === true;

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

    const sellerLabel =
      params.product.farm?.name ||
      params.product.owner.displayName?.trim() ||
      'Seller';

    await Promise.all(
      watches
        .filter((watch) => !watch.user.blockedAt)
        .filter((watch) => watch.user.id !== params.product.ownerUserId)
        .map(async (watch) => {
          if (becameAvailable) {
            await this.notifications.notifyHarvestAvailable({
              user: watch.user,
              productId: params.product.id,
              productTitle: params.product.title,
              farmName: sellerLabel,
              harvestStatus: params.nextStatus ?? 'available',
            });
          }
          if (preorderOpened) {
            await this.notifications.notifyHarvestPreorderOpen({
              user: watch.user,
              productId: params.product.id,
              productTitle: params.product.title,
              farmName: sellerLabel,
            });
          }
        }),
    );
  }
}
