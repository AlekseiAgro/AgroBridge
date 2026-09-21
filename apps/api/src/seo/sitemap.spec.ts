import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_LOCALE, LOCALES } from '@agrobridge/shared';
import { PRODUCTION_SITEMAP_URL, PRODUCTION_WEB_ORIGIN } from '../../../web/src/lib/seo-robots';
import {
  STATIC_PUBLIC_PATHS,
  buildPublicSitemap,
  buildPublicSitemapEntries,
  isPublicRecordId,
  languageAlternates,
  loadPublicSitemapRecordIds,
  localizedPublicUrl,
} from '../../../web/src/lib/seo-sitemap';

const WEB_SRC = join(__dirname, '../../../web/src');

function readWeb(path: string) {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

const PRIVATE_PATH_SNIPPETS = [
  '/account',
  '/account/settings',
  '/dashboard',
  '/admin',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/requests/new',
  '/dashboard/subscriptions',
  '/dashboard/notifications',
  '/dashboard/chat',
  '/dashboard/rfqs',
  '/dashboard/quotes',
  '/dashboard/inbox',
  '/dashboard/purchase-requests',
];

describe('public sitemap route', () => {
  it('exposes a Next metadata sitemap route', () => {
    expect(existsSync(join(WEB_SRC, 'app/sitemap.ts'))).toBe(true);
    const source = readWeb('app/sitemap.ts');
    expect(source).toContain('buildPublicSitemap');
    expect(source).toContain("apiRequest(path)");
    expect(source).not.toContain('prisma');
    expect(source).not.toContain('/dashboard');
    expect(source).not.toContain('/account');
  });

  it('keeps robots.txt pointed at the production sitemap URL', () => {
    expect(PRODUCTION_SITEMAP_URL).toBe('https://agrobridge.ge/sitemap.xml');
    expect(readWeb('app/robots.ts')).toContain('sitemap: PRODUCTION_SITEMAP_URL');
  });
});

describe('localized public sitemap URLs', () => {
  it('uses localePrefix=always URLs on the production origin', () => {
    expect(localizedPublicUrl('en')).toBe(`${PRODUCTION_WEB_ORIGIN}/en`);
    expect(localizedPublicUrl('ru', '/catalog')).toBe(`${PRODUCTION_WEB_ORIGIN}/ru/catalog`);
    expect(localizedPublicUrl('ka', '/products/abc12345')).toBe(
      `${PRODUCTION_WEB_ORIGIN}/ka/products/abc12345`,
    );
  });

  it('emits hreflang alternates for every UI locale plus x-default', () => {
    const languages = languageAlternates('/catalog');
    expect(languages['x-default']).toBe(localizedPublicUrl(DEFAULT_LOCALE, '/catalog'));
    for (const locale of LOCALES) {
      expect(languages[locale]).toBe(localizedPublicUrl(locale, '/catalog'));
    }
  });

  it('includes static public surfaces in every locale and omits private routes', () => {
    const entries = buildPublicSitemapEntries();
    const urls = entries.map((entry) => entry.url);

    expect(STATIC_PUBLIC_PATHS).toEqual([
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
    ]);

    for (const locale of LOCALES) {
      expect(urls).toContain(`${PRODUCTION_WEB_ORIGIN}/${locale}`);
      expect(urls).toContain(`${PRODUCTION_WEB_ORIGIN}/${locale}/catalog`);
      expect(urls).toContain(`${PRODUCTION_WEB_ORIGIN}/${locale}/requests`);
      expect(urls).toContain(`${PRODUCTION_WEB_ORIGIN}/${locale}/legal`);
    }

    expect(urls).toHaveLength(LOCALES.length * STATIC_PUBLIC_PATHS.length);

    const blob = urls.join('\n');
    for (const snippet of PRIVATE_PATH_SNIPPETS) {
      expect(blob).not.toContain(snippet);
    }
  });
});

describe('public record filtering for sitemap', () => {
  it('accepts only safe public record ids', () => {
    expect(isPublicRecordId('clxyz12345')).toBe(true);
    expect(isPublicRecordId('../secret')).toBe(false);
    expect(isPublicRecordId('abc')).toBe(false);
    expect(isPublicRecordId('')).toBe(false);
  });

  it('includes only supplied public product, farm, and open request ids', () => {
    const entries = buildPublicSitemapEntries({
      productIds: ['prodPublic1'],
      farmIds: ['farmPublic1'],
      requestIds: ['reqPublic1'],
    });
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain(`${PRODUCTION_WEB_ORIGIN}/en/products/prodPublic1`);
    expect(urls).toContain(`${PRODUCTION_WEB_ORIGIN}/ru/farms/farmPublic1`);
    expect(urls).toContain(`${PRODUCTION_WEB_ORIGIN}/ka/requests/reqPublic1`);
    expect(urls).not.toContain(`${PRODUCTION_WEB_ORIGIN}/en/products/draftHidden`);
    expect(urls.join('\n')).not.toContain('/dashboard');
  });

  it('ignores unpublished-shaped and malformed API payloads', async () => {
    const records = await loadPublicSitemapRecordIds(async (path) => {
      if (path === '/products') {
        return [
          { id: 'liveProduct1', isPublished: true },
          { id: '../nope' },
          { title: 'missing-id' },
        ];
      }
      if (path === '/farms') {
        return { farms: [{ id: 'not-an-array' }] };
      }
      if (path === '/purchase-requests') {
        return [
          { id: 'openRequest1', status: 'open' },
          { id: 'closedRequest1', status: 'closed' },
          { id: 'cancelledRequest1', status: 'cancelled' },
        ];
      }
      return [];
    });

    expect(records.productIds).toEqual(['liveProduct1']);
    expect(records.farmIds).toEqual([]);
    expect(records.requestIds).toEqual(['openRequest1']);
  });

  it('returns a valid static sitemap when public APIs fail', async () => {
    const entries = await buildPublicSitemap(async () => {
      throw new Error('API unavailable');
    });
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain(`${PRODUCTION_WEB_ORIGIN}/en`);
    expect(urls).toContain(`${PRODUCTION_WEB_ORIGIN}/en/catalog`);
    expect(urls.some((url) => url.includes('/products/'))).toBe(false);
    expect(urls.some((url) => url.includes('/farms/'))).toBe(false);
    expect(urls.some((url) => url.includes('/requests/'))).toBe(false);
  });
});
