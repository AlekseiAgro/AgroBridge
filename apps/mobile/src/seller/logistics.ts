/** Mirrors `PACKAGING_TYPES`, `INCOTERMS`, and `CARRIERS` in packages/shared/src/quality.ts. */
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

export const INCOTERMS = ['EXW', 'FOB', 'FCA', 'DAP', 'CIF'] as const;

export type Incoterm = (typeof INCOTERMS)[number];

export const CARRIERS = ['DHL', 'UPS', 'FedEx', 'CDEK', 'other'] as const;

export type Carrier = (typeof CARRIERS)[number];

export const PACKAGING_LIST_MAX = 12;
export const LOGISTICS_LIST_MAX = 10;
export const PALLET_SIZE_MAX = 80;
export const CUSTOM_DELIVERY_MAX = 500;
export const NEAREST_PORT_MAX = 120;
export const LEAD_TIME_DAYS_MAX = 365;

export function isPackagingType(value: string): value is PackagingType {
  return (PACKAGING_TYPES as readonly string[]).includes(value);
}

export function isIncoterm(value: string): value is Incoterm {
  return (INCOTERMS as readonly string[]).includes(value);
}

export function isCarrier(value: string): value is Carrier {
  return (CARRIERS as readonly string[]).includes(value);
}

/** Web splits on commas, trims each token, drops blanks, and keeps the first copy. */
export function parsePackagingWeights(raw: string): string[] | 'invalid' {
  const weights = [
    ...new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  if (weights.length > PACKAGING_LIST_MAX) {
    return 'invalid';
  }
  return weights;
}

export function parseCodeList(
  values: readonly string[],
  allowed: readonly string[],
  max: number,
): string[] | 'invalid' {
  if (values.length > max) {
    return 'invalid';
  }
  const seen = new Set<string>();
  for (const value of values) {
    if (!allowed.includes(value) || seen.has(value)) {
      return 'invalid';
    }
    seen.add(value);
  }
  return [...values];
}

/** Empty after trim is null. Internal spaces and line breaks stay. Over-long text is not truncated. */
export function boundedText(raw: string, max: number): string | null | 'invalid' {
  const text = raw.trim();
  if (!text) {
    return null;
  }
  if (text.length > max) {
    return 'invalid';
  }
  return text;
}

/** Integer days from 0 through 365. Decimals are rejected. Empty is omitted. */
export function parseLeadTimeDays(raw: string): number | null | 'invalid' {
  const text = raw.trim();
  if (!text) {
    return null;
  }
  if (!/^\d+$/.test(text)) {
    return 'invalid';
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value > LEAD_TIME_DAYS_MAX) {
    return 'invalid';
  }
  return value;
}

export function toggleCode(values: readonly string[], value: string, max: number): string[] {
  const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  return next.length > max ? [...values] : next;
}

export function readCodeList(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && allowed.includes(item) && !result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

export function readPackagingWeights(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const text = item.trim();
    if (text && !result.includes(text)) {
      result.push(text);
    }
  }
  return result;
}

export type LogisticsInput = {
  packagingTypes: readonly string[];
  packagingWeightsText: string;
  palletSize: string;
  deliveryAvailable: boolean;
  incoterms: readonly string[];
  carriers: readonly string[];
  customDelivery: string;
  nearestPort: string;
  leadTimeDays: string;
};

export type LogisticsIssue =
  | 'packagingTypesInvalid'
  | 'packagingWeightsInvalid'
  | 'palletTooLong'
  | 'incotermsInvalid'
  | 'carriersInvalid'
  | 'customDeliveryTooLong'
  | 'nearestPortTooLong'
  | 'leadTimeInvalid';

export function logisticsIssue(values: LogisticsInput): LogisticsIssue | null {
  if (parseCodeList(values.packagingTypes, PACKAGING_TYPES, PACKAGING_LIST_MAX) === 'invalid') {
    return 'packagingTypesInvalid';
  }
  if (parsePackagingWeights(values.packagingWeightsText) === 'invalid') {
    return 'packagingWeightsInvalid';
  }
  if (boundedText(values.palletSize, PALLET_SIZE_MAX) === 'invalid') {
    return 'palletTooLong';
  }
  if (!values.deliveryAvailable) {
    return null;
  }
  if (parseCodeList(values.incoterms, INCOTERMS, LOGISTICS_LIST_MAX) === 'invalid') {
    return 'incotermsInvalid';
  }
  if (parseCodeList(values.carriers, CARRIERS, LOGISTICS_LIST_MAX) === 'invalid') {
    return 'carriersInvalid';
  }
  if (boundedText(values.customDelivery, CUSTOM_DELIVERY_MAX) === 'invalid') {
    return 'customDeliveryTooLong';
  }
  if (boundedText(values.nearestPort, NEAREST_PORT_MAX) === 'invalid') {
    return 'nearestPortTooLong';
  }
  if (parseLeadTimeDays(values.leadTimeDays) === 'invalid') {
    return 'leadTimeInvalid';
  }
  return null;
}

export type LogisticsCreateFields = {
  deliveryAvailable: boolean;
  packagingTypes?: string[];
  packagingWeights?: string[];
  palletSize?: string;
  incoterms?: string[];
  carriers?: string[];
  customDelivery?: string;
  nearestPort?: string;
  leadTimeDays?: number;
};

export function logisticsCreateFields(values: LogisticsInput): LogisticsCreateFields {
  const fields: LogisticsCreateFields = { deliveryAvailable: values.deliveryAvailable };
  const packagingTypes = parseCodeList(values.packagingTypes, PACKAGING_TYPES, PACKAGING_LIST_MAX);
  const packagingWeights = parsePackagingWeights(values.packagingWeightsText);
  const palletSize = boundedText(values.palletSize, PALLET_SIZE_MAX);
  if (Array.isArray(packagingTypes) && packagingTypes.length > 0) {
    fields.packagingTypes = packagingTypes;
  }
  if (Array.isArray(packagingWeights) && packagingWeights.length > 0) {
    fields.packagingWeights = packagingWeights;
  }
  if (typeof palletSize === 'string') {
    fields.palletSize = palletSize;
  }
  if (!values.deliveryAvailable) {
    return fields;
  }
  const incoterms = parseCodeList(values.incoterms, INCOTERMS, LOGISTICS_LIST_MAX);
  const carriers = parseCodeList(values.carriers, CARRIERS, LOGISTICS_LIST_MAX);
  const customDelivery = boundedText(values.customDelivery, CUSTOM_DELIVERY_MAX);
  const nearestPort = boundedText(values.nearestPort, NEAREST_PORT_MAX);
  const leadTimeDays = parseLeadTimeDays(values.leadTimeDays);
  if (Array.isArray(incoterms) && incoterms.length > 0) {
    fields.incoterms = incoterms;
  }
  if (Array.isArray(carriers) && carriers.length > 0) {
    fields.carriers = carriers;
  }
  if (typeof customDelivery === 'string') {
    fields.customDelivery = customDelivery;
  }
  if (typeof nearestPort === 'string') {
    fields.nearestPort = nearestPort;
  }
  if (typeof leadTimeDays === 'number') {
    fields.leadTimeDays = leadTimeDays;
  }
  return fields;
}

export type LogisticsEditFields = {
  packagingTypes: string[];
  packagingWeights: string[];
  palletSize: string | null;
  deliveryAvailable: boolean;
  incoterms: string[];
  carriers: string[];
  customDelivery: string | null;
  nearestPort: string | null;
  leadTimeDays: number | null;
};

export function logisticsEditFields(values: LogisticsInput): LogisticsEditFields {
  const packagingTypes = parseCodeList(values.packagingTypes, PACKAGING_TYPES, PACKAGING_LIST_MAX);
  const packagingWeights = parsePackagingWeights(values.packagingWeightsText);
  const palletSize = boundedText(values.palletSize, PALLET_SIZE_MAX);
  const base = {
    packagingTypes: Array.isArray(packagingTypes) ? packagingTypes : [],
    packagingWeights: Array.isArray(packagingWeights) ? packagingWeights : [],
    palletSize: typeof palletSize === 'string' ? palletSize : null,
    deliveryAvailable: values.deliveryAvailable,
  };
  if (!values.deliveryAvailable) {
    return {
      ...base,
      incoterms: [],
      carriers: [],
      customDelivery: null,
      nearestPort: null,
      leadTimeDays: null,
    };
  }
  const incoterms = parseCodeList(values.incoterms, INCOTERMS, LOGISTICS_LIST_MAX);
  const carriers = parseCodeList(values.carriers, CARRIERS, LOGISTICS_LIST_MAX);
  const customDelivery = boundedText(values.customDelivery, CUSTOM_DELIVERY_MAX);
  const nearestPort = boundedText(values.nearestPort, NEAREST_PORT_MAX);
  const leadTimeDays = parseLeadTimeDays(values.leadTimeDays);
  return {
    ...base,
    incoterms: Array.isArray(incoterms) ? incoterms : [],
    carriers: Array.isArray(carriers) ? carriers : [],
    customDelivery: typeof customDelivery === 'string' ? customDelivery : null,
    nearestPort: typeof nearestPort === 'string' ? nearestPort : null,
    leadTimeDays: typeof leadTimeDays === 'number' ? leadTimeDays : null,
  };
}

export function readLeadTimeDays(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > LEAD_TIME_DAYS_MAX) {
    return null;
  }
  return parsed;
}
