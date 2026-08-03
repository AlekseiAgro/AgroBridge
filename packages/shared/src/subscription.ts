import type { GeorgiaRegion, ProductCategory } from './catalog';

export type AlertSubscription = {
  id: string;
  notifyProducts: boolean;
  notifyPurchaseRequests: boolean;
  allCategories: boolean;
  categories: ProductCategory[];
  allRegions: boolean;
  regions: GeorgiaRegion[];
  updatedAt: string;
};

export type UpsertAlertSubscriptionInput = {
  notifyProducts: boolean;
  notifyPurchaseRequests: boolean;
  allCategories: boolean;
  categories: string[];
  allRegions: boolean;
  regions: string[];
};
