import { ApiError } from '../api/errors';
import { isPriceCurrency, isProductCategory, isProductUnit } from '../catalog/categories';
import {
  FORECAST_QUANTITY_MAX,
  harvestDatesOrdered,
  parseHarvestDate,
  parseHarvestStatus,
  parseSeasonMonths,
} from './harvest';
import { logisticsCreateFields, logisticsIssue } from './logistics';
import { optionalTrimmed, productTextIssue } from './product-form';
import { parseSellerProduct, type SellerProduct } from './products';

/** Matches `CreateProductDto` title length. */
export const PRODUCT_TITLE_MIN = 2;
export const PRODUCT_TITLE_MAX = 160;
export const PRODUCT_DESCRIPTION_MAX = 4000;

const FORBIDDEN_DRAFT_FIELDS = [
  'farmId',
  'ownerUserId',
  'sourceLocale',
  'moderationStatus',
  'moderationNote',
] as const;

export type DraftIssue =
  | 'titleRequired'
  | 'titleTooShort'
  | 'titleTooLong'
  | 'descriptionTooLong'
  | 'varietyTooLong'
  | 'countryTooLong'
  | 'originPlaceTooLong'
  | 'quantityInvalid'
  | 'quantityRangeInvalid'
  | 'priceInvalid'
  | 'forecastInvalid'
  | 'harvestDateInvalid'
  | 'harvestDateOrder'
  | 'seasonMonthsInvalid'
  | 'harvestStatusInvalid'
  | 'packagingTypesInvalid'
  | 'packagingWeightsInvalid'
  | 'palletTooLong'
  | 'incotermsInvalid'
  | 'carriersInvalid'
  | 'customDeliveryTooLong'
  | 'nearestPortTooLong'
  | 'leadTimeInvalid';

export type DraftCommercialInput = {
  category: string | null;
  variety: string;
  country: string;
  originPlace: string;
  unit: string | null;
  minQuantity: string;
  maxQuantity: string;
  currentStock: string;
  monthlyProduction: string;
  maxAnnualProduction: string;
  price: string;
  currency: string | null;
  priceNegotiable: boolean;
  priceDependsOnVolume: boolean;
  seasonMonths: number[];
  harvestStartAt: string;
  harvestEndAt: string;
  forecastQuantity: string;
  harvestStatus: string | null;
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

export const EMPTY_DRAFT_COMMERCIAL: DraftCommercialInput = {
  category: null,
  variety: '',
  country: '',
  originPlace: '',
  unit: null,
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

export type DraftFailure = 'validation' | 'unauthorized' | 'forbidden' | 'rateLimit' | 'network' | 'generic';

export type CreateProductDraftBody = {
  title: string;
  description?: string;
  category?: string;
  variety?: string;
  country?: string;
  originPlace?: string;
  unit?: string;
  minQuantity?: number;
  maxQuantity?: number;
  currentStock?: number;
  monthlyProduction?: number;
  maxAnnualProduction?: number;
  priceFrom?: number;
  priceCurrency?: string;
  priceNegotiable: boolean;
  priceDependsOnVolume: boolean;
  preorderEnabled: boolean;
  seasonMonths?: number[];
  harvestStartAt?: string;
  harvestEndAt?: string;
  forecastQuantity?: number;
  harvestStatus?: string;
  deliveryAvailable: boolean;
  packagingTypes?: string[];
  packagingWeights?: string[];
  palletSize?: string;
  incoterms?: string[];
  carriers?: string[];
  customDelivery?: string;
  nearestPort?: string;
  leadTimeDays?: number;
  isPublished: false;
};

export type CreateDraftPhase = 'session' | 'signedOut' | 'unverified' | 'profileUnavailable' | 'form';

export type DraftGate = {
  pending: boolean;
};

export type DraftSubmitResult =
  | { status: 'ignored' }
  | { status: 'invalid'; issue: DraftIssue }
  | { status: 'created'; product: SellerProduct }
  | { status: 'failed'; failure: DraftFailure };

export function createDraftPhase(input: {
  authStatus: 'loading' | 'anonymous' | 'authenticated';
  user: { emailVerified: boolean } | null;
  profileUnavailable: boolean;
}): CreateDraftPhase {
  if (input.authStatus === 'loading') {
    return 'session';
  }
  if (input.profileUnavailable) {
    return 'profileUnavailable';
  }
  if (!input.user) {
    return 'signedOut';
  }
  if (!input.user.emailVerified) {
    return 'unverified';
  }
  return 'form';
}

export function showCreateProductAction(phase: 'list' | 'empty' | string): boolean {
  return phase === 'list' || phase === 'empty';
}

/**
 * Empty input is omitted. A supplied value must be greater than zero with at most 2 decimal places.
 * iOS decimal-pad inserts the locale separator, so `0,5` and `0.5` are the same number.
 * Extra decimal places are rejected, not rounded or truncated.
 */
export function parseDraftPrice(raw: string): number | null | 'invalid' {
  const text = raw.trim().replace(/,/g, '.');
  if (!text) {
    return null;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return 'invalid';
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) {
    return 'invalid';
  }
  return value;
}

/** Title is trimmed. Description keeps internal line breaks and drops only surrounding space. */
export function draftIssue(
  title: string,
  description: string,
  commercial: DraftCommercialInput = EMPTY_DRAFT_COMMERCIAL,
): DraftIssue | null {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return 'titleRequired';
  }
  if (trimmedTitle.length < PRODUCT_TITLE_MIN) {
    return 'titleTooShort';
  }
  if (trimmedTitle.length > PRODUCT_TITLE_MAX) {
    return 'titleTooLong';
  }
  if (description.trim().length > PRODUCT_DESCRIPTION_MAX) {
    return 'descriptionTooLong';
  }
  const textIssue = productTextIssue(commercial);
  if (textIssue) {
    return textIssue;
  }
  if (parseDraftPrice(commercial.price) === 'invalid') {
    return 'priceInvalid';
  }
  if (commercial.category && !isProductCategory(commercial.category)) {
    return 'priceInvalid';
  }
  if (commercial.unit && !isProductUnit(commercial.unit)) {
    return 'priceInvalid';
  }
  if (commercial.currency && !isPriceCurrency(commercial.currency)) {
    return 'priceInvalid';
  }
  const quantities = parsedQuantities(commercial);
  if (!quantities) {
    return 'quantityInvalid';
  }
  if (
    quantities.minQuantity != null &&
    quantities.maxQuantity != null &&
    quantities.minQuantity > quantities.maxQuantity
  ) {
    return 'quantityRangeInvalid';
  }
  const forecast = parseDraftPrice(commercial.forecastQuantity);
  if (forecast === 'invalid' || (typeof forecast === 'number' && forecast > FORECAST_QUANTITY_MAX)) {
    return 'forecastInvalid';
  }
  const harvestStartAt = parseHarvestDate(commercial.harvestStartAt);
  const harvestEndAt = parseHarvestDate(commercial.harvestEndAt);
  if (harvestStartAt === 'invalid' || harvestEndAt === 'invalid') {
    return 'harvestDateInvalid';
  }
  if (!harvestDatesOrdered(harvestStartAt, harvestEndAt)) {
    return 'harvestDateOrder';
  }
  if (parseSeasonMonths(commercial.seasonMonths) === 'invalid') {
    return 'seasonMonthsInvalid';
  }
  if (parseHarvestStatus(commercial.harvestStatus) === 'invalid') {
    return 'harvestStatusInvalid';
  }
  return logisticsIssue(commercial);
}

/** Same numeric contract as `CreateProductDto`: optional, greater than zero, at most 2 decimal places. */
function parsedQuantities(commercial: DraftCommercialInput): {
  minQuantity: number | null;
  maxQuantity: number | null;
  currentStock: number | null;
  monthlyProduction: number | null;
  maxAnnualProduction: number | null;
} | null {
  const minQuantity = parseDraftPrice(commercial.minQuantity);
  const maxQuantity = parseDraftPrice(commercial.maxQuantity);
  const currentStock = parseDraftPrice(commercial.currentStock);
  const monthlyProduction = parseDraftPrice(commercial.monthlyProduction);
  const maxAnnualProduction = parseDraftPrice(commercial.maxAnnualProduction);
  if (
    [minQuantity, maxQuantity, currentStock, monthlyProduction, maxAnnualProduction].some(
      (value) => value === 'invalid',
    )
  ) {
    return null;
  }
  return {
    minQuantity: minQuantity as number | null,
    maxQuantity: maxQuantity as number | null,
    currentStock: currentStock as number | null,
    monthlyProduction: monthlyProduction as number | null,
    maxAnnualProduction: maxAnnualProduction as number | null,
  };
}

export function draftRequestBody(
  title: string,
  description: string,
  commercial: DraftCommercialInput = EMPTY_DRAFT_COMMERCIAL,
): CreateProductDraftBody | null {
  if (draftIssue(title, description, commercial)) {
    return null;
  }
  const body: CreateProductDraftBody = {
    title: title.trim(),
    priceNegotiable: commercial.priceNegotiable,
    priceDependsOnVolume: commercial.priceDependsOnVolume,
    preorderEnabled: commercial.preorderEnabled,
    deliveryAvailable: commercial.deliveryAvailable,
    isPublished: false,
  };
  const trimmedDescription = description.trim();
  if (trimmedDescription) {
    body.description = trimmedDescription;
  }
  if (commercial.category && isProductCategory(commercial.category)) {
    body.category = commercial.category;
  }
  const variety = optionalTrimmed(commercial.variety);
  if (variety) {
    body.variety = variety;
  }
  const country = optionalTrimmed(commercial.country);
  if (country) {
    body.country = country;
  }
  const originPlace = optionalTrimmed(commercial.originPlace);
  if (originPlace) {
    body.originPlace = originPlace;
  }
  if (commercial.unit && isProductUnit(commercial.unit)) {
    body.unit = commercial.unit;
  }
  const quantities = parsedQuantities(commercial);
  if (quantities?.minQuantity != null) {
    body.minQuantity = quantities.minQuantity;
  }
  if (quantities?.maxQuantity != null) {
    body.maxQuantity = quantities.maxQuantity;
  }
  if (quantities?.currentStock != null) {
    body.currentStock = quantities.currentStock;
  }
  if (quantities?.monthlyProduction != null) {
    body.monthlyProduction = quantities.monthlyProduction;
  }
  if (quantities?.maxAnnualProduction != null) {
    body.maxAnnualProduction = quantities.maxAnnualProduction;
  }
  const price = parseDraftPrice(commercial.price);
  if (typeof price === 'number') {
    body.priceFrom = price;
  }
  if (commercial.currency && isPriceCurrency(commercial.currency)) {
    body.priceCurrency = commercial.currency;
  }
  const seasonMonths = parseSeasonMonths(commercial.seasonMonths);
  if (Array.isArray(seasonMonths) && seasonMonths.length > 0) {
    body.seasonMonths = seasonMonths;
  }
  const harvestStartAt = parseHarvestDate(commercial.harvestStartAt);
  if (typeof harvestStartAt === 'string') {
    body.harvestStartAt = harvestStartAt;
  }
  const harvestEndAt = parseHarvestDate(commercial.harvestEndAt);
  if (typeof harvestEndAt === 'string') {
    body.harvestEndAt = harvestEndAt;
  }
  const forecast = parseDraftPrice(commercial.forecastQuantity);
  if (typeof forecast === 'number' && forecast <= FORECAST_QUANTITY_MAX) {
    body.forecastQuantity = forecast;
  }
  const harvestStatus = parseHarvestStatus(commercial.harvestStatus);
  if (typeof harvestStatus === 'string') {
    body.harvestStatus = harvestStatus;
  }
  return { ...body, ...logisticsCreateFields(commercial) };
}

export function draftBodyFields(body: CreateProductDraftBody): string[] {
  return Object.keys(body);
}

export function draftBodyHasForbiddenField(body: CreateProductDraftBody): boolean {
  return draftBodyFields(body).some((field) =>
    (FORBIDDEN_DRAFT_FIELDS as readonly string[]).includes(field),
  );
}

export function draftFailure(error: unknown): DraftFailure {
  if (!(error instanceof ApiError)) {
    return 'generic';
  }
  if (error.kind === 'network' || error.kind === 'timeout') {
    return 'network';
  }
  if (error.status === 400) {
    return 'validation';
  }
  if (error.status === 401) {
    return 'unauthorized';
  }
  if (error.status === 403) {
    return 'forbidden';
  }
  if (error.status === 429) {
    return 'rateLimit';
  }
  return 'generic';
}

/** A saved draft opens in the editor so photos can be added to the new product id. */
export function editorAfterDraft(result: DraftSubmitResult): string | null {
  return result.status === 'created' ? result.product.id : null;
}

/** A failed save stays on the form. A created draft is listed under My Products. */
export function routeAfterDraft(status: DraftSubmitResult['status']): 'MyProducts' | null {
  return status === 'created' ? 'MyProducts' : null;
}

export async function submitProductDraft(options: {
  title: string;
  description: string;
  commercial?: DraftCommercialInput;
  gate: DraftGate;
  create: (body: CreateProductDraftBody) => Promise<SellerProduct>;
  onPending: (pending: boolean) => void;
}): Promise<DraftSubmitResult> {
  if (options.gate.pending) {
    return { status: 'ignored' };
  }
  const commercial = options.commercial ?? EMPTY_DRAFT_COMMERCIAL;
  const issue = draftIssue(options.title, options.description, commercial);
  if (issue) {
    return { status: 'invalid', issue };
  }
  const body = draftRequestBody(options.title, options.description, commercial);
  if (!body) {
    return { status: 'invalid', issue: 'titleRequired' };
  }
  options.gate.pending = true;
  options.onPending(true);
  try {
    const product = await options.create(body);
    return { status: 'created', product };
  } catch (error) {
    return { status: 'failed', failure: draftFailure(error) };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

export function createdDraftFromResponse(value: unknown): SellerProduct | null {
  const product = parseSellerProduct(value);
  if (!product || product.isPublished) {
    return null;
  }
  return product;
}
