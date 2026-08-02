import type { ProductCategory, ProductImage } from '@agrobridge/shared';
import { isProductCategory } from '@agrobridge/shared';
import { CATEGORY_MEDIA } from '@/lib/category-media';

export function toPublicMediaUrl(url: string): string {
  const match = url.match(/\/api\/uploads\/.+$/);
  if (match) {
    return match[0];
  }
  return url;
}

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

  if (product.category && isProductCategory(product.category)) {
    return {
      url: CATEGORY_MEDIA[product.category as ProductCategory],
      fromCategory: true,
    };
  }

  return {
    url: CATEGORY_MEDIA.other,
    fromCategory: true,
  };
}
