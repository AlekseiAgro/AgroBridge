import { isPriceCurrency } from './currency';
import { isProductCategory, isProductUnit } from './catalog';
import { isInternalDraftProductTitle } from './product-titles';

/** Minimal existing fields a published catalog listing must have. */
export const LISTING_REQUIRED_FIELDS = [
  'title',
  'category',
  'unit',
  'priceFrom',
  'priceCurrency',
] as const;

export type ListingRequiredField = (typeof LISTING_REQUIRED_FIELDS)[number];

export type ListingFields = {
  title?: string | null;
  category?: string | null;
  unit?: string | null;
  priceFrom?: number | null;
  priceCurrency?: string | null;
};

export const PUBLISHED_LISTING_INCOMPLETE_MESSAGE =
  'Published listings require a real title, category, unit, price, and currency';

export const PUBLICATION_PHOTO_REQUIRED_MESSAGE = 'At least 1 photo is required to publish';

/**
 * A first publication needs one photo. Drafts do not.
 * An already published listing stays editable without a photo so existing
 * catalog rows are not blocked or unpublished.
 */
export function publicationBlockedForMissingPhoto(args: {
  nextPublished: boolean;
  previousPublished?: boolean;
  photoCount: number;
}): boolean {
  if (!args.nextPublished) {
    return false;
  }
  if (args.photoCount >= 1) {
    return false;
  }
  if (args.previousPublished) {
    return false;
  }
  return true;
}

function hasRealTitle(title: string | null | undefined): boolean {
  const normalized = title?.trim() ?? '';
  return normalized.length >= 2 && !isInternalDraftProductTitle(normalized);
}

function hasListedPrice(priceFrom: number | null | undefined): boolean {
  return priceFrom != null && Number.isFinite(priceFrom) && priceFrom > 0;
}

function hasListedCurrency(priceCurrency: string | null | undefined): boolean {
  const normalized = priceCurrency?.trim() ?? '';
  return Boolean(normalized) && isPriceCurrency(normalized);
}

/** Missing or invalid fields that block publishing a catalog listing. */
export function listingRequirementIssues(product: ListingFields): ListingRequiredField[] {
  const issues: ListingRequiredField[] = [];

  if (!hasRealTitle(product.title)) {
    issues.push('title');
  }
  if (!product.category || !isProductCategory(product.category)) {
    issues.push('category');
  }
  if (!product.unit || !isProductUnit(product.unit)) {
    issues.push('unit');
  }
  if (!hasListedPrice(product.priceFrom)) {
    issues.push('priceFrom');
  }
  if (!hasListedCurrency(product.priceCurrency)) {
    issues.push('priceCurrency');
  }

  return issues;
}

export function isListingComplete(product: ListingFields): boolean {
  return listingRequirementIssues(product).length === 0;
}

/**
 * Issues that must be rejected for the next published state.
 *
 * Drafts are never blocked. First publish (create or draft → published) must be
 * complete. An already-published row is only rejected when the update newly
 * breaks a required field, so existing incomplete listings stay editable.
 */
export function publishedListingIssues(args: {
  nextPublished: boolean;
  next: ListingFields;
  previousPublished?: boolean;
  previous?: ListingFields;
}): ListingRequiredField[] {
  if (!args.nextPublished) {
    return [];
  }

  const nextIssues = listingRequirementIssues(args.next);
  if (nextIssues.length === 0) {
    return [];
  }

  if (!args.previousPublished) {
    return nextIssues;
  }

  const previousIssues = new Set(listingRequirementIssues(args.previous ?? {}));
  return nextIssues.filter((issue) => !previousIssues.has(issue));
}

export function publishedListingIncompleteMessage(issues: ListingRequiredField[]): string {
  return `${PUBLISHED_LISTING_INCOMPLETE_MESSAGE}. Missing: ${issues.join(', ')}`;
}
