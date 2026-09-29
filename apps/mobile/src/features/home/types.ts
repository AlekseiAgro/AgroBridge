import type { Availability, GeorgiaRegion, ProductCategory } from '../../catalog/categories';
import type { MessageKey } from '../../i18n/en';

export type PresentationProduct = {
  id: string;
  nameKey: MessageKey;
  categoryId: ProductCategory;
  regionId: GeorgiaRegion;
  availability: Availability;
  verified: boolean;
  imageUrl: string;
  placement: 'featured' | 'new';
};

export type PresentationRequest = {
  id: string;
  titleKey: MessageKey;
  quantityKey: MessageKey;
  categoryId: ProductCategory;
  regionId: GeorgiaRegion;
};

export type HomeFeed = {
  products: PresentationProduct[];
  requests: PresentationRequest[];
};

export function categoryLabelKey(categoryId: ProductCategory): MessageKey {
  return `categories.${categoryId}`;
}

export function regionLabelKey(regionId: GeorgiaRegion): MessageKey {
  return `regions.${regionId}`;
}

export function availabilityLabelKey(availability: Availability): MessageKey {
  return `availability.${availability}`;
}
