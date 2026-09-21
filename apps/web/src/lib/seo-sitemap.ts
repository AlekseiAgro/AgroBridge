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

export type PublicSitemapRecordIds = {
  productIds: string[];
  farmIds: string[];
  requestIds: string[];
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

function idsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || !('id' in item)) continue;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!isPublicRecordId(id) || seen.has(id)) continue;
    if ('status' in item && item.status !== undefined && item.status !== 'open') continue;
    seen.add(id);
  }
  return [...seen];
}

export async function loadPublicSitemapRecordIds(
  fetchJson: (path: string) => Promise<unknown>,
): Promise<PublicSitemapRecordIds> {
  const empty: PublicSitemapRecordIds = { productIds: [], farmIds: [], requestIds: [] };

  const [products, farms, requests] = await Promise.all([
    fetchJson('/products').catch(() => []),
    fetchJson('/farms').catch(() => []),
    fetchJson('/purchase-requests').catch(() => []),
  ]);

  try {
    return {
      productIds: idsFromUnknown(products),
      farmIds: idsFromUnknown(farms),
      requestIds: idsFromUnknown(requests),
    };
  } catch {
    return empty;
  }
}

function entriesForPath(path: string, lastModified?: Date): SitemapUrlEntry[] {
  const languages = languageAlternates(path);
  return LOCALES.map((locale) => ({
    url: localizedPublicUrl(locale, path),
    lastModified,
    alternates: { languages },
  }));
}

export function buildPublicSitemapEntries(
  records: PublicSitemapRecordIds = { productIds: [], farmIds: [], requestIds: [] },
  lastModified = new Date(),
): SitemapUrlEntry[] {
  const entries: SitemapUrlEntry[] = [];

  for (const path of STATIC_PUBLIC_PATHS) {
    entries.push(...entriesForPath(path, lastModified));
  }

  for (const id of records.productIds) {
    entries.push(...entriesForPath(`/products/${id}`, lastModified));
  }
  for (const id of records.farmIds) {
    entries.push(...entriesForPath(`/farms/${id}`, lastModified));
  }
  for (const id of records.requestIds) {
    entries.push(...entriesForPath(`/requests/${id}`, lastModified));
  }

  return entries;
}

export async function buildPublicSitemap(
  fetchJson: (path: string) => Promise<unknown>,
): Promise<SitemapUrlEntry[]> {
  const records = await loadPublicSitemapRecordIds(fetchJson);
  return buildPublicSitemapEntries(records);
}
