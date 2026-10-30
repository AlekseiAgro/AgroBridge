import type { Availability, PriceCurrency, ProductCategory, ProductUnit } from '../catalog/categories';

/** Matches `CreateProductDto` / `UpdateProductDto`. */
export const PRODUCT_VARIETY_MAX = 120;
export const PRODUCT_COUNTRY_MAX = 80;
export const PRODUCT_ORIGIN_PLACE_MAX = 160;

/** Create stores Georgia when country is omitted. Edit shows the stored value. */
export const DEFAULT_PRODUCT_COUNTRY = 'Georgia';

/** Fields shared by Create Product and Edit Product. Later sections can extend this type. */
export type SellerProductFormValues = {
  title: string;
  description: string;
  category: ProductCategory | null;
  variety: string;
  country: string;
  originPlace: string;
  unit: ProductUnit | null;
  /** True after the seller picks a unit, including a unit loaded from the server. */
  unitTouched: boolean;
  minQuantity: string;
  maxQuantity: string;
  currentStock: string;
  monthlyProduction: string;
  maxAnnualProduction: string;
  price: string;
  currency: PriceCurrency | null;
  priceNegotiable: boolean;
  priceDependsOnVolume: boolean;
  seasonMonths: number[];
  harvestStartAt: string;
  harvestEndAt: string;
  forecastQuantity: string;
  harvestStatus: Availability | null;
  preorderEnabled: boolean;
  packagingTypes: string[];
  packagingWeightsText: string;
  palletSize: string;
  deliveryAvailable: boolean;
  incoterms: string[];
  carriers: string[];
  customDelivery: string;
  nearestPort: string;
  leadTimeDays: string;
};

export const EMPTY_PRODUCT_FORM: SellerProductFormValues = {
  title: '',
  description: '',
  category: null,
  variety: '',
  country: DEFAULT_PRODUCT_COUNTRY,
  originPlace: '',
  unit: null,
  unitTouched: false,
  minQuantity: '',
  maxQuantity: '',
  currentStock: '',
  monthlyProduction: '',
  maxAnnualProduction: '',
  price: '',
  currency: null,
  priceNegotiable: false,
  priceDependsOnVolume: false,
  seasonMonths: [],
  harvestStartAt: '',
  harvestEndAt: '',
  forecastQuantity: '',
  harvestStatus: null,
  preorderEnabled: false,
  packagingTypes: [],
  packagingWeightsText: '',
  palletSize: '',
  deliveryAvailable: false,
  incoterms: [],
  carriers: [],
  customDelivery: '',
  nearestPort: '',
  leadTimeDays: '',
};

export type ProductTextIssue = 'varietyTooLong' | 'countryTooLong' | 'originPlaceTooLong';

/** Empty after trim is null. Internal spaces stay. Over-long values are not truncated. */
export function optionalTrimmed(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function productTextIssue(values: {
  variety: string;
  country: string;
  originPlace: string;
}): ProductTextIssue | null {
  if (values.variety.trim().length > PRODUCT_VARIETY_MAX) {
    return 'varietyTooLong';
  }
  if (values.country.trim().length > PRODUCT_COUNTRY_MAX) {
    return 'countryTooLong';
  }
  if (values.originPlace.trim().length > PRODUCT_ORIGIN_PLACE_MAX) {
    return 'originPlaceTooLong';
  }
  return null;
}
