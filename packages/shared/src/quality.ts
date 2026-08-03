import type { ProductCategory } from './catalog';

/** Recommended photo kinds for a strong listing. */
export const PRODUCT_IMAGE_KINDS = [
  'overview',
  'closeup',
  'packaging',
  'harvest',
  'field',
  'other',
] as const;
export type ProductImageKind = (typeof PRODUCT_IMAGE_KINDS)[number];

export function isProductImageKind(value: string): value is ProductImageKind {
  return (PRODUCT_IMAGE_KINDS as readonly string[]).includes(value);
}

export const PRODUCT_VIDEO_MAX_COUNT = 1;
export const PRODUCT_VIDEO_MAX_BYTES = 80 * 1024 * 1024;
export const PRODUCT_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export type ProductVideoMimeType = (typeof PRODUCT_VIDEO_MIME_TYPES)[number];

export function isProductVideoMimeType(value: string): value is ProductVideoMimeType {
  return (PRODUCT_VIDEO_MIME_TYPES as readonly string[]).includes(value);
}

export const CERTIFICATE_TYPES = [
  'globalGap',
  'organic',
  'haccp',
  'iso',
  'grasp',
  'other',
] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export function isCertificateType(value: string): value is CertificateType {
  return (CERTIFICATE_TYPES as readonly string[]).includes(value);
}

export const INCOTERMS = ['EXW', 'FOB', 'FCA', 'DAP', 'CIF'] as const;
export type Incoterm = (typeof INCOTERMS)[number];

export function isIncoterm(value: string): value is Incoterm {
  return (INCOTERMS as readonly string[]).includes(value);
}

export const CARRIERS = ['DHL', 'UPS', 'FedEx', 'CDEK', 'other'] as const;
export type Carrier = (typeof CARRIERS)[number];

export function isCarrier(value: string): value is Carrier {
  return (CARRIERS as readonly string[]).includes(value);
}

export const PACKAGING_TYPES = [
  'carton',
  'woodenBox',
  'plasticCrate',
  'pallet',
  'bag',
  'bulk',
  'other',
] as const;
export type PackagingType = (typeof PACKAGING_TYPES)[number];

export function isPackagingType(value: string): value is PackagingType {
  return (PACKAGING_TYPES as readonly string[]).includes(value);
}

export const PRICE_CURRENCIES = ['EUR', 'USD', 'GEL'] as const;
export type PriceCurrency = (typeof PRICE_CURRENCIES)[number];

export function isPriceCurrency(value: string): value is PriceCurrency {
  return (PRICE_CURRENCIES as readonly string[]).includes(value);
}

export type AttributeFieldType = 'text' | 'number' | 'boolean' | 'select';

export type CategoryAttributeField = {
  key: string;
  type: AttributeFieldType;
  options?: string[];
};

/** Dynamic product characteristics by category. */
export const CATEGORY_ATTRIBUTE_FIELDS: Record<ProductCategory, CategoryAttributeField[]> = {
  fruits: [
    { key: 'color', type: 'text' },
    { key: 'berrySize', type: 'select', options: ['small', 'medium', 'large'] },
    { key: 'brix', type: 'number' },
    { key: 'seedless', type: 'boolean' },
    { key: 'organic', type: 'boolean' },
    { key: 'fresh', type: 'boolean' },
  ],
  berries: [
    { key: 'color', type: 'text' },
    { key: 'berrySize', type: 'select', options: ['small', 'medium', 'large'] },
    { key: 'brix', type: 'number' },
    { key: 'organic', type: 'boolean' },
    { key: 'fresh', type: 'boolean' },
  ],
  vegetables: [
    { key: 'varietyDetail', type: 'text' },
    { key: 'caliber', type: 'text' },
    { key: 'organic', type: 'boolean' },
    { key: 'fresh', type: 'boolean' },
  ],
  nuts: [
    { key: 'grade', type: 'text' },
    { key: 'shelled', type: 'boolean' },
    { key: 'organic', type: 'boolean' },
    { key: 'moisturePercent', type: 'number' },
  ],
  wine: [
    { key: 'grapeVariety', type: 'text' },
    { key: 'vintageYear', type: 'number' },
    { key: 'alcoholPercent', type: 'number' },
    { key: 'color', type: 'select', options: ['white', 'red', 'rose', 'orange'] },
    { key: 'organic', type: 'boolean' },
  ],
  dairy: [
    { key: 'fatPercent', type: 'number' },
    { key: 'pasteurized', type: 'boolean' },
    { key: 'organic', type: 'boolean' },
  ],
  honey: [
    { key: 'floralSource', type: 'text' },
    { key: 'moisturePercent', type: 'number' },
    { key: 'crystallized', type: 'boolean' },
    { key: 'organic', type: 'boolean' },
    { key: 'raw', type: 'boolean' },
  ],
  mineralWater: [
    { key: 'mineralization', type: 'text' },
    { key: 'sparkling', type: 'boolean' },
    { key: 'sourceName', type: 'text' },
  ],
  spices: [
    { key: 'form', type: 'select', options: ['whole', 'ground', 'flakes'] },
    { key: 'organic', type: 'boolean' },
    { key: 'dried', type: 'boolean' },
  ],
  tea: [
    { key: 'leafGrade', type: 'text' },
    { key: 'organic', type: 'boolean' },
    { key: 'fermented', type: 'boolean' },
  ],
  bayLeaf: [
    { key: 'leafSize', type: 'select', options: ['small', 'medium', 'large'] },
    { key: 'dried', type: 'boolean' },
    { key: 'organic', type: 'boolean' },
  ],
  essentialOils: [
    { key: 'purityPercent', type: 'number' },
    { key: 'extractionMethod', type: 'text' },
    { key: 'organic', type: 'boolean' },
  ],
  organic: [
    { key: 'organic', type: 'boolean' },
    { key: 'fresh', type: 'boolean' },
    { key: 'varietyDetail', type: 'text' },
  ],
  other: [
    { key: 'organic', type: 'boolean' },
    { key: 'fresh', type: 'boolean' },
    { key: 'varietyDetail', type: 'text' },
  ],
};

export function attributeFieldsForCategory(
  category: string | null | undefined,
): CategoryAttributeField[] {
  if (!category || !(category in CATEGORY_ATTRIBUTE_FIELDS)) {
    return CATEGORY_ATTRIBUTE_FIELDS.other;
  }
  return CATEGORY_ATTRIBUTE_FIELDS[category as ProductCategory];
}

export type ProductVideo = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  durationSeconds: number | null;
  createdAt: string;
};

export type ProductCertificate = {
  id: string;
  type: CertificateType;
  title: string;
  fileName: string;
  url: string;
  mimeType: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewNote: string | null;
  createdAt: string;
};

export type ProductQualityChecklistItem = {
  id: string;
  weight: number;
  earned: number;
  done: boolean;
};

export type ProductQualityScore = {
  /** 0–100 listing quality / trust readiness score. */
  score: number;
  tier: 'low' | 'fair' | 'good' | 'excellent';
  checklist: ProductQualityChecklistItem[];
  suggestions: string[];
};

export type QualityScoreInput = {
  title?: string | null;
  category?: string | null;
  variety?: string | null;
  country?: string | null;
  region?: string | null;
  originPlace?: string | null;
  description?: string | null;
  imageCount: number;
  imageKinds: string[];
  videoCount: number;
  hasSeasonality: boolean;
  currentStock?: number | null;
  monthlyProduction?: number | null;
  maxAnnualProduction?: number | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  attributes: Record<string, unknown>;
  packagingTypes: string[];
  packagingWeights: string[];
  certificateCount: number;
  approvedCertificateCount: number;
  incoterms: string[];
  carriers: string[];
  nearestPort?: string | null;
  leadTimeDays?: number | null;
  priceFrom?: number | null;
  priceNegotiable?: boolean | null;
  priceDependsOnVolume?: boolean | null;
  farmFoundedYear?: number | null;
  farmSizeHectares?: number | null;
  farmHistory?: string | null;
  farmExportMarkets?: string[];
};

function tierFor(score: number): ProductQualityScore['tier'] {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 45) return 'fair';
  return 'low';
}

function filled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

/** Computes a listing quality / trust readiness score (not a lab quality grade). */
export function computeProductQualityScore(input: QualityScoreInput): ProductQualityScore {
  const attrFields = attributeFieldsForCategory(input.category);
  const filledAttrs = attrFields.filter((field) => filled(input.attributes[field.key])).length;
  const attrRatio = attrFields.length === 0 ? 1 : filledAttrs / attrFields.length;

  const recommendedKinds = ['overview', 'closeup', 'packaging', 'harvest', 'field'];
  const kindHits = recommendedKinds.filter((kind) => input.imageKinds.includes(kind)).length;

  const items: Array<ProductQualityChecklistItem & { suggestion?: string }> = [
    {
      id: 'basics',
      weight: 18,
      done:
        filled(input.title) &&
        filled(input.category) &&
        filled(input.variety) &&
        filled(input.country) &&
        (filled(input.region) || filled(input.originPlace)) &&
        filled(input.description),
      earned: 0,
      suggestion: 'basics',
    },
    {
      id: 'photos',
      weight: 18,
      done: input.imageCount >= 5 && kindHits >= 3,
      earned: 0,
      suggestion: 'photos',
    },
    {
      id: 'video',
      weight: 10,
      done: input.videoCount >= 1,
      earned: 0,
      suggestion: 'video',
    },
    {
      id: 'seasonality',
      weight: 6,
      done: input.hasSeasonality,
      earned: 0,
      suggestion: 'seasonality',
    },
    {
      id: 'volume',
      weight: 12,
      done:
        filled(input.currentStock) &&
        filled(input.monthlyProduction) &&
        filled(input.maxAnnualProduction) &&
        filled(input.minQuantity) &&
        filled(input.maxQuantity),
      earned: 0,
      suggestion: 'volume',
    },
    {
      id: 'attributes',
      weight: 10,
      done: attrRatio >= 0.6,
      earned: 0,
      suggestion: 'attributes',
    },
    {
      id: 'packaging',
      weight: 6,
      done: input.packagingTypes.length > 0 && input.packagingWeights.length > 0,
      earned: 0,
      suggestion: 'packaging',
    },
    {
      id: 'certificates',
      weight: 10,
      done: input.certificateCount > 0,
      earned: 0,
      suggestion: 'certificates',
    },
    {
      id: 'logistics',
      weight: 5,
      done:
        input.incoterms.length > 0 &&
        (input.carriers.length > 0 || filled(input.nearestPort)) &&
        filled(input.leadTimeDays),
      earned: 0,
      suggestion: 'logistics',
    },
    {
      id: 'pricing',
      weight: 5,
      done:
        filled(input.priceFrom) ||
        input.priceNegotiable === true ||
        input.priceDependsOnVolume === true,
      earned: 0,
      suggestion: 'pricing',
    },
    {
      id: 'farmStory',
      weight: 5,
      done:
        filled(input.farmFoundedYear) ||
        filled(input.farmSizeHectares) ||
        filled(input.farmHistory) ||
        (input.farmExportMarkets?.length ?? 0) > 0,
      earned: 0,
      suggestion: 'farmStory',
    },
  ];

  for (const item of items) {
    if (item.id === 'photos') {
      const countPart = Math.min(1, input.imageCount / 5) * 0.7;
      const kindPart = (kindHits / recommendedKinds.length) * 0.3;
      item.earned = Math.round(item.weight * (countPart + kindPart));
      item.done = item.earned >= item.weight * 0.8;
    } else if (item.id === 'attributes') {
      item.earned = Math.round(item.weight * attrRatio);
    } else if (item.id === 'certificates' && input.approvedCertificateCount > 0) {
      item.earned = item.weight;
      item.done = true;
    } else {
      item.earned = item.done ? item.weight : 0;
    }
  }

  const score = Math.min(
    100,
    items.reduce((sum, item) => sum + item.earned, 0),
  );

  return {
    score,
    tier: tierFor(score),
    checklist: items.map(({ id, weight, earned, done }) => ({ id, weight, earned, done })),
    suggestions: items.filter((item) => !item.done).map((item) => item.suggestion!),
  };
}
