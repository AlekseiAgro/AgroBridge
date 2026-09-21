import type { ProductCategory, ProductImage } from '@agrobridge/shared';
import { CATEGORY_MEDIA, resolveProductCategory } from './category-media';
import { toPublicMediaUrl } from './public-media-url';

export { isFarmVerificationObjectUrl, isLegacyFarmDocumentUploadUrl, toPublicMediaUrl } from './public-media-url';
export { getCategoryMediaUrl, resolveProductCategory } from './category-media';

const CATEGORY_MEDIA_PATH = '/images/categories/';

export function getPrimaryProductImage(
  images: ProductImage[] | undefined | null,
): ProductImage | null {
  if (!images?.length) {
    return null;
  }
  return images.find((image) => image.isPrimary) ?? images[0] ?? null;
}

/** True when a URL points at a category/showcase still, not a product photograph. */
export function isCategoryMediaUrl(url: string): boolean {
  const normalized = url.trim();
  if (!normalized) {
    return false;
  }
  try {
    const path = /^https?:\/\//i.test(normalized) ? new URL(normalized).pathname : normalized;
    return path.includes(CATEGORY_MEDIA_PATH);
  } catch {
    return normalized.includes(CATEGORY_MEDIA_PATH);
  }
}

/**
 * Public URL for a product-specific photograph only.
 * Empty, certificate/document, and category-showcase URLs resolve to null.
 */
export function resolveProductImageUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  const publicUrl = toPublicMediaUrl(trimmed);
  if (!publicUrl) {
    return null;
  }
  if (isCategoryMediaUrl(publicUrl)) {
    return null;
  }
  return publicUrl;
}

/**
 * Prefer an uploaded product photo. Never fall back to a category showcase still.
 * A category image is not a product photograph.
 */
export function getProductCardImage(product: {
  images?: ProductImage[] | null;
  category?: string | null;
}): { url: string } | null {
  const primary = getPrimaryProductImage(product.images);
  const url = resolveProductImageUrl(primary?.url);
  return url ? { url } : null;
}

/** Gallery photographs with resolvable product-specific URLs, in stored order. */
export function getRenderableProductImages(
  images: ProductImage[] | null | undefined,
): ProductImage[] {
  if (!images?.length) {
    return [];
  }
  const rendered: ProductImage[] = [];
  for (const image of images) {
    const url = resolveProductImageUrl(image.url);
    if (!url) {
      continue;
    }
    rendered.push({ ...image, url });
  }
  return rendered;
}

/**
 * Alt text for a catalog/farm/dashboard card image.
 * Missing product photos must not be described as a category illustration.
 */
export function getProductCardImageAlt(input: {
  hasProductPhoto: boolean;
  productTitle: string;
  noPhotoAlt: string;
}): string {
  if (!input.hasProductPhoto) {
    return input.noPhotoAlt;
  }
  return input.productTitle.trim() || input.noPhotoAlt;
}

export function formatCategoryFallbackAlt(
  category: string | null | undefined,
  translate: (key: string, values?: Record<string, string>) => string,
): string {
  const id: ProductCategory = resolveProductCategory(category);
  return translate('categoryFallbackAlt', {
    category: translate(`categories.${id}`),
  });
}

export { CATEGORY_MEDIA };
