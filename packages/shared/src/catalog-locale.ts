import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from './locales';

/** Locales stored on catalog translations. Same set as the product UI. */
export const CATALOG_LOCALES = LOCALES;

const LATIN_CATALOG_LOCALES = new Set<Locale>(['en', 'de', 'fr', 'it', 'es']);

export type CatalogTranslationStatus = 'source' | 'pending' | 'completed' | 'failed';

export type CatalogSourceText = {
  locale: Locale;
  title: string;
  description: string | null;
  variety: string | null;
  originPlace: string | null;
};

export type CatalogDisplayText = CatalogSourceText & {
  translationStatus: CatalogTranslationStatus;
};

export type PurchaseRequestSourceText = {
  locale: Locale;
  title: string;
  variety: string | null;
  packaging: string | null;
  destinationCountry: string | null;
  message: string | null;
};

export type PurchaseRequestDisplayText = PurchaseRequestSourceText & {
  translationStatus: CatalogTranslationStatus;
};

export type CatalogTranslationRow = {
  locale: string;
  status: string;
  title?: string | null;
  description?: string | null;
  variety?: string | null;
  originPlace?: string | null;
  packaging?: string | null;
  destinationCountry?: string | null;
  message?: string | null;
};

/**
 * Shared catalog search key.
 * Trim, collapse whitespace, Unicode NFC, lowercase, and fold ё/е.
 */
export function normalizeCatalogSearchText(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase().replace(/ё/g, 'е');
}

/** True when the query matches any stored or translated field. Empty queries match everything. */
export function catalogTextMatches(
  query: string,
  parts: readonly (string | null | undefined)[],
): boolean {
  const needle = normalizeCatalogSearchText(query);
  if (!needle) {
    return true;
  }
  return parts.some((part) => {
    if (!part) {
      return false;
    }
    return normalizeCatalogSearchText(part).includes(needle);
  });
}

export function completedTranslationSearchParts(
  translations: readonly CatalogTranslationRow[] | null | undefined,
): string[] {
  if (!translations) {
    return [];
  }
  const parts: string[] = [];
  for (const row of translations) {
    if (row.status !== 'completed') {
      continue;
    }
    for (const value of [
      row.title,
      row.description,
      row.variety,
      row.originPlace,
      row.packaging,
      row.destinationCountry,
      row.message,
    ]) {
      if (value && value.trim()) {
        parts.push(value);
      }
    }
  }
  return parts;
}

/**
 * Source language of a new listing.
 * Georgian script wins, then Cyrillic. Latin text uses the owner's locale when
 * that locale is itself a Latin catalog language, otherwise English.
 */
export function detectCatalogSourceLocale(
  text: string,
  ownerLocale: string | null | undefined,
): Locale {
  const sample = text.normalize('NFC');
  if (/[\u10A0-\u10FF]/.test(sample)) {
    return 'ka';
  }
  if (/[\u0400-\u04FF]/.test(sample)) {
    return 'ru';
  }
  if (ownerLocale && isLocale(ownerLocale) && LATIN_CATALOG_LOCALES.has(ownerLocale)) {
    return ownerLocale;
  }
  return DEFAULT_LOCALE;
}

/** Explicit query locale, then the signed-in user's locale, then English. */
export function resolveCatalogLocale(
  requested: string | null | undefined,
  viewerLocale: string | null | undefined,
): Locale {
  if (requested && isLocale(requested)) {
    return requested;
  }
  if (viewerLocale && isLocale(viewerLocale)) {
    return viewerLocale;
  }
  return DEFAULT_LOCALE;
}

function asLocale(value: string | null | undefined, fallbackText: string): Locale {
  if (value && isLocale(value)) {
    return value;
  }
  return detectCatalogSourceLocale(fallbackText, DEFAULT_LOCALE);
}

function textOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  return value;
}

function fallbackField(translated: string | null | undefined, source: string | null): string | null {
  const value = translated?.trim();
  return value ? translated!.trim() : source;
}

export function presentCatalogText(
  product: {
    sourceLocale?: string | null;
    title: string;
    description?: string | null;
    variety?: string | null;
    originPlace?: string | null;
    translations?: readonly CatalogTranslationRow[] | null;
  },
  locale: Locale,
): { source: CatalogSourceText; display: CatalogDisplayText } {
  const description = textOrNull(product.description);
  const variety = textOrNull(product.variety);
  const originPlace = textOrNull(product.originPlace);
  const sourceLocale = asLocale(
    product.sourceLocale,
    [product.title, description, variety, originPlace].filter(Boolean).join('\n'),
  );
  const source: CatalogSourceText = {
    locale: sourceLocale,
    title: product.title,
    description,
    variety,
    originPlace,
  };
  if (locale === sourceLocale) {
    return {
      source,
      display: { ...source, translationStatus: 'source' },
    };
  }
  const row = product.translations?.find((item) => item.locale === locale);
  if (row?.status === 'completed' && row.title?.trim()) {
    return {
      source,
      display: {
        locale,
        title: row.title.trim(),
        description: fallbackField(row.description, description),
        variety: fallbackField(row.variety, variety),
        originPlace: fallbackField(row.originPlace, originPlace),
        translationStatus: 'completed',
      },
    };
  }
  const status: CatalogTranslationStatus = row?.status === 'failed' ? 'failed' : 'pending';
  return {
    source,
    display: {
      ...source,
      locale,
      translationStatus: status,
    },
  };
}

export function presentPurchaseRequestText(
  request: {
    sourceLocale?: string | null;
    title: string;
    variety?: string | null;
    packaging?: string | null;
    destinationCountry?: string | null;
    message?: string | null;
    translations?: readonly CatalogTranslationRow[] | null;
  },
  locale: Locale,
): { source: PurchaseRequestSourceText; display: PurchaseRequestDisplayText } {
  const variety = textOrNull(request.variety);
  const packaging = textOrNull(request.packaging);
  const destinationCountry = textOrNull(request.destinationCountry);
  const message = textOrNull(request.message);
  const sourceLocale = asLocale(
    request.sourceLocale,
    [request.title, variety, packaging, destinationCountry, message].filter(Boolean).join('\n'),
  );
  const source: PurchaseRequestSourceText = {
    locale: sourceLocale,
    title: request.title,
    variety,
    packaging,
    destinationCountry,
    message,
  };
  if (locale === sourceLocale) {
    return {
      source,
      display: { ...source, translationStatus: 'source' },
    };
  }
  const row = request.translations?.find((item) => item.locale === locale);
  if (row?.status === 'completed' && row.title?.trim()) {
    return {
      source,
      display: {
        locale,
        title: row.title.trim(),
        variety: fallbackField(row.variety, variety),
        packaging: fallbackField(row.packaging, packaging),
        destinationCountry: fallbackField(row.destinationCountry, destinationCountry),
        message: fallbackField(row.message, message),
        translationStatus: 'completed',
      },
    };
  }
  const status: CatalogTranslationStatus = row?.status === 'failed' ? 'failed' : 'pending';
  return {
    source,
    display: {
      ...source,
      locale,
      translationStatus: status,
    },
  };
}
