import { DEFAULT_LOCALE, LOCALES, type Locale } from '@agrobridge/shared';
import { PRODUCTION_WEB_ORIGIN } from './seo-robots';

/** Public indexable path suffixes after `/{locale}`. Home is the empty suffix. */
export const STATIC_PUBLIC_PATHS = [
  '',
  '/catalog',
  '/requests',
  '/buyers',
  '/sellers',
  '/how-it-works',
  '/support',
  '/legal',
  '/terms',
  '/privacy',
] as const;

export type SitemapUrlEntry = {
  url: string;
  lastModified?: Date;
  alternates: {
    languages: Record<string, string>;
  };
};

export type SitemapEntity = {
  id: string;
  updatedAt?: string | null;
};

export type SitemapFarm = SitemapEntity & {
  description?: string | null;
  productCount?: number | null;
};

export type PublicSitemapRecords = {
  products: SitemapEntity[];
  farms: SitemapFarm[];
  requests: SitemapEntity[];
};

const PUBLIC_RECORD_ID = /^[a-zA-Z0-9_-]{8,128}$/;

export function isPublicRecordId(value: string): boolean {
  return PUBLIC_RECORD_ID.test(value);
}

export function localizedPublicUrl(locale: Locale, path = ''): string {
  const suffix = path === '' || path.startsWith('/') ? path : `/${path}`;
  return `${PRODUCTION_WEB_ORIGIN}/${locale}${suffix}`;
}

export function languageAlternates(path = ''): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[locale] = localizedPublicUrl(locale, path);
  }
  languages['x-default'] = localizedPublicUrl(DEFAULT_LOCALE, path);
  return languages;
}

const EMPTY_RECORDS: PublicSitemapRecords = { products: [], farms: [], requests: [] };

/** A farm is a sitemap landing page only when it has public prose or a public product. */
export function isSitemapFarm(farm: {
  description?: string | null;
  productCount?: number | null;
}): boolean {
  const description = typeof farm.description === 'string' ? farm.description.trim() : '';
  const productCount =
    typeof farm.productCount === 'number' && Number.isFinite(farm.productCount)
      ? farm.productCount
      : 0;
  return description !== '' || productCount > 0;
}

/** Parse an entity timestamp. Invalid values are omitted instead of replaced with now. */
export function sitemapLastModified(updatedAt: string | null | undefined): Date | undefined {
  if (typeof updatedAt !== 'string' || updatedAt.trim() === '') return undefined;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function readId(item: object): string {
  if (!('id' in item) || typeof item.id !== 'string') return '';
  return item.id.trim();
}

function readUpdatedAt(item: object): string | undefined {
  if (!('updatedAt' in item) || typeof item.updatedAt !== 'string') return undefined;
  return item.updatedAt;
}

function entitiesFromUnknown(value: unknown): SitemapEntity[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const records: SitemapEntity[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const id = readId(item);
    if (!isPublicRecordId(id) || seen.has(id)) continue;
    if ('status' in item && item.status !== undefined && item.status !== 'open') continue;
    seen.add(id);
    records.push({ id, updatedAt: readUpdatedAt(item) });
  }
  return records;
}

function farmsFromUnknown(value: unknown): SitemapFarm[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const records: SitemapFarm[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const id = readId(item);
    if (!isPublicRecordId(id) || seen.has(id)) continue;
    const description = 'description' in item && typeof item.description === 'string' ? item.description : '';
    const productCount =
      'productCount' in item && typeof item.productCount === 'number' ? item.productCount : 0;
    if (!isSitemapFarm({ description, productCount })) continue;
    seen.add(id);
    records.push({
      id,
      updatedAt: readUpdatedAt(item),
      description,
      productCount,
    });
  }
  return records;
}

export async function loadPublicSitemapRecordIds(
  fetchJson: (path: string) => Promise<unknown>,
): Promise<PublicSitemapRecords> {
  const [products, farms, requests] = await Promise.all([
    fetchJson('/products').catch(() => []),
    fetchJson('/farms').catch(() => []),
    fetchJson('/purchase-requests').catch(() => []),
  ]);

  try {
    return {
      products: entitiesFromUnknown(products),
      farms: farmsFromUnknown(farms),
      requests: entitiesFromUnknown(requests),
    };
  } catch {
    return EMPTY_RECORDS;
  }
}

function entriesForPath(path: string, lastModified?: Date): SitemapUrlEntry[] {
  const languages = languageAlternates(path);
  return LOCALES.map((locale) => {
    const entry: SitemapUrlEntry = {
      url: localizedPublicUrl(locale, path),
      alternates: { languages },
    };
    if (lastModified) entry.lastModified = lastModified;
    return entry;
  });
}

export function buildPublicSitemapEntries(
  records: PublicSitemapRecords = EMPTY_RECORDS,
): SitemapUrlEntry[] {
  const entries: SitemapUrlEntry[] = [];

  for (const path of STATIC_PUBLIC_PATHS) {
    entries.push(...entriesForPath(path));
  }

  for (const product of records.products) {
    entries.push(...entriesForPath(`/products/${product.id}`, sitemapLastModified(product.updatedAt)));
  }
  for (const farm of records.farms) {
    if (!isSitemapFarm(farm)) continue;
    entries.push(...entriesForPath(`/farms/${farm.id}`, sitemapLastModified(farm.updatedAt)));
  }
  for (const request of records.requests) {
    entries.push(...entriesForPath(`/requests/${request.id}`, sitemapLastModified(request.updatedAt)));
  }

  return entries;
}

export async function buildPublicSitemap(
  fetchJson: (path: string) => Promise<unknown>,
): Promise<SitemapUrlEntry[]> {
  const records = await loadPublicSitemapRecordIds(fetchJson);
  return buildPublicSitemapEntries(records);
}
