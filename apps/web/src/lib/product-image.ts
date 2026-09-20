import type { ProductCategory, ProductImage } from '@agrobridge/shared';
import { CATEGORY_MEDIA, getCategoryMediaUrl, resolveProductCategory } from './category-media';
import { toPublicMediaUrl } from './public-media-url';

export { isFarmVerificationObjectUrl, isLegacyFarmDocumentUploadUrl, toPublicMediaUrl } from './public-media-url';
export { getCategoryMediaUrl, resolveProductCategory } from './category-media';

export function getPrimaryProductImage(
  images: ProductImage[] | undefined | null,
): ProductImage | null {
  if (!images?.length) {
    return null;
  }
  return images.find((image) => image.isPrimary) ?? images[0] ?? null;
}

/** Prefer uploaded product photos; fall back to category showcase art. */
export function getProductCardImage(product: {
  images?: ProductImage[] | null;
  category?: string | null;
}): { url: string; fromCategory: boolean } | null {
  const primary = getPrimaryProductImage(product.images);
  if (primary?.url) {
    return { url: toPublicMediaUrl(primary.url), fromCategory: false };
  }

  return {
    url: getCategoryMediaUrl(product.category),
    fromCategory: true,
  };
}

/**
 * Alt text for a catalog/farm/dashboard card image.
 * A category fallback must not be described as the seller's product photograph.
 */
export function getProductCardImageAlt(input: {
  fromCategory: boolean;
  productTitle: string;
  categoryFallbackAlt: string;
}): string {
  if (input.fromCategory) {
    return input.categoryFallbackAlt;
  }
  return input.productTitle.trim();
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
