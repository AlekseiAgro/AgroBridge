import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
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
  catalogTextMatches,
  completedTranslationSearchParts,
  detectCatalogSourceLocale,
  isPubliclyListedProduct,
  presentCatalogText,
  presentFarmText,
  resolveCatalogLocale,
  PUBLICATION_PHOTO_REQUIRED_MESSAGE,
  publicationBlockedForMissingPhoto,
  publishedListingIncompleteMessage,
  publishedListingIssues,
  type ListingFields,
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
  type HarvestWatchItem,
  type Locale,
  type ProductDetail,
  type ProductSummary,
  type RatingSummary,
  type SeasonMonth,
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
import {
  CatalogTranslationService,
  productSourceHash,
} from '../catalog/catalog-translation.service';
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
import {
  PRODUCT_VIEW_DEDUP_WINDOW_MS,
  PRODUCT_VIEW_SOURCE_ORGANIC,
  productViewVisitorKey,
} from './product-view';
import { publicProductWhereAnd } from './public-product.where';

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
  description: true,
  sourceLocale: true,
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
  translations: true,
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
  translations: true,
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
    @Optional() private readonly catalogTranslations?: CatalogTranslationService,
  ) {}

  async catalog(
    query: CatalogQueryDto,
    viewer: AuthenticatedUser | null = null,
  ): Promise<ProductSummary[]> {
    const q = query.q?.trim() || undefined;
    const locale = resolveCatalogLocale(query.locale, viewer?.locale);
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

    if (harvestStatus) {
      and.push({ harvestStatus: harvestStatus });
    }

    if (preorder) {
      and.push({ preorderEnabled: true });
    }

    if (inSeason) {
      and.push({ seasonMonths: { has: new Date().getUTCMonth() + 1 } });
    }

    const where = publicProductWhereAnd(and);

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: productListInclude,
    });

    const ratings = await this.ratings.summariesForUsers(
      products.map((product) => product.ownerUserId),
    );

    const matched = q
      ? products.filter((product) =>
          catalogTextMatches(q, [
            product.title,
            product.description,
            product.variety,
            product.originPlace,
            product.farm?.name,
            product.owner.displayName,
            ...completedTranslationSearchParts(product.translations),
          ]),
        )
      : products;

    return matched.map((product) =>
      this.toSummary(product, ratings.get(product.ownerUserId), locale),
    );
  }

  async getById(
    id: string,
    viewer?: AuthenticatedUser | null,
    requestedLocale?: string | null,
  ): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const isOwner = viewer && (viewer.role === 'admin' || product.ownerUserId === viewer.id);

    const isPublic = isPubliclyListedProduct(product);

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
    const locale = resolveCatalogLocale(requestedLocale, viewer?.locale);
    return this.toDetail(product, sellerRating, watching, isCardOwner, Boolean(isOwner), locale);
  }

  async listMyWatches(user: AuthenticatedUser): Promise<HarvestWatchItem[]> {
    try {
      const watches = await this.prisma.harvestWatch.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              isPublished: true,
              moderationStatus: true,
              harvestStatus: true,
              preorderEnabled: true,
              ownerUserId: true,
              owner: { select: productOwnerSelect },
              farm: {
                select: {
                  id: true,
                  name: true,
                  region: true,
                  verificationStatus: true,
                },
              },
              images: {
                orderBy: imageOrderBy,
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      });

      const visible = watches.filter((watch) => isPubliclyListedProduct(watch.product));
      const ownerIds = [...new Set(visible.map((watch) => watch.product.ownerUserId))];
      const ratings = await this.ratings.summariesForUsers(ownerIds);

      return visible.map((watch) => ({
        id: watch.id,
        productId: watch.product.id,
        productTitle: watch.product.title,
        harvestStatus:
          watch.product.harvestStatus && isHarvestStatus(watch.product.harvestStatus)
            ? watch.product.harvestStatus
            : null,
        preorderEnabled: watch.product.preorderEnabled,
        createdAt: watch.createdAt.toISOString(),
        imageUrl: watch.product.images[0]?.url ?? null,
        owner: {
          id: watch.product.owner.id,
          displayName: watch.product.owner.displayName,
        },
        sellerRating: ratings.get(watch.product.ownerUserId) ?? { average: null, count: 0 },
        farm: watch.product.farm
          ? {
              id: watch.product.farm.id,
              name: watch.product.farm.name,
              region: watch.product.farm.region,
              verified: watch.product.farm.verificationStatus === 'approved',
            }
          : null,
      }));
    } catch {
      return [];
    }
  }

  async listMine(user: AuthenticatedUser): Promise<ProductSummary[]> {
    this.assertFarmer(user);

    const products = await this.prisma.product.findMany({
      where: { ownerUserId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: productListInclude,
    });
    const sellerRating = await this.ratings.summaryForUser(user.id);
    const metrics = await this.ownerListingMetrics(products.map((product) => product.id));

    return products.map((product) => ({
      ...this.toSummary(product, sellerRating, resolveCatalogLocale(undefined, user.locale)),
      viewCount: metrics.viewCountByProduct.get(product.id) ?? 0,
      watchCount: metrics.watchCountByProduct.get(product.id) ?? 0,
    }));
  }

  /**
   * Record a view of the public product detail page.
   * Skips the product owner, unpublished listings, and repeat visits from the
   * same visitor within 24 hours. Never returns visitor or watcher identities.
   */
  async recordPublicProductView(
    productId: string,
    viewer: AuthenticatedUser | null,
    visitor: { ip: string; userAgent: string },
  ): Promise<{ recorded: boolean }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        ownerUserId: true,
        title: true,
        isPublished: true,
        moderationStatus: true,
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (viewer?.id === product.ownerUserId) {
      return { recorded: false };
    }
    if (!isPubliclyListedProduct(product)) {
      throw new NotFoundException('Product not found');
    }

    const visitorKey = productViewVisitorKey({
      userId: viewer?.id ?? null,
      ip: visitor.ip,
      userAgent: visitor.userAgent,
    });
    const since = new Date(Date.now() - PRODUCT_VIEW_DEDUP_WINDOW_MS);
    const existing = await this.prisma.productView.findFirst({
      where: {
        productId: product.id,
        visitorKey,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (existing) {
      return { recorded: false };
    }

    await this.prisma.productView.create({
      data: {
        productId: product.id,
        visitorKey,
        viewerUserId: viewer?.id ?? null,
        source: PRODUCT_VIEW_SOURCE_ORGANIC,
      },
    });
    return { recorded: true };
  }

  async create(user: AuthenticatedUser, dto: CreateProductDto): Promise<ProductDetail> {
    this.assertFarmer(user);
    const farm = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    const input = dto;
    const isPublished = dto.isPublished ?? false;
    const quantity = this.normalizeQuantityRange(dto.minQuantity, dto.maxQuantity);
    const harvest = this.normalizeHarvestInput(dto);
    const packagingTypes = sanitizeStringArray(input.packagingTypes).filter(isPackagingType);
    const packagingWeights = sanitizeStringArray(input.packagingWeights);
    const incoterms = sanitizeStringArray(input.incoterms).filter(isIncoterm);
    const carriers = sanitizeStringArray(input.carriers).filter(isCarrier);

    this.assertPublishedListingFields({
      nextPublished: isPublished,
      next: {
        title: dto.title.trim(),
        category: dto.category || null,
        unit: dto.unit || null,
        priceFrom: this.normalizeNullableNumber(input.priceFrom),
        priceCurrency: this.normalizePriceCurrency(input.priceCurrency),
      },
    });
    await this.assertPublicationPhoto({ nextPublished: isPublished });

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
        priceCurrency: this.normalizePriceCurrency(input.priceCurrency),
        priceNegotiable: input.priceNegotiable ?? false,
        priceDependsOnVolume: input.priceDependsOnVolume ?? false,
        isPublished,
        moderationStatus: isPublished
          ? PrismaModerationStatus.pending
          : PrismaModerationStatus.draft,
        moderationNote: null,
        sourceLocale: detectCatalogSourceLocale(
          [dto.title, dto.description, input.variety, input.originPlace].filter(Boolean).join('\n'),
          user.locale,
        ),
      },
      include: productDetailInclude,
    });

    if (product.moderationStatus === PrismaModerationStatus.pending) {
      this.queuePendingModerationEmail(product, user);
    }

    void this.catalogTranslations?.syncProduct(product.id);
    return this.toDetail(
      product,
      null,
      false,
      true,
      true,
      resolveCatalogLocale(undefined, user.locale),
    );
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateProductDto): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, id);
    const input = dto;

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
        : this.normalizePriceCurrency(input.priceCurrency);
    const priceNegotiable = input.priceNegotiable === undefined ? undefined : input.priceNegotiable;
    const priceDependsOnVolume =
      input.priceDependsOnVolume === undefined ? undefined : input.priceDependsOnVolume;

    const nextTitle = dto.title !== undefined ? dto.title.trim() : product.title;
    const nextDescription =
      dto.description === undefined ? product.description : dto.description.trim() || null;
    const nextVariety = variety === undefined ? product.variety : variety;
    const nextOriginPlace = originPlace === undefined ? product.originPlace : originPlace;
    const translatableChanged =
      productSourceHash({
        title: nextTitle,
        description: nextDescription,
        variety: nextVariety,
        originPlace: nextOriginPlace,
      }) !==
      productSourceHash({
        title: product.title,
        description: product.description,
        variety: product.variety,
        originPlace: product.originPlace,
      });

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
      // Already-approved live listings stay public after edits — no re-moderation.
      product.isPublished &&
      product.moderationStatus === PrismaModerationStatus.approved
    ) {
      moderationStatus = PrismaModerationStatus.approved;
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

    this.assertPublishedListingFields({
      nextPublished,
      next: {
        title: dto.title !== undefined ? dto.title.trim() : product.title,
        category: dto.category !== undefined ? dto.category || null : product.category,
        unit: dto.unit !== undefined ? dto.unit || null : product.unit,
        priceFrom: priceFrom !== undefined ? priceFrom : toNumberOrNull(product.priceFrom),
        priceCurrency: priceCurrency !== undefined ? priceCurrency : product.priceCurrency,
      },
      previousPublished: product.isPublished,
      previous: {
        title: product.title,
        category: product.category,
        unit: product.unit,
        priceFrom: toNumberOrNull(product.priceFrom),
        priceCurrency: product.priceCurrency,
      },
    });
    await this.assertPublicationPhoto({
      nextPublished,
      previousPublished: product.isPublished,
      productId: product.id,
    });

    const previousStatus = product.harvestStatus;
    const previousPreorder = product.preorderEnabled;
    const wasPublic = isPubliclyListedProduct(product);

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
        sourceLocale: translatableChanged
          ? detectCatalogSourceLocale(
              [nextTitle, nextDescription, nextVariety, nextOriginPlace].filter(Boolean).join('\n'),
              user.locale,
            )
          : undefined,
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
      wasPublic,
      isPublic: isPubliclyListedProduct(updated),
    });

    if (
      updated.moderationStatus === PrismaModerationStatus.pending &&
      product.moderationStatus !== PrismaModerationStatus.pending
    ) {
      this.queuePendingModerationEmail(updated, user);
    }

    if (translatableChanged) {
      void this.catalogTranslations?.syncProduct(updated.id);
    }

    return this.toDetail(
      updated,
      null,
      false,
      true,
      true,
      resolveCatalogLocale(undefined, user.locale),
    );
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

    await Promise.all([
      ...images.map(async (media) => {
        try {
          await this.storage.delete(media.key);
        } catch {
          // Best-effort cleanup; DB row is already gone.
        }
      }),
      ...videos.map(async (media) => {
        try {
          await this.storage.delete(media.key);
        } catch {
          // Best-effort cleanup; DB row is already gone.
        }
      }),
      ...certificates.map(async (media) => {
        try {
          await this.storage.delete(media.key, 'private');
        } catch {
          // Best-effort cleanup; DB row is already gone.
        }
      }),
    ]);

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
      visibility: 'public',
    });

    const isPrimary = existingCount === 0;

    let enteredPending = false;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productImage.create({
          data: {
            productId: product.id,
            url: stored.url,
            key: stored.key,
            sortOrder: existingCount,
            isPrimary,
            kind: kind,
          },
        });

        enteredPending = await this.markPendingForImageChange(tx, product);
      });
    } catch (error) {
      await this.storage.delete(stored.key).catch(() => undefined);
      throw error;
    }

    if (enteredPending) {
      this.queuePendingModerationEmail(product, user);
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
      visibility: 'public',
    });

    let enteredPending = false;
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
        enteredPending = await this.markPendingForImageChange(tx, product);
      });
    } catch (error) {
      await this.storage.delete(stored.key).catch(() => undefined);
      throw error;
    }

    if (enteredPending) {
      this.queuePendingModerationEmail(product, user);
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

    const enteredPending = await this.prisma.$transaction(async (tx) => {
      await tx.productVideo.delete({ where: { id: video.id } });
      return this.markPendingForImageChange(tx, product);
    });
    await this.storage.delete(video.key).catch(() => undefined);

    if (enteredPending) {
      this.queuePendingModerationEmail(product, user);
    }

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
      visibility: 'private',
    });

    let enteredPending = false;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productCertificate.create({
          data: {
            productId: product.id,
            type: typeRaw,
            title: trimmedTitle,
            fileName: file.originalname || 'certificate',
            url: '',
            key: stored.key,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        });
        enteredPending = await this.markPendingForImageChange(tx, product);
      });
    } catch (error) {
      await this.storage.delete(stored.key, 'private').catch(() => undefined);
      throw error;
    }

    if (enteredPending) {
      this.queuePendingModerationEmail(product, user);
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

    const enteredPending = await this.prisma.$transaction(async (tx) => {
      await tx.productCertificate.delete({ where: { id: certificate.id } });
      return this.markPendingForImageChange(tx, product);
    });
    await this.storage.delete(certificate.key, 'private').catch(() => undefined);

    if (enteredPending) {
      this.queuePendingModerationEmail(product, user);
    }

    return this.getById(product.id, user);
  }

  /**
   * Resolves a certificate file after authorization. Ownership comes from the stored
   * product relation, never from a client-supplied storage path.
   */
  async getCertificateDownload(
    productId: string,
    certificateId: string,
    viewer?: AuthenticatedUser | null,
  ): Promise<{ key: string; fileName: string; mimeType: string }> {
    const certificate = await this.prisma.productCertificate.findFirst({
      where: { id: certificateId, productId },
      select: {
        key: true,
        fileName: true,
        mimeType: true,
        reviewStatus: true,
        product: {
          select: {
            ownerUserId: true,
            title: true,
            isPublished: true,
            moderationStatus: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    const product = certificate.product;
    const isPrivileged = Boolean(
      viewer && (viewer.role === 'admin' || product.ownerUserId === viewer.id),
    );
    const productIsPublic = isPubliclyListedProduct(product);
    const certificateIsApproved = certificate.reviewStatus === 'approved';

    if (certificateIsApproved && productIsPublic) {
      return {
        key: certificate.key,
        fileName: certificate.fileName,
        mimeType: certificate.mimeType,
      };
    }

    if (!viewer) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (!isPrivileged) {
      throw new NotFoundException('Certificate not found');
    }

    if (viewer.role !== 'admin' && !viewer.emailVerified) {
      throw new ForbiddenException('Confirm your email address to access your account');
    }

    return {
      key: certificate.key,
      fileName: certificate.fileName,
      mimeType: certificate.mimeType,
    };
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

    if (product.isPublished) {
      const photoCount = await this.prisma.productImage.count({ where: { productId: product.id } });
      if (photoCount <= 1) {
        throw new BadRequestException(PUBLICATION_PHOTO_REQUIRED_MESSAGE);
      }
    }

    const enteredPending = await this.prisma.$transaction(async (tx) => {
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

      return this.markPendingForImageChange(tx, product);
    });

    if (enteredPending) {
      this.queuePendingModerationEmail(product, user);
    }

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

    const enteredPending = await this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: { productId: product.id, isPrimary: true },
        data: { isPrimary: false },
      });
      await tx.productImage.update({
        where: { id: image.id },
        data: { isPrimary: true },
      });
      return this.markPendingForImageChange(tx, product);
    });

    if (enteredPending) {
      this.queuePendingModerationEmail(product, user);
    }

    return this.getById(product.id, user);
  }

  private async markPendingForImageChange(
    tx: Prisma.TransactionClient,
    product: { id: string; isPublished: boolean; moderationStatus: PrismaModerationStatus },
  ): Promise<boolean> {
    if (!product.isPublished) {
      return false;
    }

    // Approved listings stay live when media changes; only rejected cards re-enter moderation.
    if (product.moderationStatus === PrismaModerationStatus.rejected) {
      await tx.product.update({
        where: { id: product.id },
        data: {
          moderationStatus: PrismaModerationStatus.pending,
          moderationNote: null,
          moderatedAt: null,
          moderatedById: null,
        },
      });
      return true;
    }

    return false;
  }

  private queuePendingModerationEmail(
    product: { id: string; title: string },
    seller: AuthenticatedUser,
  ): void {
    void this.notifyAdminsProductPending(product, seller).catch(() => undefined);
  }

  private async notifyAdminsProductPending(
    product: { id: string; title: string },
    seller: AuthenticatedUser,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        role: 'admin',
        blockedAt: null,
      },
      select: {
        email: true,
        locale: true,
        displayName: true,
      },
    });

    if (admins.length === 0) {
      return;
    }

    const sellerName = seller.displayName?.trim() || seller.email;
    await Promise.all(
      admins.map((admin) =>
        this.notifications.notifyProductPendingModeration({
          admin,
          productTitle: product.title,
          productId: product.id,
          sellerName,
        }),
      ),
    );
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

  private async assertPublicationPhoto(args: {
    nextPublished: boolean;
    previousPublished?: boolean;
    productId?: string;
  }) {
    if (!args.nextPublished || args.previousPublished) {
      return;
    }
    const photoCount = args.productId
      ? await this.prisma.productImage.count({ where: { productId: args.productId } })
      : 0;
    if (
      publicationBlockedForMissingPhoto({
        nextPublished: args.nextPublished,
        previousPublished: args.previousPublished,
        photoCount,
      })
    ) {
      throw new BadRequestException(PUBLICATION_PHOTO_REQUIRED_MESSAGE);
    }
  }

  private assertPublishedListingFields(args: {
    nextPublished: boolean;
    next: ListingFields;
    previousPublished?: boolean;
    previous?: ListingFields;
  }) {
    const issues = publishedListingIssues(args);
    if (issues.length > 0) {
      throw new BadRequestException(publishedListingIncompleteMessage(issues));
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

  private normalizePriceCurrency(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (typeof value === 'string' && isPriceCurrency(value)) {
      return value;
    }
    throw new BadRequestException('priceCurrency must be GEL, EUR, or USD');
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
    locale: Locale = 'en',
  ): ProductSummary {
    const summary = mapProductSummary(product, sellerRating);
    const text = presentCatalogText(product, locale);
    const farm = summary.farm && product.farm
      ? {
          ...summary.farm,
          ...presentFarmText(product.farm, locale),
        }
      : summary.farm;
    return {
      ...summary,
      farm,
      source: text.source,
      display: text.display,
    };
  }

  private async ownerListingMetrics(productIds: string[]): Promise<{
    viewCountByProduct: Map<string, number>;
    watchCountByProduct: Map<string, number>;
  }> {
    if (productIds.length === 0) {
      return {
        viewCountByProduct: new Map(),
        watchCountByProduct: new Map(),
      };
    }

    const [views, watches] = await Promise.all([
      this.prisma.productView.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _count: { _all: true },
      }),
      this.prisma.harvestWatch.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _count: { _all: true },
      }),
    ]);

    return {
      viewCountByProduct: new Map(views.map((row) => [row.productId, row._count._all])),
      watchCountByProduct: new Map(watches.map((row) => [row.productId, row._count._all])),
    };
  }

  private toDetail(
    product: ProductWithOwnerAndImages,
    sellerRating?: RatingSummary | null,
    watching = false,
    isOwner = false,
    includePrivateCertificates = false,
    locale: Locale = 'en',
  ): ProductDetail {
    const detail = mapProductDetail(
      product,
      sellerRating,
      watching,
      isOwner,
      includePrivateCertificates,
    );
    const text = presentCatalogText(product, locale);
    return {
      ...detail,
      source: text.source,
      display: text.display,
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
        harvestStatus = dto.harvestStatus;
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
        title: true,
        isPublished: true,
        moderationStatus: true,
      },
    });
    if (!product || !isPubliclyListedProduct(product)) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private async requirePublicOrOwnedProduct(productId: string, user: AuthenticatedUser) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        isPublished: true,
        moderationStatus: true,
        ownerUserId: true,
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const isOwner = user.role === 'admin' || product.ownerUserId === user.id;
    const isPublic = isPubliclyListedProduct(product);
    if (!isPublic && !isOwner) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  /**
   * Notify harvest watchers after a listing becomes public (e.g. admin approve)
   * or after harvest fields change on an already-public card.
   */
  async dispatchHarvestWatchNotifications(params: {
    productId: string;
    previousStatus: PrismaHarvestStatus | null;
    previousPreorder: boolean;
    wasPublic: boolean;
  }): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: params.productId },
      include: productDetailInclude,
    });
    if (!product) return;

    await this.notifyHarvestWatchersIfNeeded({
      product,
      previousStatus: params.previousStatus,
      previousPreorder: params.previousPreorder,
      nextStatus: product.harvestStatus,
      nextPreorder: product.preorderEnabled,
      wasPublic: params.wasPublic,
      isPublic: isPubliclyListedProduct(product),
    });
  }

  private async notifyHarvestWatchersIfNeeded(params: {
    product: ProductWithOwnerAndImages;
    previousStatus: PrismaHarvestStatus | null;
    previousPreorder: boolean;
    nextStatus: PrismaHarvestStatus | null;
    nextPreorder: boolean;
    wasPublic: boolean;
    isPublic: boolean;
  }) {
    if (!params.isPublic) return;

    const becamePublic = !params.wasPublic && params.isPublic;
    const statusIsSellable =
      params.nextStatus === PrismaHarvestStatus.available ||
      params.nextStatus === PrismaHarvestStatus.limited;

    // Also fire when a card with sellable status / preorder first becomes public
    // (e.g. save-as-draft then publish, or admin approval), not only on field diffs.
    const becameAvailable =
      statusIsSellable && (params.nextStatus !== params.previousStatus || becamePublic);

    const preorderOpened =
      params.nextPreorder === true && (!params.previousPreorder || becamePublic);

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
      params.product.farm?.name || params.product.owner.displayName?.trim() || 'Seller';

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
