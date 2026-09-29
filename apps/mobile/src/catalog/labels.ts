import type { MessageKey } from '../i18n/en';
import {
  isGeorgiaRegion,
  isProductCategory,
  isProductUnit,
  type Availability,
  type ProductUnit,
} from './categories';
import type { CatalogProduct, CatalogRequest } from './model';

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

const HARVEST_STATUSES = ['growing', 'available', 'limited', 'soldOut'] as const;

export function isHarvestStatus(value: string): value is Availability {
  return (HARVEST_STATUSES as readonly string[]).includes(value);
}

export function categoryLabel(categoryId: string | null | undefined, t: Translate): string | null {
  if (!categoryId) {
    return null;
  }
  if (isProductCategory(categoryId)) {
    return t(`categories.${categoryId}`);
  }
  return categoryId;
}

export function regionLabel(regionId: string | null | undefined, t: Translate): string | null {
  if (!regionId) {
    return null;
  }
  if (isGeorgiaRegion(regionId)) {
    return t(`regions.${regionId}`);
  }
  return regionId;
}

export function countryLabel(country: string | null | undefined, t: Translate): string {
  if (!country || country.trim().toLowerCase() === 'georgia') {
    return t('home.country.georgia');
  }
  return country.trim();
}

export function unitLabel(unit: string | null | undefined, t: Translate): string | null {
  if (!unit) {
    return null;
  }
  if (isProductUnit(unit)) {
    return t(`units.${unit as ProductUnit}`);
  }
  return unit;
}

export function productSearchLabels(product: CatalogProduct, t: Translate): string[] {
  return [
    categoryLabel(product.category, t),
    regionLabel(product.farm?.region, t),
    countryLabel(product.country, t),
  ].filter((part): part is string => Boolean(part));
}

export function requestSearchLabels(request: CatalogRequest, t: Translate): string[] {
  return [categoryLabel(request.category, t)].filter((part): part is string => Boolean(part));
}

export function requestStatusLabel(status: string, t: Translate): string {
  if (
    status === 'open' ||
    status === 'closed' ||
    status === 'cancelled' ||
    status === 'fulfilled'
  ) {
    return t(`requests.status.${status}`);
  }
  return status;
}
