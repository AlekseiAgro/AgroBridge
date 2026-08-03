import {
  computeProductQualityScore,
  evaluateMarketOpportunity,
  isCarrier,
  isCertificateType,
  isIncoterm,
  isPackagingType,
  isPriceCurrency,
  isProductImageKind,
  normalizeSeasonMonths,
  type Carrier,
  type CertificateType,
  type HarvestStatus,
  type Incoterm,
  type ModerationStatus,
  type PackagingType,
  type PriceCurrency,
  type ProductCertificate,
  type ProductDetail,
  type ProductImage,
  type ProductImageKind,
  type ProductQualityScore,
  type ProductSummary,
  type ProductVideo,
  type RatingSummary,
  type VerificationStatus,
} from '@agrobridge/shared';
import type { Prisma } from '@prisma/client';

export type ProductFarmSlice = {
  id: string;
  name: string;
  region: string | null;
  verificationStatus: string;
  foundedYear: number | null;
  farmSizeHectares: Prisma.Decimal | number | null;
  ownershipType: string | null;
  exportMarkets: string[];
  history: string | null;
  ownerId?: string;
};

export type ProductMediaSlice = {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
  kind?: string | null;
};

export type ProductVideoSlice = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  durationSeconds: number | null;
  createdAt: Date;
};

export type ProductCertificateSlice = {
  id: string;
  type: string;
  title: string;
  fileName: string;
  url: string;
  mimeType: string;
  reviewStatus: string;
  reviewNote: string | null;
  createdAt: Date;
};

export type ProductRowSlice = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  variety: string | null;
  country: string | null;
  originPlace: string | null;
  unit: string | null;
  minQuantity: Prisma.Decimal | number | null;
  maxQuantity: Prisma.Decimal | number | null;
  currentStock: Prisma.Decimal | number | null;
  monthlyProduction: Prisma.Decimal | number | null;
  maxAnnualProduction: Prisma.Decimal | number | null;
  seasonMonths: number[];
  harvestStartAt: Date | null;
  harvestEndAt: Date | null;
  forecastQuantity: Prisma.Decimal | number | null;
  harvestStatus: string | null;
  preorderEnabled: boolean;
  attributes: Prisma.JsonValue;
  packagingTypes: string[];
  packagingWeights: string[];
  palletSize: string | null;
  incoterms: string[];
  carriers: string[];
  customDelivery: string | null;
  nearestPort: string | null;
  deliveryAvailable: boolean;
  leadTimeDays: number | null;
  priceFrom: Prisma.Decimal | number | null;
  priceCurrency: string | null;
  priceNegotiable: boolean;
  priceDependsOnVolume: boolean;
  isPublished: boolean;
  moderationStatus: string;
  moderationNote: string | null;
  images: ProductMediaSlice[];
  videos?: ProductVideoSlice[];
  certificates?: ProductCertificateSlice[];
  farm: ProductFarmSlice;
  createdAt?: Date;
  updatedAt?: Date;
};

export function toNumberOrNull(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value);
}

export function asAttributes(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function filterKnown<T extends string>(
  values: string[],
  guard: (value: string) => value is T,
): T[] {
  return values.filter(guard);
}

export function mapProductImages(images: ProductMediaSlice[]): ProductImage[] {
  return images.map((image) => ({
    id: image.id,
    url: image.url,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
    kind: (image.kind && isProductImageKind(image.kind) ? image.kind : 'other') as ProductImageKind,
  }));
}

export function mapProductVideos(videos: ProductVideoSlice[] = []): ProductVideo[] {
  return videos.map((video) => ({
    id: video.id,
    url: video.url,
    fileName: video.fileName,
    mimeType: video.mimeType,
    durationSeconds: video.durationSeconds,
    createdAt: video.createdAt.toISOString(),
  }));
}

export function mapProductCertificates(
  certificates: ProductCertificateSlice[] = [],
): ProductCertificate[] {
  return certificates.map((cert) => ({
    id: cert.id,
    type: (isCertificateType(cert.type) ? cert.type : 'other') as CertificateType,
    title: cert.title,
    fileName: cert.fileName,
    url: cert.url,
    mimeType: cert.mimeType,
    reviewStatus: cert.reviewStatus as ProductCertificate['reviewStatus'],
    reviewNote: cert.reviewNote,
    createdAt: cert.createdAt.toISOString(),
  }));
}

export function buildQualityScore(product: ProductRowSlice): ProductQualityScore {
  const images = mapProductImages(product.images);
  const certificates = mapProductCertificates(product.certificates);
  return computeProductQualityScore({
    title: product.title,
    category: product.category,
    variety: product.variety,
    country: product.country,
    region: product.farm.region,
    originPlace: product.originPlace,
    description: product.description,
    imageCount: images.length,
    imageKinds: images.map((image) => image.kind),
    videoCount: product.videos?.length ?? 0,
    hasSeasonality:
      product.seasonMonths.length > 0 ||
      Boolean(product.harvestStartAt) ||
      Boolean(product.harvestEndAt),
    currentStock: toNumberOrNull(product.currentStock),
    monthlyProduction: toNumberOrNull(product.monthlyProduction),
    maxAnnualProduction: toNumberOrNull(product.maxAnnualProduction),
    minQuantity: toNumberOrNull(product.minQuantity),
    maxQuantity: toNumberOrNull(product.maxQuantity),
    attributes: asAttributes(product.attributes),
    packagingTypes: product.packagingTypes,
    packagingWeights: product.packagingWeights,
    certificateCount: certificates.length,
    approvedCertificateCount: certificates.filter((cert) => cert.reviewStatus === 'approved')
      .length,
    incoterms: product.incoterms,
    carriers: product.carriers,
    nearestPort: product.nearestPort,
    leadTimeDays: product.leadTimeDays,
    priceFrom: toNumberOrNull(product.priceFrom),
    priceNegotiable: product.priceNegotiable,
    priceDependsOnVolume: product.priceDependsOnVolume,
    farmFoundedYear: product.farm.foundedYear,
    farmSizeHectares: toNumberOrNull(product.farm.farmSizeHectares),
    farmHistory: product.farm.history,
    farmExportMarkets: product.farm.exportMarkets,
  });
}

export function mapProductSummary(
  product: ProductRowSlice,
  sellerRating?: RatingSummary | null,
): ProductSummary {
  const certificates = mapProductCertificates(product.certificates);
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    category: product.category,
    variety: product.variety,
    country: product.country,
    originPlace: product.originPlace,
    unit: product.unit,
    minQuantity: toNumberOrNull(product.minQuantity),
    maxQuantity: toNumberOrNull(product.maxQuantity),
    currentStock: toNumberOrNull(product.currentStock),
    monthlyProduction: toNumberOrNull(product.monthlyProduction),
    maxAnnualProduction: toNumberOrNull(product.maxAnnualProduction),
    seasonMonths: normalizeSeasonMonths(product.seasonMonths),
    harvestStartAt: product.harvestStartAt?.toISOString() ?? null,
    harvestEndAt: product.harvestEndAt?.toISOString() ?? null,
    forecastQuantity: toNumberOrNull(product.forecastQuantity),
    harvestStatus: (product.harvestStatus as HarvestStatus | null) ?? null,
    preorderEnabled: product.preorderEnabled,
    attributes: asAttributes(product.attributes),
    packagingTypes: filterKnown(product.packagingTypes, isPackagingType),
    packagingWeights: product.packagingWeights,
    palletSize: product.palletSize,
    incoterms: filterKnown(product.incoterms, isIncoterm),
    carriers: filterKnown(product.carriers, isCarrier),
    customDelivery: product.customDelivery,
    nearestPort: product.nearestPort,
    deliveryAvailable: product.deliveryAvailable,
    leadTimeDays: product.leadTimeDays,
    priceFrom: toNumberOrNull(product.priceFrom),
    priceCurrency:
      product.priceCurrency && isPriceCurrency(product.priceCurrency)
        ? (product.priceCurrency as PriceCurrency)
        : null,
    priceNegotiable: product.priceNegotiable,
    priceDependsOnVolume: product.priceDependsOnVolume,
    isPublished: product.isPublished,
    moderationStatus: product.moderationStatus as ModerationStatus,
    moderationNote: product.moderationNote,
    images: mapProductImages(product.images),
    videoCount: product.videos?.length ?? 0,
    certificateBadges: [
      ...new Set(
        certificates
          .filter((cert) => cert.reviewStatus === 'approved' || cert.reviewStatus === 'pending')
          .map((cert) => cert.type),
      ),
    ],
    qualityScore: buildQualityScore(product),
    opportunity: evaluateMarketOpportunity({
      id: product.id,
      category: product.category,
      harvestStartAt: product.harvestStartAt,
      harvestStatus: product.harvestStatus,
      preorderEnabled: product.preorderEnabled,
      currentStock: toNumberOrNull(product.currentStock),
      maxQuantity: toNumberOrNull(product.maxQuantity),
      exportMarkets: product.farm.exportMarkets,
    }),
    farm: {
      id: product.farm.id,
      name: product.farm.name,
      region: product.farm.region,
      verificationStatus: product.farm.verificationStatus as VerificationStatus,
      verified: product.farm.verificationStatus === 'approved',
      foundedYear: product.farm.foundedYear,
      farmSizeHectares: toNumberOrNull(product.farm.farmSizeHectares),
      ownershipType: product.farm.ownershipType,
      exportMarkets: product.farm.exportMarkets ?? [],
      history: product.farm.history,
      sellerRating: sellerRating ?? { average: null, count: 0 },
    },
  };
}

export function mapProductDetail(
  product: ProductRowSlice & { createdAt: Date; updatedAt: Date },
  sellerRating?: RatingSummary | null,
  watching = false,
  isOwner = false,
): ProductDetail {
  const summary = mapProductSummary(product, sellerRating);
  const qualityScore = isOwner
    ? summary.qualityScore
    : {
        score: summary.qualityScore.score,
        tier: summary.qualityScore.tier,
        checklist: [],
        suggestions: [],
      };

  return {
    ...summary,
    qualityScore,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    watching,
    isOwner,
    videos: mapProductVideos(product.videos),
    certificates: mapProductCertificates(product.certificates),
  };
}

export function sanitizeStringArray(values: unknown, max = 20): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .slice(0, max);
}
