export const PRODUCT_CATEGORIES = [
  'fruits',
  'vegetables',
  'nuts',
  'wine',
  'dairy',
  'honey',
  'herbs',
  'other',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_UNITS = ['kg', 'ton', 'box', 'liter', 'bottle', 'piece'] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

export function isProductUnit(value: string): value is ProductUnit {
  return (PRODUCT_UNITS as readonly string[]).includes(value);
}

export type FarmSummary = {
  id: string;
  name: string;
  region: string | null;
  description: string | null;
  owner: {
    id: string;
    displayName: string | null;
  };
  productCount: number;
};

export type FarmDetail = FarmSummary & {
  createdAt: string;
  products: ProductSummary[];
};

import type { ModerationStatus } from './moderation';

export type ProductSummary = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  isPublished: boolean;
  moderationStatus: ModerationStatus;
  moderationNote: string | null;
  farm: {
    id: string;
    name: string;
    region: string | null;
  };
};

export type ProductDetail = ProductSummary & {
  createdAt: string;
  updatedAt: string;
};

export type CatalogQuery = {
  q?: string;
  category?: string;
  region?: string;
};
