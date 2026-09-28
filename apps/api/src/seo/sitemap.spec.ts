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
      products: [{ id: 'prodPublic1', updatedAt: '2026-02-02T00:00:00.000Z' }],
      farms: [
        {
          id: 'farmPublic1',
          updatedAt: '2026-03-03T00:00:00.000Z',
          description: 'Orchard',
          productCount: 0,
        },
      ],
      requests: [{ id: 'reqPublic1', updatedAt: '2026-04-04T00:00:00.000Z' }],
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

    expect(records.products.map((item) => item.id)).toEqual(['liveProduct1']);
    expect(records.farms).toEqual([]);
    expect(records.requests.map((item) => item.id)).toEqual(['openRequest1']);
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

const PRODUCT_UPDATED_AT = '2026-02-02T03:04:05.000Z';
const FARM_UPDATED_AT = '2026-03-03T03:04:05.000Z';
const REQUEST_UPDATED_AT = '2026-04-04T03:04:05.000Z';

function urlsFor(entries: { url: string }[], snippet: string) {
  return entries.filter((entry) => entry.url.includes(snippet));
}

describe('sitemap lastmod and farm eligibility', () => {
  it('uses the product updatedAt for every locale and keeps sold-out products', () => {
    const before = Date.now();
    const products = [
      { id: 'soldOutProd1', updatedAt: PRODUCT_UPDATED_AT, harvestStatus: 'soldOut' },
    ];
    const entries = buildPublicSitemapEntries({
      products,
      farms: [],
      requests: [],
    });
    const productEntries = urlsFor(entries, '/products/soldOutProd1');
    expect(productEntries).toHaveLength(LOCALES.length);
    expect(new Set(productEntries.map((entry) => entry.lastModified?.toISOString()))).toEqual(
      new Set([PRODUCT_UPDATED_AT]),
    );
    expect(productEntries[0]?.lastModified?.toISOString()).not.toBe(new Date(before).toISOString());
    for (const locale of LOCALES) {
      expect(productEntries.map((entry) => entry.url)).toContain(
        `${PRODUCTION_WEB_ORIGIN}/${locale}/products/soldOutProd1`,
      );
    }
  });

  it('includes a farm with a description or a public product, and excludes an empty one', () => {
    const entries = buildPublicSitemapEntries({
      products: [],
      farms: [
        {
          id: 'farmDescribed',
          updatedAt: FARM_UPDATED_AT,
          description: 'Family orchard',
          productCount: 0,
        },
        {
          id: 'farmWithGoods',
          updatedAt: FARM_UPDATED_AT,
          description: '   ',
          productCount: 1,
        },
        {
          id: 'farmEmpty001',
          updatedAt: FARM_UPDATED_AT,
          description: '',
          productCount: 0,
          history: 'Since 1990',
        },
      ],
      requests: [],
    });

    for (const id of ['farmDescribed', 'farmWithGoods']) {
      const farmEntries = urlsFor(entries, `/farms/${id}`);
      expect(farmEntries).toHaveLength(LOCALES.length);
      expect(new Set(farmEntries.map((entry) => entry.lastModified?.toISOString()))).toEqual(
        new Set([FARM_UPDATED_AT]),
      );
    }
    expect(entries.some((entry) => entry.url.includes('/farms/farmEmpty001'))).toBe(false);
  });

  it('drops farms that only have a name, region, photo, history, or other non-qualifying fields', async () => {
    const records = await loadPublicSitemapRecordIds(async (path) => {
      if (path !== '/farms') return [];
      return [
        {
          id: 'farmDescribed',
          description: 'Tea garden',
          productCount: 0,
          updatedAt: FARM_UPDATED_AT,
        },
        {
          id: 'farmWithGoods',
          description: '',
          productCount: 2,
          updatedAt: FARM_UPDATED_AT,
        },
        {
          id: 'farmWhitespace',
          description: '   ',
          productCount: 0,
          history: 'Since 1990',
          region: 'kakheti',
          photos: [{ id: 'ph1' }],
          verified: true,
          updatedAt: FARM_UPDATED_AT,
        },
        {
          id: 'farmFactsOnly',
          description: null,
          productCount: 0,
          name: 'Name only',
          foundedYear: 2001,
          farmSizeHectares: 4,
          ownershipType: 'Family',
          exportMarkets: ['Germany'],
          updatedAt: FARM_UPDATED_AT,
        },
      ];
    });

    expect(records.farms.map((farm) => farm.id)).toEqual(['farmDescribed', 'farmWithGoods']);
    const entries = buildPublicSitemapEntries(records);
    expect(urlsFor(entries, '/farms/farmWhitespace')).toHaveLength(0);
    expect(urlsFor(entries, '/farms/farmFactsOnly')).toHaveLength(0);
    expect(urlsFor(entries, '/farms/farmDescribed')).toHaveLength(LOCALES.length);
  });

  it('uses purchase-request updatedAt and still excludes closed requests', async () => {
    const records = await loadPublicSitemapRecordIds(async (path) => {
      if (path !== '/purchase-requests') return [];
      return [
        { id: 'openRequest1', status: 'open', updatedAt: REQUEST_UPDATED_AT },
        { id: 'closedRequest1', status: 'closed', updatedAt: REQUEST_UPDATED_AT },
        { id: 'cancelledRequest1', status: 'cancelled', updatedAt: REQUEST_UPDATED_AT },
      ];
    });
    expect(records.requests).toEqual([{ id: 'openRequest1', updatedAt: REQUEST_UPDATED_AT }]);
    const entries = buildPublicSitemapEntries(records);
    const requestEntries = urlsFor(entries, '/requests/openRequest1');
    expect(requestEntries).toHaveLength(LOCALES.length);
    expect(new Set(requestEntries.map((entry) => entry.lastModified?.toISOString()))).toEqual(
      new Set([REQUEST_UPDATED_AT]),
    );
    expect(entries.some((entry) => entry.url.includes('closedRequest1'))).toBe(false);
    expect(entries.some((entry) => entry.url.includes('cancelledRequest1'))).toBe(false);
  });

  it('does not stamp static pages or invalid entity timestamps', () => {
    const entries = buildPublicSitemapEntries({
      products: [{ id: 'badDateProd1', updatedAt: 'not-a-date' }],
      farms: [
        {
          id: 'badDateFarm1',
          updatedAt: '',
          description: 'Orchard',
          productCount: 0,
        },
      ],
      requests: [{ id: 'badDateReq01', updatedAt: '   ' }],
    });

    const staticEntries = entries.filter((entry) =>
      LOCALES.some((locale) =>
        STATIC_PUBLIC_PATHS.some((path) => entry.url === localizedPublicUrl(locale, path)),
      ),
    );
    expect(staticEntries.length).toBe(LOCALES.length * STATIC_PUBLIC_PATHS.length);
    for (const entry of staticEntries) {
      expect(entry.lastModified).toBeUndefined();
      expect(entry).not.toHaveProperty('changeFrequency');
      expect(entry).not.toHaveProperty('priority');
    }

    for (const snippet of ['/products/badDateProd1', '/farms/badDateFarm1', '/requests/badDateReq01']) {
      const matched = urlsFor(entries, snippet);
      expect(matched).toHaveLength(LOCALES.length);
      for (const entry of matched) {
        expect(entry.lastModified).toBeUndefined();
      }
    }

    expect(readWeb('lib/seo-sitemap.ts')).not.toContain('new Date()');
    expect(readWeb('lib/seo-sitemap.ts')).not.toContain('changeFrequency');
    expect(readWeb('lib/seo-sitemap.ts')).not.toContain('priority');
    expect(readWeb('app/robots.ts')).toContain('sitemap: PRODUCTION_SITEMAP_URL');
    expect(languageAlternates('/catalog')['x-default']).toBe(
      localizedPublicUrl(DEFAULT_LOCALE, '/catalog'),
    );
  });
});
