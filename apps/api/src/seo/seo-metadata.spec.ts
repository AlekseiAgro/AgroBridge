import { readFileSync } from 'fs';
import { join } from 'path';
import { LOCALES } from '@agrobridge/shared';
import {
  composeSeoDescription,
  composeSeoTitle,
  distinctPublicOrigin,
  farmMetadataCopy,
  productMetadataCopy,
  requestMetadataCopy,
} from '../../../web/src/lib/seo-page-metadata';

const WEB_ROOT = join(__dirname, '../../../web');
const WEB_SRC = join(WEB_ROOT, 'src');

function readWeb(path: string) {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

function metadataFunction(source: string) {
  const start = source.indexOf('export async function generateMetadata');
  expect(start).toBeGreaterThanOrEqual(0);
  const nextExport = source.indexOf('\nexport ', start + 10);
  return source.slice(start, nextExport === -1 ? undefined : nextExport);
}

function flattenStrings(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unexpected SEO message at ${prefix}`);
  }
  return Object.entries(value).reduce<Record<string, string>>((acc, [key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return { ...acc, ...flattenStrings(child, path) };
  }, {});
}

const PUBLIC_PAGES = [
  'app/[locale]/page.tsx',
  'app/[locale]/catalog/page.tsx',
  'app/[locale]/products/[id]/page.tsx',
  'app/[locale]/farms/[id]/page.tsx',
  'app/[locale]/requests/page.tsx',
  'app/[locale]/requests/[id]/page.tsx',
  'app/[locale]/buyers/page.tsx',
  'app/[locale]/sellers/page.tsx',
  'app/[locale]/how-it-works/page.tsx',
  'app/[locale]/support/page.tsx',
  'app/[locale]/legal/page.tsx',
  'app/[locale]/terms/page.tsx',
  'app/[locale]/privacy/page.tsx',
];

const PRIVATE_PAGES = [
  'app/[locale]/dashboard/layout.tsx',
  'app/[locale]/account/layout.tsx',
  'app/[locale]/login/page.tsx',
  'app/[locale]/register/page.tsx',
  'app/[locale]/forgot-password/page.tsx',
  'app/[locale]/reset-password/page.tsx',
  'app/[locale]/verify-email/page.tsx',
  'app/[locale]/requests/new/page.tsx',
  'app/[locale]/users/[id]/page.tsx',
  'app/[locale]/users/[id]/reviews/page.tsx',
  'app/[locale]/dashboard/chat/page.tsx',
  'app/[locale]/dashboard/admin/page.tsx',
];

const UNTOUCHED_SEO_FILES = [
  'app/sitemap.ts',
  'app/robots.ts',
  'lib/seo-html-metadata.ts',
  'lib/seo-sitemap.ts',
  'lib/seo-robots.ts',
];

describe('dynamic public SEO copy', () => {
  it('builds a product title from the parts that exist', () => {
    const full = productMetadataCopy({
      title: 'Green Tea',
      category: 'Tea',
      place: 'Georgian Tea Farm',
      description: 'Loose leaf green tea from the farm catalog.',
      price: 'Listed price: € 12.00 / kg.',
      availability: 'Availability: Available.',
      quantity: 'Quantity: 100–500 kg.',
      origin: 'Origin: Kakheti.',
      variety: 'Variety: Sencha.',
      season: 'Season: May.',
    });

    expect(full.title).toBe('Green Tea — Tea — Georgian Tea Farm | AgroBridge');
    expect(full.description).toContain('Loose leaf green tea');
    expect(full.description).toContain('Listed price: € 12.00 / kg.');
    expect(full.description).not.toContain('Quantity:');
    expect(full.description).not.toContain('undefined');
    expect(full.description).not.toContain('null');
  });

  it('omits empty product parts and duplicate labels', () => {
    const sparse = productMetadataCopy({
      title: 'Green Tea',
      category: null,
      place: '  ',
      description: null,
      price: null,
      availability: null,
      quantity: '',
      origin: null,
      variety: '   ',
      season: null,
    });

    expect(sparse.title).toBe('Green Tea | AgroBridge');
    expect(sparse.description).toBe('Green Tea');
    expect(sparse.title).not.toContain('— —');
    expect(sparse.title).not.toMatch(/\bundefined\b|\bnull\b/);
    expect(sparse.description).not.toMatch(/\bundefined\b|\bnull\b/);

    const categoryOnly = productMetadataCopy({
      title: 'Green Tea',
      category: 'Tea',
      place: null,
      description: null,
      price: null,
      availability: null,
      quantity: null,
      origin: null,
      variety: null,
      season: null,
    });
    expect(categoryOnly.title).toBe('Green Tea — Tea | AgroBridge');

    const duplicate = productMetadataCopy({
      title: 'Tea',
      category: 'tea',
      place: 'Tea',
      description: null,
      price: null,
      availability: null,
      quantity: null,
      origin: null,
      variety: null,
      season: null,
    });
    expect(duplicate.title).toBe('Tea | AgroBridge');
  });

  it('keeps a long product description and limits extra facts', () => {
    const primary = 'A'.repeat(120);
    const long = productMetadataCopy({
      title: 'Green Tea',
      category: 'Tea',
      place: null,
      description: primary,
      price: 'Listed price: € 4.50 / kg.',
      availability: null,
      quantity: 'Quantity: 10 kg.',
      origin: 'Origin: Georgia.',
      variety: null,
      season: null,
    });
    expect(long.description).toBe(primary);
    expect(long.description).not.toContain('Listed price');

    const noPrimary = productMetadataCopy({
      title: 'Green Tea',
      category: null,
      place: null,
      description: null,
      price: 'Listed price: € 4.50 / kg.',
      availability: 'Availability: Available.',
      quantity: 'Quantity: 10 kg.',
      origin: 'Origin: Kakheti.',
      variety: 'Variety: Sencha.',
      season: 'Season: May.',
    });
    expect(noPrimary.description).toContain('Listed price');
    expect(noPrimary.description).toContain('Availability: Available.');
    expect(noPrimary.description).toContain('Quantity: 10 kg.');
    expect(noPrimary.description).not.toContain('Origin:');
    expect(noPrimary.description).not.toContain('Season:');
  });

  it('does not repeat an origin that is already the place', () => {
    expect(distinctPublicOrigin('kakheti', 'Kakheti')).toBeNull();
    expect(distinctPublicOrigin('  ', 'Kakheti')).toBeNull();
    expect(distinctPublicOrigin('Georgia', 'Kakheti')).toBe('Georgia');

    const copy = productMetadataCopy({
      title: 'Green Tea',
      category: null,
      place: 'Kakheti',
      description: null,
      price: null,
      availability: null,
      quantity: null,
      origin: null,
      variety: null,
      season: 'Season: May, Jun.',
    });
    expect(copy.title).toBe('Green Tea — Kakheti | AgroBridge');
    expect(copy.description).toContain('Season: May, Jun.');
    expect(copy.description).not.toContain('Origin:');
  });

  it('builds farm metadata from public facts only', () => {
    const copy = farmMetadataCopy({
      name: 'Georgian Tea Farm',
      region: 'Kakheti',
      description: null,
      fallback: 'Georgian Tea Farm is a producer profile on AgroBridge.',
      categories: 'Public products: Tea, Honey.',
      exports: 'Export markets: Germany, UAE.',
      verified: null,
    });

    expect(copy.title).toBe('Georgian Tea Farm — Kakheti | AgroBridge');
    expect(copy.description).toContain('producer profile on AgroBridge');
    expect(copy.description).toContain('Public products: Tea, Honey.');
    expect(copy.description).toContain('Export markets: Germany, UAE.');
    expect(copy.description).not.toContain('Verified');
    expect(copy.description).not.toMatch(/certificate|moderation|email/i);

    const verified = farmMetadataCopy({
      name: 'Georgian Tea Farm',
      region: null,
      description: null,
      fallback: 'Georgian Tea Farm is a producer profile on AgroBridge.',
      categories: null,
      exports: null,
      verified: 'This profile shows the Verified badge.',
    });
    expect(verified.title).toBe('Georgian Tea Farm | AgroBridge');
    expect(verified.description).toContain('Verified badge');
  });

  it('builds open purchase-request metadata without buyer or quote fields', () => {
    const copy = requestMetadataCopy({
      title: 'Fresh blueberries',
      category: 'Berries',
      destination: 'Germany',
      message: null,
      fallback: 'Open purchase request.',
      quantity: 'Quantity: 500 kg.',
      variety: 'Variety: Duke.',
      packaging: 'Packaging: 5 kg cartons.',
    });

    expect(copy.title).toBe('Fresh blueberries — Berries — Germany | AgroBridge');
    expect(copy.description).toContain('Open purchase request.');
    expect(copy.description).toContain('Quantity: 500 kg.');
    expect(copy.description).toContain('Variety: Duke.');
    expect(copy.description).not.toContain('Packaging:');
    expect(JSON.stringify(copy)).not.toMatch(/buyer|quote|email/i);
  });

  it('keeps a stored product title instead of inventing a translation', () => {
    const copy = productMetadataCopy({
      title: 'Чай зеленый',
      category: 'Tea',
      place: null,
      description: 'Чай с плантации.',
      price: null,
      availability: null,
      quantity: null,
      origin: null,
      variety: null,
      season: null,
    });
    expect(copy.title).toBe('Чай зеленый — Tea | AgroBridge');
    expect(copy.description).toContain('Чай с плантации.');
  });

  it('clips long descriptions on a word boundary', () => {
    const clipped = composeSeoDescription(`${'word '.repeat(80)}tail`, [], 180);
    expect(clipped.endsWith('…')).toBe(true);
    expect(clipped.length).toBeLessThanOrEqual(180);
    expect(composeSeoTitle([])).toBe('AgroBridge');
    expect(composeSeoTitle(['', '  '])).toBe('AgroBridge');
  });
});

describe('localized SEO message templates', () => {
  const english = flattenStrings(
    JSON.parse(readFileSync(join(WEB_ROOT, 'messages/en.json'), 'utf8')).seo,
  );
  const staticPages = [
    'home',
    'catalog',
    'requests',
    'buyers',
    'sellers',
    'howItWorks',
    'support',
    'legal',
    'terms',
    'privacy',
  ];

  it('uses the same keys in every supported locale', () => {
    expect(LOCALES).toEqual(['ka', 'en', 'ru', 'de', 'fr', 'it', 'es']);
    for (const locale of LOCALES) {
      const seo = JSON.parse(readFileSync(join(WEB_ROOT, `messages/${locale}.json`), 'utf8')).seo;
      const strings = flattenStrings(seo);
      expect(Object.keys(strings).sort()).toEqual(Object.keys(english).sort());
      for (const page of staticPages) {
        expect(strings[`${page}.title`]).toContain('AgroBridge');
        expect(strings[`${page}.description`].trim().length).toBeGreaterThan(20);
      }
      const joined = Object.values(strings).join('\n');
      expect(joined).not.toMatch(/\b(largest|best|cheapest)\b/i);
      expect(joined.toLowerCase()).not.toContain('global marketplace');
    }
  });

  it('keeps catalog and purchase-request copy factual', () => {
    expect(english['catalog.title']).toBe('Agricultural products from Georgian farms | AgroBridge');
    expect(english['catalog.description']).toBe('Browse published offers from Georgian farms.');
    expect(english['requests.description']).toContain('Buyers publish what they need');
    expect(english['requests.description']).not.toMatch(/buyer name|email/i);
  });
});

describe('server metadata wiring', () => {
  it('adds generateMetadata on public pages and leaves private pages alone', () => {
    for (const path of PUBLIC_PAGES) {
      const source = readWeb(path);
      expect(source).not.toContain("'use client'");
      expect(source).toContain("from '@/lib/seo-public-metadata'");
      const metadata = metadataFunction(source);
      expect(metadata).toContain('generateMetadata');
      expect(metadata).not.toContain('openGraph');
      expect(metadata).not.toContain('alternates');
      expect(metadata).not.toContain('application/ld+json');
      expect(metadata).not.toContain('notFound(');
    }

    for (const path of PRIVATE_PAGES) {
      const source = readWeb(path);
      expect(source).not.toContain('seo-public-metadata');
      expect(source).not.toContain('seo-page-metadata');
    }

    for (const path of [
      'app/[locale]/dashboard/layout.tsx',
      'app/[locale]/account/layout.tsx',
      'app/[locale]/login/page.tsx',
      'app/[locale]/requests/new/page.tsx',
    ]) {
      expect(readWeb(path)).toContain('noindexRobots');
    }
  });

  it('loads entity pages on the server and skips non-public records', () => {
    const helper = readWeb('lib/seo-public-metadata.ts');
    expect(helper).toContain('if (!isPubliclyListedProduct(product)) return {};');
    expect(helper).toContain("if (request.status !== 'open') return {};");
    expect(helper).toContain('distinctPublicOrigin');
    expect(helper).toContain('formatProductTitle');
    expect(helper).toContain('formatProductDescription');
    expect(helper).not.toContain('openGraph');
    expect(helper).not.toContain('twitter');
    expect(helper).not.toContain('alternates');
    expect(helper).not.toContain('application/ld+json');
    expect(helper).not.toContain('prisma');
    expect(helper).not.toContain('moderationNote');
    expect(helper).not.toContain('verificationNote');
    expect(helper).not.toContain('certificates');
    expect(helper).not.toContain('.quotes');
    expect(helper).not.toContain('buyer.');

    const product = readWeb('app/[locale]/products/[id]/page.tsx');
    expect(product).toContain('const loadProduct = cache(');
    expect(metadataFunction(product)).toContain('productPageMetadata');
    expect(metadataFunction(product)).toContain('loadProduct');

    const farm = readWeb('app/[locale]/farms/[id]/page.tsx');
    expect(farm).toContain('const loadFarm = cache(');
    expect(metadataFunction(farm)).toContain('farmPageMetadata');

    const request = readWeb('app/[locale]/requests/[id]/page.tsx');
    expect(request).toContain('const loadPurchaseRequest = cache(');
    expect(metadataFunction(request)).toContain('purchaseRequestPageMetadata');

    const catalog = metadataFunction(readWeb('app/[locale]/catalog/page.tsx'));
    expect(catalog).toContain("staticPublicMetadata(locale, 'catalog')");
    expect(catalog).not.toContain('searchParams');

    const board = metadataFunction(readWeb('app/[locale]/requests/page.tsx'));
    expect(board).toContain("staticPublicMetadata(locale, 'requests')");
    expect(board).not.toContain('searchParams');
  });

  it('does not retarget sitemap, robots, canonical, or hreflang helpers', () => {
    for (const path of UNTOUCHED_SEO_FILES) {
      const source = readWeb(path);
      expect(source).not.toContain('seo-public-metadata');
      expect(source).not.toContain('seo-page-metadata');
    }
    const layout = readWeb('app/[locale]/layout.tsx');
    expect(layout).toContain('publicPageHtmlMetadata');
    expect(layout).toContain("namespace: 'meta'");
    expect(readWeb('lib/seo-page-metadata.ts')).not.toMatch(
      /openGraph|twitter|alternates|ld\+json|canonical|hreflang/,
    );
  });
});
