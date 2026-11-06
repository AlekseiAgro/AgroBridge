import { ApiError } from '../api/errors';
import {
  isPriceCurrency,
  isProductCategory,
  isProductUnit,
  type Availability,
  type PriceCurrency,
  type ProductCategory,
  type ProductUnit,
} from '../catalog/categories';
import { parseProductCertificates, type SellerProductCertificate } from './certificates';
import { draftFailure, draftIssue, parseDraftPrice, type DraftFailure, type DraftGate, type DraftIssue } from './draft';
import {
  FORECAST_QUANTITY_MAX,
  harvestDateInput,
  parseHarvestDate,
  parseHarvestStatus,
  parseSeasonMonths,
  readSeasonMonths,
} from './harvest';
import {
  CARRIERS,
  INCOTERMS,
  PACKAGING_TYPES,
  logisticsEditFields,
  readCodeList,
  readLeadTimeDays,
  readPackagingWeights,
} from './logistics';
import { parseProductImages, type SellerProductImage } from './photos';
import { optionalTrimmed, type SellerProductFormValues } from './product-form';
import { isInternalDraftTitle, sellerProductStatus, sellerRejectionNote, type SellerProductStatus } from './products';
import { parseProductVideos, type SellerProductVideo } from './video';

const FORBIDDEN_EDIT_FIELDS = [
  'farmId',
  'ownerUserId',
  'sourceLocale',
  'moderationStatus',
  'moderationNote',
] as const;

export type EditIssue = DraftIssue | 'publishedIncomplete';

export type EditLoadFailure = 'unauthorized' | 'forbidden' | 'notFound' | 'network' | 'generic';

export type EditPhase =
  | 'session'
  | 'signedOut'
  | 'unverified'
  | 'profileUnavailable'
  | 'loading'
  | 'notFound'
  | 'error'
  | 'form';

/**
 * Seller editor record from GET /products/:id.
 * Text comes from source fields, never from display translations.
 */
export type SellerProductDetail = {
  id: string;
  title: string;
  description: string;
  category: ProductCategory | null;
  variety: string;
  country: string;
  originPlace: string;
  unit: ProductUnit | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  currentStock: number | null;
  monthlyProduction: number | null;
  maxAnnualProduction: number | null;
  priceFrom: number | null;
  priceCurrency: PriceCurrency | null;
  priceNegotiable: boolean;
  priceDependsOnVolume: boolean;
  seasonMonths: number[];
  harvestStartAt: string;
  harvestEndAt: string;
  forecastQuantity: number | null;
  harvestStatus: Availability | null;
  preorderEnabled: boolean;
  packagingTypes: string[];
  packagingWeights: string[];
  palletSize: string;
  deliveryAvailable: boolean;
  incoterms: string[];
  carriers: string[];
  customDelivery: string;
  nearestPort: string;
  leadTimeDays: number | null;
  images: SellerProductImage[];
  videos: SellerProductVideo[];
  certificates: SellerProductCertificate[];
  isPublished: boolean;
  moderationStatus: string;
  moderationNote: string | null;
};

export type UpdateProductBody = {
  title: string;
  description: string;
  category: string | null;
  variety: string | null;
  country: string | null;
  originPlace: string | null;
  unit: string | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  currentStock: number | null;
  monthlyProduction: number | null;
  maxAnnualProduction: number | null;
  priceFrom: number | null;
  priceCurrency: string | null;
  priceNegotiable: boolean;
  priceDependsOnVolume: boolean;
  seasonMonths: number[];
  harvestStartAt: string | null;
  harvestEndAt: string | null;
  forecastQuantity: number | null;
  harvestStatus: string | null;
  preorderEnabled: boolean;
  packagingTypes: string[];
  packagingWeights: string[];
  palletSize: string | null;
  deliveryAvailable: boolean;
  incoterms: string[];
  carriers: string[];
  customDelivery: string | null;
  nearestPort: string | null;
  leadTimeDays: number | null;
  isPublished: boolean;
};

export type EditSubmitResult =
  | { status: 'ignored' }
  | { status: 'invalid'; issue: EditIssue }
  | { status: 'saved'; product: SellerProductDetail }
  | { status: 'failed'; failure: DraftFailure };

type ListingSnapshot = {
  title: string;
  category: string | null;
  unit: string | null;
  priceFrom: number | null;
  priceCurrency: string | null;
};

export function editPhase(input: {
  authStatus: 'loading' | 'anonymous' | 'authenticated';
  user: { emailVerified: boolean } | null;
  profileUnavailable: boolean;
  loadStatus: 'idle' | 'loading' | 'ready' | 'notFound' | 'error';
}): EditPhase {
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
  if (input.loadStatus === 'notFound') {
    return 'notFound';
  }
  if (input.loadStatus === 'error') {
    return 'error';
  }
  if (input.loadStatus !== 'ready') {
    return 'loading';
  }
  return 'form';
}

export function editLoadFailure(error: unknown): EditLoadFailure {
  if (!(error instanceof ApiError)) {
    return 'generic';
  }
  if (error.kind === 'network' || error.kind === 'timeout') {
    return 'network';
  }
  if (error.status === 401) {
    return 'unauthorized';
  }
  if (error.status === 403) {
    return 'forbidden';
  }
  if (error.status === 404) {
    return 'notFound';
  }
  return 'generic';
}

/** Web Save keeps a live approved listing published. Every other save stays unpublished. */
export function editKeepsPublished(product: { isPublished: boolean; moderationStatus: string }): boolean {
  return product.isPublished && product.moderationStatus === 'approved';
}

export function editStatus(product: { isPublished: boolean; moderationStatus: string }): SellerProductStatus {
  return sellerProductStatus(product);
}

export function editRejectionNote(product: SellerProductDetail): string | null {
  return sellerRejectionNote(product);
}

export function priceInputValue(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return '';
  }
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function sellerFormFromDetail(product: SellerProductDetail): SellerProductFormValues {
  return {
    title: product.title,
    description: product.description,
    category: product.category,
    variety: product.variety,
    country: product.country,
    originPlace: product.originPlace,
    unit: product.unit,
    unitTouched: product.unit != null,
    minQuantity: priceInputValue(product.minQuantity),
    maxQuantity: priceInputValue(product.maxQuantity),
    currentStock: priceInputValue(product.currentStock),
    monthlyProduction: priceInputValue(product.monthlyProduction),
    maxAnnualProduction: priceInputValue(product.maxAnnualProduction),
    price: priceInputValue(product.priceFrom),
    currency: product.priceCurrency,
    priceNegotiable: product.priceNegotiable,
    priceDependsOnVolume: product.priceDependsOnVolume,
    seasonMonths: product.seasonMonths,
    harvestStartAt: product.harvestStartAt,
    harvestEndAt: product.harvestEndAt,
    forecastQuantity: priceInputValue(product.forecastQuantity),
    harvestStatus: product.harvestStatus,
    preorderEnabled: product.preorderEnabled,
    packagingTypes: product.packagingTypes,
    packagingWeightsText: product.packagingWeights.join(', '),
    palletSize: product.palletSize,
    deliveryAvailable: product.deliveryAvailable,
    incoterms: product.incoterms,
    carriers: product.carriers,
    customDelivery: product.customDelivery,
    nearestPort: product.nearestPort,
    leadTimeDays: product.leadTimeDays == null ? '' : String(product.leadTimeDays),
  };
}

export function editRequestBody(
  values: SellerProductFormValues,
  loaded: SellerProductDetail,
): UpdateProductBody | null {
  if (editIssue(values, loaded)) {
    return null;
  }
  const price = parseDraftPrice(values.price);
  const forecast = parseDraftPrice(values.forecastQuantity);
  const seasonMonths = parseSeasonMonths(values.seasonMonths);
  const harvestStartAt = parseHarvestDate(values.harvestStartAt);
  const harvestEndAt = parseHarvestDate(values.harvestEndAt);
  const harvestStatus = parseHarvestStatus(values.harvestStatus);
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    category: values.category && isProductCategory(values.category) ? values.category : null,
    variety: optionalTrimmed(values.variety),
    country: optionalTrimmed(values.country),
    originPlace: optionalTrimmed(values.originPlace),
    unit: values.unit && isProductUnit(values.unit) ? values.unit : null,
    minQuantity: quantityOrNull(values.minQuantity),
    maxQuantity: quantityOrNull(values.maxQuantity),
    currentStock: quantityOrNull(values.currentStock),
    monthlyProduction: quantityOrNull(values.monthlyProduction),
    maxAnnualProduction: quantityOrNull(values.maxAnnualProduction),
    priceFrom: typeof price === 'number' ? price : null,
    priceCurrency: values.currency && isPriceCurrency(values.currency) ? values.currency : null,
    priceNegotiable: values.priceNegotiable,
    priceDependsOnVolume: values.priceDependsOnVolume,
    seasonMonths: Array.isArray(seasonMonths) ? seasonMonths : [],
    harvestStartAt: typeof harvestStartAt === 'string' ? harvestStartAt : null,
    harvestEndAt: typeof harvestEndAt === 'string' ? harvestEndAt : null,
    forecastQuantity:
      typeof forecast === 'number' && forecast <= FORECAST_QUANTITY_MAX ? forecast : null,
    harvestStatus: typeof harvestStatus === 'string' ? harvestStatus : null,
    preorderEnabled: values.preorderEnabled,
    ...logisticsEditFields(values),
    isPublished: editKeepsPublished(loaded),
  };
}

export function editIssue(values: SellerProductFormValues, loaded: SellerProductDetail): EditIssue | null {
  const fieldIssue = draftIssue(values.title, values.description, {
    category: values.category,
    variety: values.variety,
    country: values.country,
    originPlace: values.originPlace,
    unit: values.unit,
    minQuantity: values.minQuantity,
    maxQuantity: values.maxQuantity,
    currentStock: values.currentStock,
    monthlyProduction: values.monthlyProduction,
    maxAnnualProduction: values.maxAnnualProduction,
    price: values.price,
    currency: values.currency,
    priceNegotiable: values.priceNegotiable,
    priceDependsOnVolume: values.priceDependsOnVolume,
    seasonMonths: values.seasonMonths,
    harvestStartAt: values.harvestStartAt,
    harvestEndAt: values.harvestEndAt,
    forecastQuantity: values.forecastQuantity,
    harvestStatus: values.harvestStatus,
    preorderEnabled: values.preorderEnabled,
    packagingTypes: values.packagingTypes,
    packagingWeightsText: values.packagingWeightsText,
    palletSize: values.palletSize,
    deliveryAvailable: values.deliveryAvailable,
    incoterms: values.incoterms,
    carriers: values.carriers,
    customDelivery: values.customDelivery,
    nearestPort: values.nearestPort,
    leadTimeDays: values.leadTimeDays,
  });
  if (fieldIssue) {
    return fieldIssue;
  }
  if (!editKeepsPublished(loaded)) {
    return null;
  }
  const nextIssues = listingIssues(listingFromForm(values));
  if (nextIssues.length === 0) {
    return null;
  }
  const previousIssues = new Set(listingIssues(listingFromDetail(loaded)));
  const introduced = nextIssues.filter((issue) => !previousIssues.has(issue));
  return introduced.length > 0 ? 'publishedIncomplete' : null;
}

export function editBodyHasForbiddenField(body: UpdateProductBody): boolean {
  return Object.keys(body).some((field) => (FORBIDDEN_EDIT_FIELDS as readonly string[]).includes(field));
}

export function routeAfterEdit(status: EditSubmitResult['status']): 'MyProducts' | null {
  return status === 'saved' ? 'MyProducts' : null;
}

export type PublishBlock =
  | EditIssue
  | 'title'
  | 'category'
  | 'unit'
  | 'priceFrom'
  | 'priceCurrency'
  | 'photoRequired';

export type PublishFailure = DraftFailure | 'notFound';

export type PublishSubmitResult =
  | { status: 'ignored' }
  | { status: 'invalid'; blocks: PublishBlock[] }
  | { status: 'published'; product: SellerProductDetail }
  | { status: 'failed'; failure: PublishFailure };

/** Pending and already-live listings have no second publish action. */
export function publishActionVisible(product: { isPublished: boolean; moderationStatus: string }): boolean {
  if (product.moderationStatus === 'pending') {
    return false;
  }
  if (product.moderationStatus === 'approved' && product.isPublished) {
    return false;
  }
  return true;
}

/** Rejected listings use the same publish request, labeled as a resubmission. */
export function publishActionKind(product: { moderationStatus: string }): 'publish' | 'resubmit' {
  return product.moderationStatus === 'rejected' ? 'resubmit' : 'publish';
}

export function publishStatusNote(product: {
  isPublished: boolean;
  moderationStatus: string;
}): 'pending' | 'live' | null {
  if (product.moderationStatus === 'pending') {
    return 'pending';
  }
  if (product.moderationStatus === 'approved' && product.isPublished) {
    return 'live';
  }
  return null;
}

/**
 * Local checks Web runs before publish. Format errors come first.
 * A photo is required only for a first publication.
 */
export function publishBlocks(values: SellerProductFormValues, loaded: SellerProductDetail): PublishBlock[] {
  const format = editIssue(values, loaded);
  if (format) {
    return [format];
  }
  const blocks: PublishBlock[] = [...listingIssues(listingFromForm(values))];
  if (!loaded.isPublished && loaded.images.length < 1) {
    blocks.push('photoRequired');
  }
  return blocks;
}

export function publishRequestBody(
  values: SellerProductFormValues,
  loaded: SellerProductDetail,
): UpdateProductBody | null {
  const body = editRequestBody(values, loaded);
  if (!body) {
    return null;
  }
  return { ...body, isPublished: true };
}

/** Publish stays on the editor. My Products reloads when the seller returns. */
export function routeAfterPublish(): null {
  return null;
}

export function publishFailure(error: unknown): PublishFailure {
  if (error instanceof ApiError && error.status === 404) {
    return 'notFound';
  }
  return draftFailure(error);
}

export async function submitProductPublish(options: {
  values: SellerProductFormValues;
  loaded: SellerProductDetail;
  gate: DraftGate;
  update: (body: UpdateProductBody) => Promise<SellerProductDetail>;
  onPending: (pending: boolean) => void;
}): Promise<PublishSubmitResult> {
  if (options.gate.pending || !publishActionVisible(options.loaded)) {
    return { status: 'ignored' };
  }
  const blocks = publishBlocks(options.values, options.loaded);
  if (blocks.length > 0) {
    return { status: 'invalid', blocks };
  }
  const body = publishRequestBody(options.values, options.loaded);
  if (!body || editBodyHasForbiddenField(body)) {
    return { status: 'invalid', blocks: ['titleRequired'] };
  }
  options.gate.pending = true;
  options.onPending(true);
  try {
    const product = await options.update(body);
    return { status: 'published', product };
  } catch (error) {
    return { status: 'failed', failure: publishFailure(error) };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

export async function submitProductEdit(options: {
  values: SellerProductFormValues;
  loaded: SellerProductDetail;
  gate: DraftGate;
  update: (body: UpdateProductBody) => Promise<SellerProductDetail>;
  onPending: (pending: boolean) => void;
}): Promise<EditSubmitResult> {
  if (options.gate.pending) {
    return { status: 'ignored' };
  }
  const issue = editIssue(options.values, options.loaded);
  if (issue) {
    return { status: 'invalid', issue };
  }
  const body = editRequestBody(options.values, options.loaded);
  if (!body) {
    return { status: 'invalid', issue: 'titleRequired' };
  }
  options.gate.pending = true;
  options.onPending(true);
  try {
    const product = await options.update(body);
    return { status: 'saved', product };
  } catch (error) {
    return { status: 'failed', failure: draftFailure(error) };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

export function parseSellerProductDetail(value: unknown): SellerProductDetail | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (row.isOwner !== true) {
    return null;
  }
  const id = readText(row.id);
  const title = readSourceText(row, 'title')?.trim() ?? '';
  const moderationStatus = readText(row.moderationStatus);
  if (!id || title.length < 2 || !moderationStatus) {
    return null;
  }
  if (!['draft', 'pending', 'approved', 'rejected'].includes(moderationStatus)) {
    return null;
  }
  const description = readSourceText(row, 'description')?.trim() ?? '';
  const variety = readSourceText(row, 'variety')?.trim() ?? '';
  const originPlace = readSourceText(row, 'originPlace')?.trim() ?? '';
  const category = readText(row.category);
  const unit = readText(row.unit);
  const currency = readText(row.priceCurrency);
  const note = row.moderationNote;
  return {
    id,
    title,
    description,
    variety,
    country: typeof row.country === 'string' ? row.country.trim() : '',
    originPlace,
    minQuantity: readPrice(row.minQuantity),
    maxQuantity: readPrice(row.maxQuantity),
    currentStock: readPrice(row.currentStock),
    monthlyProduction: readPrice(row.monthlyProduction),
    maxAnnualProduction: readPrice(row.maxAnnualProduction),
    category: category && isProductCategory(category) ? category : null,
    unit: unit && isProductUnit(unit) ? unit : null,
    priceFrom: readPrice(row.priceFrom),
    priceCurrency: currency && isPriceCurrency(currency) ? currency : null,
    priceNegotiable: row.priceNegotiable === true,
    priceDependsOnVolume: row.priceDependsOnVolume === true,
    seasonMonths: readSeasonMonths(row.seasonMonths),
    harvestStartAt: harvestDateInput(row.harvestStartAt),
    harvestEndAt: harvestDateInput(row.harvestEndAt),
    forecastQuantity: readPrice(row.forecastQuantity),
    harvestStatus: readHarvestStatus(row.harvestStatus),
    preorderEnabled: row.preorderEnabled === true,
    packagingTypes: readCodeList(row.packagingTypes, PACKAGING_TYPES),
    packagingWeights: readPackagingWeights(row.packagingWeights),
    palletSize: typeof row.palletSize === 'string' ? row.palletSize : '',
    deliveryAvailable: row.deliveryAvailable === true,
    incoterms: readCodeList(row.incoterms, INCOTERMS),
    carriers: readCodeList(row.carriers, CARRIERS),
    customDelivery: typeof row.customDelivery === 'string' ? row.customDelivery : '',
    nearestPort: typeof row.nearestPort === 'string' ? row.nearestPort : '',
    leadTimeDays: readLeadTimeDays(row.leadTimeDays),
    images: parseProductImages(row.images),
    videos: parseProductVideos(row.videos),
    certificates: parseProductCertificates(row.certificates),
    isPublished: row.isPublished === true,
    moderationStatus,
    moderationNote: typeof note === 'string' ? note : null,
  };
}

function listingFromForm(values: SellerProductFormValues): ListingSnapshot {
  const price = parseDraftPrice(values.price);
  return {
    title: values.title,
    category: values.category,
    unit: values.unit,
    priceFrom: typeof price === 'number' ? price : null,
    priceCurrency: values.currency,
  };
}

function listingFromDetail(product: SellerProductDetail): ListingSnapshot {
  return {
    title: product.title,
    category: product.category,
    unit: product.unit,
    priceFrom: product.priceFrom,
    priceCurrency: product.priceCurrency,
  };
}

type ListingIssue = 'title' | 'category' | 'unit' | 'priceFrom' | 'priceCurrency';

function listingIssues(listing: ListingSnapshot): ListingIssue[] {
  const issues: ListingIssue[] = [];
  const title = listing.title.trim();
  if (title.length < 2 || isInternalDraftTitle(title)) {
    issues.push('title');
  }
  if (!listing.category || !isProductCategory(listing.category)) {
    issues.push('category');
  }
  if (!listing.unit || !isProductUnit(listing.unit)) {
    issues.push('unit');
  }
  if (listing.priceFrom == null || listing.priceFrom <= 0) {
    issues.push('priceFrom');
  }
  if (!listing.priceCurrency || !isPriceCurrency(listing.priceCurrency)) {
    issues.push('priceCurrency');
  }
  return issues;
}

function readSourceText(
  row: Record<string, unknown>,
  key: 'title' | 'description' | 'variety' | 'originPlace',
): string | null {
  const source = row.source;
  if (source && typeof source === 'object') {
    const value = (source as Record<string, unknown>)[key];
    if (typeof value === 'string') {
      return value;
    }
    if (value === null) {
      return null;
    }
  }
  const top = row[key];
  if (typeof top === 'string') {
    return top;
  }
  return null;
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readHarvestStatus(value: unknown): Availability | null {
  return typeof value === 'string' && parseHarvestStatus(value) === value
    ? (value as Availability)
    : null;
}

function quantityOrNull(raw: string): number | null {
  const parsed = parseDraftPrice(raw);
  return typeof parsed === 'number' ? parsed : null;
}

function readPrice(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}
