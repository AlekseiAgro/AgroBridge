export type CatalogImage = {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type CatalogFarm = {
  id: string;
  name: string;
  region: string | null;
  verified: boolean;
  producerType?: 'individual' | 'family' | 'cooperative' | 'company' | 'other' | null;
  ownershipType?: string | null;
};

export type CatalogParty = {
  id: string;
  displayName: string | null;
};

/** Public product fields used by the mobile catalog. Matches GET /products. */
export type CatalogProduct = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  variety: string | null;
  country: string | null;
  originPlace: string | null;
  unit: string | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  currentStock?: number | null;
  seasonMonths?: number[];
  packagingTypes?: string[];
  packagingWeights?: string[];
  palletSize?: string | null;
  incoterms?: string[];
  carriers?: string[];
  customDelivery?: string | null;
  nearestPort?: string | null;
  deliveryAvailable?: boolean;
  leadTimeDays?: number | null;
  priceNegotiable?: boolean;
  priceDependsOnVolume?: boolean;
  harvestStatus: string | null;
  priceFrom: number | null;
  priceCurrency: string | null;
  sellerRating?: { average: number | null; count: number } | null;
  images: CatalogImage[];
  updatedAt: string | null;
  owner: CatalogParty;
  farm: CatalogFarm | null;
  /** Original title when it differs from the locale shown in `title`. */
  sourceTitle: string | null;
  source: CatalogText | null;
};

export type CatalogText = {
  locale: string | null;
  title: string | null;
  description: string | null;
  variety: string | null;
  originPlace: string | null;
  packaging: string | null;
  destinationCountry: string | null;
  message: string | null;
};

export type CatalogFarmProfile = {
  id: string;
  name: string;
  region: string | null;
  verified: boolean;
  description: string | null;
  history: string | null;
  ownershipType: string | null;
  producerType: 'individual' | 'family' | 'cooperative' | 'company' | 'other' | null;
  exportMarkets: string[];
  foundedYear: number | null;
  farmSizeHectares: number | null;
  companyRegistryName: string | null;
  owner: CatalogParty;
  source: {
    locale: string | null;
    description: string | null;
    history: string | null;
    ownershipType: string | null;
    exportMarkets: string[];
  };
  display: {
    locale: string | null;
    description: string | null;
    history: string | null;
    ownershipType: string | null;
    exportMarkets: string[];
  };
  products: CatalogProduct[];
};

/** Public purchase-request fields. Matches GET /purchase-requests. */
export type CatalogRequest = {
  id: string;
  title: string;
  category: string;
  quantity: string;
  unit: string | null;
  variety: string | null;
  packaging: string | null;
  destinationCountry: string | null;
  message: string | null;
  status: string;
  createdAt: string | null;
  buyer: CatalogParty;
  /** Original title when it differs from the locale shown in `title`. */
  sourceTitle: string | null;
  source: CatalogText | null;
};

/** Enabled catalog category from GET /categories. */
export type CatalogCategory = {
  id: string;
  enabled: boolean;
  sortOrder: number;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GEL: '₾',
};

function readProducerType(
  value: unknown,
): CatalogFarmProfile['producerType'] {
  return value === 'individual' ||
    value === 'family' ||
    value === 'cooperative' ||
    value === 'company' ||
    value === 'other'
    ? value
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function localizedField(row: Record<string, unknown>, field: string): string | null {
  const display = readRecord(row.display);
  return readString(display?.[field]) ?? readString(row[field]);
}

function sourceTitleOf(row: Record<string, unknown>, shownTitle: string): string | null {
  const source = readRecord(row.source);
  const original = readString(source?.title) ?? readString(row.title);
  return original && original !== shownTitle ? original : null;
}

function readText(row: Record<string, unknown>): CatalogText {
  const source = readRecord(row.source);
  return {
    locale: readString(source?.locale),
    title: readString(source?.title) ?? readString(row.title),
    description: readString(source?.description) ?? readString(row.description),
    variety: readString(source?.variety) ?? readString(row.variety),
    originPlace: readString(source?.originPlace) ?? readString(row.originPlace),
    packaging: readString(source?.packaging) ?? readString(row.packaging),
    destinationCountry: readString(source?.destinationCountry) ?? readString(row.destinationCountry),
    message: readString(source?.message) ?? readString(row.message),
  };
}

function readNumberList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const number = readNumber(item);
    return number == null ? [] : [number];
  });
}

function readSellerRating(value: unknown): { average: number | null; count: number } | null {
  const row = readRecord(value);
  if (!row) {
    return null;
  }
  return {
    average: readNumber(row.average),
    count: readNumber(row.count) ?? 0,
  };
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const text = readString(item);
    return text ? [text] : [];
  });
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readParty(value: unknown): CatalogParty {
  if (!value || typeof value !== 'object') {
    return { id: '', displayName: null };
  }
  const party = value as Record<string, unknown>;
  return {
    id: readString(party.id) ?? '',
    displayName: readString(party.displayName),
  };
}

function isCategoryMediaUrl(url: string): boolean {
  return url.includes('/images/categories/');
}

function readImages(value: unknown): CatalogImage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const images: CatalogImage[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const image = item as Record<string, unknown>;
    const url = readString(image.url);
    if (!url || isCategoryMediaUrl(url)) {
      continue;
    }
    images.push({
      id: readString(image.id) ?? url,
      url,
      isPrimary: image.isPrimary === true,
      sortOrder: readNumber(image.sortOrder) ?? 0,
    });
  }
  return images;
}

function readFarm(value: unknown): CatalogFarm | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const farm = value as Record<string, unknown>;
  const id = readString(farm.id);
  const name = readString(farm.name);
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    region: readString(farm.region),
    verified: farm.verified === true,
    producerType: readProducerType(farm.producerType),
    ownershipType: readString(farm.ownershipType),
  };
}

export function parseCatalogProduct(value: unknown): CatalogProduct | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const sourceRecord = readRecord(row.source);
  const id = readString(row.id);
  const title = localizedField(row, 'title');
  if (!id || !title) {
    return null;
  }
  return {
    id,
    title,
    description: localizedField(row, 'description'),
    category: readString(row.category),
    variety: readString(sourceRecord?.variety) ?? readString(row.variety),
    currentStock: readNumber(row.currentStock),
    seasonMonths: readNumberList(row.seasonMonths),
    packagingTypes: readStringList(row.packagingTypes),
    packagingWeights: readStringList(row.packagingWeights),
    palletSize: readString(row.palletSize),
    incoterms: readStringList(row.incoterms),
    carriers: readStringList(row.carriers),
    customDelivery: readString(row.customDelivery),
    nearestPort: readString(row.nearestPort),
    deliveryAvailable: row.deliveryAvailable === true,
    leadTimeDays: readNumber(row.leadTimeDays),
    priceNegotiable: row.priceNegotiable === true,
    priceDependsOnVolume: row.priceDependsOnVolume === true,
    sellerRating: readSellerRating(row.sellerRating),
    country: readString(row.country),
    originPlace: localizedField(row, 'originPlace'),
    unit: readString(row.unit),
    minQuantity: readNumber(row.minQuantity),
    maxQuantity: readNumber(row.maxQuantity),
    harvestStatus: readString(row.harvestStatus),
    priceFrom: readNumber(row.priceFrom),
    priceCurrency: readString(row.priceCurrency),
    images: readImages(row.images),
    updatedAt: readString(row.updatedAt),
    owner: readParty(row.owner),
    farm: readFarm(row.farm),
    sourceTitle: sourceTitleOf(row, title),
    source: readText(row),
  };
}

export function parseCatalogProducts(value: unknown): CatalogProduct[] {
  if (!Array.isArray(value)) {
    throw new Error('Products response was not a list.');
  }
  return value.flatMap((item) => {
    const product = parseCatalogProduct(item);
    return product ? [product] : [];
  });
}

export function parseCatalogRequest(value: unknown): CatalogRequest | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = readString(row.id);
  const title = localizedField(row, 'title');
  const category = readString(row.category);
  const quantity = readString(row.quantity);
  if (!id || !title || !category || !quantity) {
    return null;
  }
  return {
    id,
    title,
    category,
    quantity,
    unit: readString(row.unit),
    variety: localizedField(row, 'variety'),
    packaging: localizedField(row, 'packaging'),
    destinationCountry: localizedField(row, 'destinationCountry'),
    message: localizedField(row, 'message'),
    status: readString(row.status) ?? 'open',
    createdAt: readString(row.createdAt),
    buyer: readParty(row.buyer),
    sourceTitle: sourceTitleOf(row, title),
    source: readText(row),
  };
}

export function parseFarmProfile(value: unknown): CatalogFarmProfile | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = readString(row.id);
  const name = readString(row.name);
  if (!id || !name) {
    return null;
  }
  const source = readRecord(row.source);
  const display = readRecord(row.display);
  const sourceMarkets = readStringList(source?.exportMarkets ?? row.exportMarkets);
  const displayMarkets = readStringList(display?.exportMarkets);
  return {
    id,
    name,
    region: readString(row.region),
    verified: row.verified === true,
    description: readString(display?.description) ?? readString(row.description),
    history: readString(display?.history) ?? readString(row.history),
    ownershipType: readString(source?.ownershipType) ?? readString(row.ownershipType),
    producerType: readProducerType(row.producerType),
    exportMarkets: displayMarkets.length > 0 ? displayMarkets : readStringList(row.exportMarkets),
    foundedYear: readNumber(row.foundedYear),
    farmSizeHectares: readNumber(row.farmSizeHectares),
    companyRegistryName: readString(row.companyRegistryName),
    owner: readParty(row.owner),
    source: {
      locale: readString(source?.locale),
      description: readString(source?.description) ?? readString(row.description),
      history: readString(source?.history) ?? readString(row.history),
      ownershipType: readString(source?.ownershipType) ?? readString(row.ownershipType),
      exportMarkets: sourceMarkets,
    },
    display: {
      locale: readString(display?.locale),
      description: readString(display?.description) ?? readString(row.description),
      history: readString(display?.history) ?? readString(row.history),
      ownershipType: readString(display?.ownershipType) ?? readString(row.ownershipType),
      exportMarkets: displayMarkets.length > 0 ? displayMarkets : sourceMarkets,
    },
    products: Array.isArray(row.products) ? parseCatalogProducts(row.products) : [],
  };
}

export function parseCatalogRequests(value: unknown): CatalogRequest[] {
  if (!Array.isArray(value)) {
    throw new Error('Purchase requests response was not a list.');
  }
  return value.flatMap((item) => {
    const request = parseCatalogRequest(item);
    return request ? [request] : [];
  });
}

export function parseCatalogCategories(value: unknown): CatalogCategory[] {
  if (!Array.isArray(value)) {
    throw new Error('Categories response was not a list.');
  }
  const categories: CatalogCategory[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const id = readString(row.id);
    if (!id || row.enabled === false) {
      continue;
    }
    categories.push({
      id,
      enabled: true,
      sortOrder: readNumber(row.sortOrder) ?? 0,
    });
  }
  return categories.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function primaryProductImageUrl(images: CatalogImage[]): string | null {
  if (images.length === 0) {
    return null;
  }
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  return (sorted.find((image) => image.isPrimary) ?? sorted[0])?.url ?? null;
}

export function formatListedPrice(
  amount: number | null,
  currency: string | null,
  unit: string | null,
): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0 || !currency) {
    return null;
  }
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const price = `${symbol} ${amount.toFixed(2)}`;
  return unit ? `${price} / ${unit}` : price;
}

function formatQuantityValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatQuantityRange(
  min: number | null,
  max: number | null,
  unit: string | null,
): string | null {
  if (min == null && max == null) {
    return null;
  }
  const unitSuffix = unit ? ` ${unit}` : '';
  if (min != null && max != null && min !== max) {
    return `${formatQuantityValue(min)}–${formatQuantityValue(max)}${unitSuffix}`;
  }
  const value = min ?? max;
  if (value == null) {
    return null;
  }
  return `${formatQuantityValue(value)}${unitSuffix}`;
}
