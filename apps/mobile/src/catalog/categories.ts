/**
 * Mirrors `PRODUCT_CATEGORIES` in packages/shared/src/catalog.ts.
 * The mobile bundle does not import the shared barrel, because that barrel
 * also exports phone parsing and would pull libphonenumber-js into Metro.
 */
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

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

export const PRODUCT_UNITS = ['kg', 'ton', 'box', 'liter', 'bottle', 'piece'] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export function isProductUnit(value: string): value is ProductUnit {
  return (PRODUCT_UNITS as readonly string[]).includes(value);
}

/** Mirrors `CATEGORY_DEFAULT_UNITS` in packages/shared/src/catalog.ts. */
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

export function defaultUnitForCategory(category: string | null | undefined): ProductUnit | null {
  if (!category || !isProductCategory(category)) {
    return null;
  }
  return CATEGORY_DEFAULT_UNITS[category];
}

/**
 * Web fills the suggested unit only until the seller chooses a unit.
 * A later category change does not replace that choice.
 */
export function applyCategoryChoice(
  nextCategory: ProductCategory | null,
  unit: ProductUnit | null,
  unitTouched: boolean,
): { category: ProductCategory | null; unit: ProductUnit | null } {
  if (unitTouched) {
    return { category: nextCategory, unit };
  }
  return { category: nextCategory, unit: defaultUnitForCategory(nextCategory) };
}

/** Mirrors `PRICE_CURRENCIES` in packages/shared/src/currency.ts. */
export const PRICE_CURRENCIES = ['GEL', 'EUR', 'USD'] as const;

export type PriceCurrency = (typeof PRICE_CURRENCIES)[number];

export function isPriceCurrency(value: string): value is PriceCurrency {
  return (PRICE_CURRENCIES as readonly string[]).includes(value);
}

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

export function isGeorgiaRegion(value: string): value is GeorgiaRegion {
  return (GEORGIA_REGIONS as readonly string[]).includes(value);
}

export const AVAILABILITY = ['growing', 'available', 'limited', 'soldOut'] as const;

export type Availability = (typeof AVAILABILITY)[number];
