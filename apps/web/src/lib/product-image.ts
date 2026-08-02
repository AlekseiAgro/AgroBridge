import type { ProductImage } from '@agrobridge/shared';

export function getPrimaryProductImage(
  images: ProductImage[] | undefined | null,
): ProductImage | null {
  if (!images?.length) {
    return null;
  }
  return images.find((image) => image.isPrimary) ?? images[0] ?? null;
}
