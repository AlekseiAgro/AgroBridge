export const PRODUCT_CATEGORIES = [
  'fruits',
  'vegetables',
  'berries',
  'nuts',
  'wine',
  'dairy',
  'honey',
  'mineralWater',
  'spices',
  'tea',
  'bayLeaf',
  'essentialOils',
  'organic',
  'other',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_UNITS = ['kg', 'ton', 'box', 'liter', 'bottle', 'piece'] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

/** Suggested sell unit for each product group (farmer can still override). */
export const CATEGORY_DEFAULT_UNITS: Record<ProductCategory, ProductUnit> = {
  fruits: 'kg',
  vegetables: 'kg',
  berries: 'kg',
  nuts: 'kg',
  wine: 'bottle',
  dairy: 'kg',
  honey: 'kg',
  mineralWater: 'liter',
  spices: 'kg',
  tea: 'kg',
  bayLeaf: 'kg',
  essentialOils: 'liter',
  organic: 'kg',
  other: 'kg',
};

/** Canonical keys for Georgia's main administrative regions (+ Tbilisi). */
export const GEORGIA_REGIONS = [
  'tbilisi',
  'adjara',
  'guria',
  'imereti',
  'kakheti',
  'kvemoKartli',
  'mtskhetaMtianeti',
  'rachaLechkhumiKvemoSvaneti',
  'samegreloZemoSvaneti',
  'samtskheJavakheti',
  'shidaKartli',
] as const;

export type GeorgiaRegion = (typeof GEORGIA_REGIONS)[number];

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

export function isProductUnit(value: string): value is ProductUnit {
  return (PRODUCT_UNITS as readonly string[]).includes(value);
}

export function defaultUnitForCategory(
  category: string | null | undefined,
): ProductUnit | null {
  if (!category || !isProductCategory(category)) {
    return null;
  }
  return CATEGORY_DEFAULT_UNITS[category];
}

export function isGeorgiaRegion(value: string): value is GeorgiaRegion {
  return (GEORGIA_REGIONS as readonly string[]).includes(value);
}

import type { FarmDocument, VerificationStatus } from './verification';
import type { HarvestStatus, SeasonMonth } from './harvest';

export type FarmSummary = {
  id: string;
  name: string;
  region: string | null;
  description: string | null;
  verificationStatus: VerificationStatus;
  /** True when verificationStatus === 'approved' (public Verified badge). */
  verified: boolean;
  owner: {
    id: string;
    displayName: string | null;
  };
  productCount: number;
};

export type FarmDetail = FarmSummary & {
  createdAt: string;
  verificationNote: string | null;
  verifiedAt: string | null;
  companyRegistrationNumber?: string | null;
  companyRegistryValid?: boolean | null;
  documents?: FarmDocument[];
  products: ProductSummary[];
};

import type { ModerationStatus } from './moderation';
import type { RatingSummary } from './rating';

export const PRODUCT_IMAGE_MAX_COUNT = 8;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type ProductImageMimeType = (typeof PRODUCT_IMAGE_MIME_TYPES)[number];

export function isProductImageMimeType(value: string): value is ProductImageMimeType {
  return (PRODUCT_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

export type ProductImage = {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
};

export type ProductSummary = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  /** Minimum quantity the farmer can sell in one deal (in `unit`). */
  minQuantity: number | null;
  /** Maximum quantity the farmer can sell (in `unit`). */
  maxQuantity: number | null;
  /** Months (1–12) when this crop is typically in season. */
  seasonMonths: SeasonMonth[];
  harvestStartAt: string | null;
  harvestEndAt: string | null;
  /** Forecast harvest volume in the product `unit`. */
  forecastQuantity: number | null;
  harvestStatus: HarvestStatus | null;
  preorderEnabled: boolean;
  isPublished: boolean;
  moderationStatus: ModerationStatus;
  moderationNote: string | null;
  images: ProductImage[];
  farm: {
    id: string;
    name: string;
    region: string | null;
    verificationStatus: VerificationStatus;
    verified: boolean;
    /** Aggregate deal rating of the farm owner (seller). */
    sellerRating: RatingSummary;
  };
};

export type ProductDetail = ProductSummary & {
  createdAt: string;
  updatedAt: string;
  /** Whether the current viewer watches harvest/preorder alerts for this product. */
  watching?: boolean;
};

export type CatalogQuery = {
  q?: string;
  category?: string;
  region?: string;
  harvestStatus?: HarvestStatus;
  /** When true, only listings that accept pre-orders. */
  preorder?: boolean;
  /** When true, only listings whose seasonMonths include the current month. */
  inSeason?: boolean;
};
