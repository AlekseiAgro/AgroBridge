import { PRODUCT_CATEGORIES, isProductCategory, type ProductCategory } from '@agrobridge/shared';

/**
 * Marketplace category stills, keyed by stable ProductCategory ids.
 * Paths are locale-independent. Do not resolve images from labels or filenames
 * via partial string matching.
 */
export const CATEGORY_MEDIA: Record<ProductCategory, string> = {
  fruits: '/images/categories/fruits.jpg',
  vegetables: '/images/categories/vegetables.jpg',
  berries: '/images/categories/berries.jpg',
  nuts: '/images/categories/nuts.jpg',
  wine: '/images/categories/wine.jpg',
  dairy: '/images/categories/dairy.jpg',
  honey: '/images/categories/honey.jpg',
  mineralWater: '/images/categories/mineralWater.jpg',
  spices: '/images/categories/spices.jpg',
  tea: '/images/categories/tea.jpg',
  bayLeaf: '/images/categories/bayLeaf.jpg',
  essentialOils: '/images/categories/essentialOils.jpg',
  organic: '/images/categories/organic.jpg',
  other: '/images/hero/farm-landscape.jpg',
};

export const SHOWCASE_CATEGORIES = PRODUCT_CATEGORIES.filter(
  (category) => category !== 'other',
);

export function resolveProductCategory(
  category: string | null | undefined,
): ProductCategory {
  return category && isProductCategory(category) ? category : 'other';
}

export function getCategoryMediaUrl(category: string | null | undefined): string {
  return CATEGORY_MEDIA[resolveProductCategory(category)];
}
