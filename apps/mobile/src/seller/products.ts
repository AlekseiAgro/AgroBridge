import { formatListedPrice } from '../catalog/model';
import type { MessageKey } from '../i18n/en';

/**
 * Seller listing row from GET /products/mine.
 * Kept separate from the public catalog model, which omits moderation fields.
 */
export type SellerProductStatus = 'draft' | 'pending' | 'published' | 'rejected';

/** List badge only. Publish rules still use sellerProductStatus. */
export type SellerListStatus = SellerProductStatus | 'approvedUnpublished';

export const MY_PRODUCT_FILTERS = ['all', 'published', 'pending'] as const;

export type MyProductFilter = (typeof MY_PRODUCT_FILTERS)[number];

export type SellerHarvestStatus = 'growing' | 'available' | 'limited' | 'soldOut';

export type SellerProductImage = {
  url: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type SellerProduct = {
  id: string;
  /** Original seller title. Translations are not used on this screen. */
  title: string;
  priceFrom: number | null;
  priceCurrency: string | null;
  unit: string | null;
  isPublished: boolean;
  moderationStatus: string;
  moderationNote: string | null;
  harvestStatus: SellerHarvestStatus | null;
  images: SellerProductImage[];
  /** Public detail views. Absent or null when this payload did not include the owner metric. */
  viewCount?: number | null;
  /** Harvest-alert subscribers. Absent or null when this payload did not include the owner metric. */
  watchCount?: number | null;
};

export type MyProductsPhase =
  | 'session'
  | 'signedOut'
  | 'unverified'
  | 'profileUnavailable'
  | 'loading'
  | 'error'
  | 'empty'
  | 'list';

export type SellerProductDestination = {
  screen: 'ProductDetail';
  params: { productId: string; ownerPreview: true };
};

export type SellerEditDestination = {
  screen: 'EditProduct';
  params: { productId: string };
};

const MODERATION_STATUSES = new Set(['draft', 'pending', 'approved', 'rejected']);
const HARVEST_STATUSES = new Set<SellerHarvestStatus>(['growing', 'available', 'limited', 'soldOut']);
const CURRENCIES = new Set(['GEL', 'EUR', 'USD']);

/** Same placeholders the public catalog refuses to list. */
const INTERNAL_DRAFT_TITLES = new Set([
  'Untitled product',
  'Новый товар',
  'ახალი პროდუქტი',
  'Unbenanntes Produkt',
  'Produit sans titre',
  'Prodotto senza titolo',
  'Producto sin título',
]);

export function shouldLoadMyProducts(input: {
  user: { emailVerified: boolean } | null | undefined;
  profileUnavailable: boolean;
}): boolean {
  return input.user?.emailVerified === true && !input.profileUnavailable;
}

export function showMyProductsEntry(input: {
  authStatus: 'loading' | 'anonymous' | 'authenticated';
  profileUnavailable: boolean;
  emailVerified: boolean;
}): boolean {
  return shouldLoadMyProducts({
    user: input.authStatus === 'authenticated' ? { emailVerified: input.emailVerified } : null,
    profileUnavailable: input.profileUnavailable,
  });
}

export function myProductsPhase(input: {
  authStatus: 'loading' | 'anonymous' | 'authenticated';
  user: { emailVerified: boolean } | null;
  profileUnavailable: boolean;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  count: number;
}): MyProductsPhase {
  if (input.authStatus === 'loading') {
    return 'session';
  }
  if (input.profileUnavailable) {
    return 'profileUnavailable';
  }
  if (!input.user) {
    return 'signedOut';
  }
  if (!input.user.emailVerified) {
    return 'unverified';
  }
  if (input.loadStatus === 'error') {
    return 'error';
  }
  if (input.loadStatus !== 'ready') {
    return 'loading';
  }
  return input.count === 0 ? 'empty' : 'list';
}

export function myProductsRefreshVisible(phase: MyProductsPhase): boolean {
  return phase === 'list' || phase === 'empty';
}

export function myProductsLoadMode(hasLoaded: boolean): 'initial' | 'refresh' {
  return hasLoaded ? 'refresh' : 'initial';
}

/** A failed refresh keeps the list. The first load still shows the error screen. */
export function keepMyProductsAfterError(hasLoaded: boolean): boolean {
  return hasLoaded;
}

/**
 * Draft until the listing is both approved and published.
 * Pending and rejected come from moderationStatus. isPublished alone is not a status.
 */
export function sellerProductStatus(product: {
  moderationStatus: string;
  isPublished: boolean;
}): SellerProductStatus {
  if (product.moderationStatus === 'rejected') {
    return 'rejected';
  }
  if (product.moderationStatus === 'pending') {
    return 'pending';
  }
  if (product.moderationStatus === 'approved' && product.isPublished) {
    return 'published';
  }
  return 'draft';
}

/**
 * Same lifecycle as sellerProductStatus, except an approved listing that is not
 * published stays distinct from a draft. Sold out is harvest status, not this value.
 */
export function sellerListStatus(product: {
  moderationStatus: string;
  isPublished: boolean;
}): SellerListStatus {
  if (product.moderationStatus === 'approved' && !product.isPublished) {
    return 'approvedUnpublished';
  }
  return sellerProductStatus(product);
}

/** Web filters GET /products/mine in the client. There is no list query and no pagination. */
export function filterMyProducts(products: SellerProduct[], filter: MyProductFilter): SellerProduct[] {
  if (filter === 'published') {
    return products.filter((product) => product.isPublished && product.moderationStatus === 'approved');
  }
  if (filter === 'pending') {
    return products.filter((product) => product.moderationStatus === 'pending');
  }
  return products;
}

/** Same order as the website harvest field: unset, then the four stored statuses. */
export const HARVEST_STATUS_CHOICES = [null, 'growing', 'available', 'limited', 'soldOut'] as const;

export type HarvestChoice = (typeof HARVEST_STATUS_CHOICES)[number];

export const UPDATE_AVAILABILITY_KEY = 'seller.products.updateAvailability' satisfies MessageKey;

export function harvestBadgeKey(status: SellerHarvestStatus | null): MessageKey {
  if (status === 'growing') return 'availability.growing';
  if (status === 'available') return 'availability.available';
  if (status === 'limited') return 'availability.limited';
  if (status === 'soldOut') return 'availability.soldOut';
  return 'seller.draft.harvestStatusUnset';
}

export function harvestChoiceSelected(current: SellerHarvestStatus | null, choice: HarvestChoice): boolean {
  return current === choice;
}

/**
 * A dismissed sheet or the already selected value sends nothing.
 * Unset is null, matching the website form (`harvestStatus || null`).
 */
export function harvestStatusPatch(
  current: SellerHarvestStatus | null,
  next: HarvestChoice | 'dismiss',
): { harvestStatus: SellerHarvestStatus | null } | null {
  if (next === 'dismiss' || next === current) {
    return null;
  }
  return { harvestStatus: next };
}

export function openAvailabilitySheet(productId: string): { productId: string } {
  return { productId };
}

export function sellerPreviewDestination(product: { id: string }): {
  screen: 'ProductDetail';
  params: { productId: string; ownerPreview: true };
} {
  return { screen: 'ProductDetail', params: { productId: product.id, ownerPreview: true } };
}

export function productsAfterHarvestUpdate(products: SellerProduct[], updated: SellerProduct): SellerProduct[] {
  return products.map((product) =>
    product.id === updated.id
      ? {
          ...updated,
          viewCount: updated.viewCount ?? product.viewCount,
          watchCount: updated.watchCount ?? product.watchCount,
        }
      : product,
  );
}

/** Owner list metrics. A missing field is shown as zero, matching the website cards. */
export function sellerMetricCount(value: number | null | undefined): number {
  return value ?? 0;
}

export function sellerRejectionNote(product: {
  moderationStatus: string;
  isPublished: boolean;
  moderationNote: string | null;
}): string | null {
  if (sellerProductStatus(product) !== 'rejected') {
    return null;
  }
  const note = product.moderationNote?.trim() ?? '';
  return note || null;
}

export function isInternalDraftTitle(title: string): boolean {
  return INTERNAL_DRAFT_TITLES.has(title.trim());
}

export function sellerProductOpensPublicDetail(product: SellerProduct): boolean {
  if (!product.isPublished || product.moderationStatus !== 'approved') {
    return false;
  }
  const title = product.title.trim();
  return title.length > 0 && !isInternalDraftTitle(title);
}

/** The card opens the existing product screen. Editing is a second step from that screen. */
export function sellerProductDestination(product: { id: string }): SellerProductDestination {
  return sellerPreviewDestination(product);
}

export function sellerEditDestination(product: { id: string }): SellerEditDestination {
  return { screen: 'EditProduct', params: { productId: product.id } };
}

export function sellerProductImageUrl(images: SellerProductImage[]): string | null {
  const usable = images.filter((image) => {
    const url = image.url.trim();
    return url.length > 0 && !url.includes('/images/categories/');
  });
  if (usable.length === 0) {
    return null;
  }
  const sorted = [...usable].sort((left, right) => left.sortOrder - right.sortOrder);
  return (sorted.find((image) => image.isPrimary) ?? sorted[0])?.url ?? null;
}

export function sellerPriceLine(
  priceFrom: number | null,
  priceCurrency: string | null,
  unitLabel: string | null,
): string | null {
  return formatListedPrice(priceFrom, priceCurrency, unitLabel);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readImages(value: unknown): SellerProductImage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const images: SellerProductImage[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const image = item as Record<string, unknown>;
    const url = text(image.url);
    if (!url) {
      continue;
    }
    images.push({
      url,
      isPrimary: image.isPrimary === true,
      sortOrder: readNumber(image.sortOrder) ?? 0,
    });
  }
  return images;
}

function sourceTitle(row: Record<string, unknown>): string | null {
  const source = row.source;
  if (source && typeof source === 'object') {
    const title = text((source as Record<string, unknown>).title);
    if (title) {
      return title;
    }
  }
  return text(row.title);
}

export function parseSellerProduct(value: unknown): SellerProduct | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const title = sourceTitle(row);
  const moderationStatus = text(row.moderationStatus);
  if (!id || !title || !moderationStatus || !MODERATION_STATUSES.has(moderationStatus)) {
    return null;
  }
  const harvest = text(row.harvestStatus);
  const currency = text(row.priceCurrency);
  const note = row.moderationNote;
  return {
    id,
    title,
    priceFrom: readNumber(row.priceFrom),
    priceCurrency: currency && CURRENCIES.has(currency) ? currency : null,
    unit: text(row.unit),
    isPublished: row.isPublished === true,
    moderationStatus,
    moderationNote: typeof note === 'string' ? note : null,
    harvestStatus:
      harvest && HARVEST_STATUSES.has(harvest as SellerHarvestStatus)
        ? (harvest as SellerHarvestStatus)
        : null,
    images: readImages(row.images),
    viewCount: readCount(row.viewCount),
    watchCount: readCount(row.watchCount),
  };
}

function readCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value);
}

export function parseSellerProducts(value: unknown): SellerProduct[] {
  if (!Array.isArray(value)) {
    throw new Error('My products response was not a list.');
  }
  return value.flatMap((item) => {
    const product = parseSellerProduct(item);
    return product ? [product] : [];
  });
}
