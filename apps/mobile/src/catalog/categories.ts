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

export const SHOWCASE_CATEGORIES = PRODUCT_CATEGORIES.filter((category) => category !== 'other');

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

export const AVAILABILITY = ['growing', 'available', 'limited', 'soldOut'] as const;

export type Availability = (typeof AVAILABILITY)[number];
