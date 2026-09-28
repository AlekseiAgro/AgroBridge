import { readFileSync } from 'fs';
import { join } from 'path';
import type { ProductImage } from '@agrobridge/shared';
import { formatProductTitle } from '../../../web/src/lib/product-title';
import {
  buildHomeJsonLd,
  buildProductJsonLd,
  type ProductJsonLdSource,
} from '../../../web/src/lib/seo-jsonld';

const WEB_SRC = join(__dirname, '../../../web/src');

function readWeb(path: string) {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

function keysDeep(value: unknown, found: string[] = []): string[] {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) keysDeep(item, found);
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    found.push(key);
    keysDeep(child, found);
  }
  return found;
}

function image(url: string, overrides: Partial<ProductImage> = {}): ProductImage {
  return {
    id: 'img1',
    url,
    sortOrder: 0,
    isPrimary: true,
    kind: 'overview',
    ...overrides,
  };
}

function publicProduct(overrides: Partial<ProductJsonLdSource> = {}): ProductJsonLdSource {
  return {
    id: 'prod12345',
    title: 'Fresh Kakheti peaches',
    description: 'Seasonal freestone peaches, hand-picked for export.',
    category: 'fruits',
    country: 'Georgia',
    images: [image('/api/uploads/products/prod12345/peach.jpg')],
    isPublished: true,
    moderationStatus: 'approved',
    ...overrides,
  };
}

const FORBIDDEN_HOME_KEYS = [
  'sameAs',
  'telephone',
  'email',
  'contactPoint',
  'address',
  'legalName',
  'taxID',
  'identifier',
  'foundingDate',
  'SearchAction',
];

const FORBIDDEN_PRODUCT_KEYS = [
  'brand',
  'manufacturer',
  'seller',
  'LocalBusiness',
  'sku',
  'gtin',
  'mpn',
  'productID',
  'material',
  'additionalProperty',
  'aggregateRating',
  'review',
  'availability',
  'offers',
  'price',
  'lowPrice',
  'highPrice',
  'priceCurrency',
  'priceValidUntil',
  'priceSpecification',
  'unitCode',
  'eligibleQuantity',
  'inventoryLevel',
  'VideoObject',
  'BreadcrumbList',
  'ItemList',
  'hasCertification',
  'robots',
  'moderationNote',
  'moderationStatus',
  'isPublished',
  'ownerUserId',
  'qualityScore',
  'opportunity',
];

describe('homepage JSON-LD', () => {
  it('builds a localized WebSite and a stable Organization', () => {
    const ka = buildHomeJsonLd({
      locale: 'ka',
      description: 'ქართული მეურნეობებიდან გლობალურ ბაზრებამდე',
      slogan: 'ქართული მეურნეობები. გლობალური მყიდველები.',
    });
    const en = buildHomeJsonLd({
      locale: 'en',
      description: 'From Georgian Farms to Global Markets',
      slogan: 'Georgian farms. Global buyers.',
    });

    expect(ka).toMatchObject({
      '@context': 'https://schema.org',
    });
    const kaGraph = ka?.['@graph'] as Array<Record<string, unknown>>;
    const enGraph = en?.['@graph'] as Array<Record<string, unknown>>;
    expect(kaGraph).toHaveLength(2);
    expect(enGraph.map((node) => node['@type'])).toEqual(['WebSite', 'Organization']);

    expect(kaGraph[0]).toMatchObject({
      '@type': 'WebSite',
      '@id': 'https://agrobridge.ge/#website',
      name: 'AgroBridge',
      url: 'https://agrobridge.ge/ka',
      inLanguage: 'ka',
      description: 'ქართული მეურნეობებიდან გლობალურ ბაზრებამდე',
      publisher: { '@id': 'https://agrobridge.ge/#organization' },
    });
    expect(enGraph[0]).toMatchObject({
      url: 'https://agrobridge.ge/en',
      inLanguage: 'en',
    });
    expect(kaGraph[1]).toEqual({
      '@type': 'Organization',
      '@id': 'https://agrobridge.ge/#organization',
      name: 'AgroBridge',
      url: 'https://agrobridge.ge/en',
      logo: {
        '@type': 'ImageObject',
        url: 'https://agrobridge.ge/brand/agrobridge-logo.png',
        width: 1773,
        height: 887,
      },
      slogan: 'ქართული მეურნეობები. გლობალური მყიდველები.',
    });
    expect(enGraph[1]).toMatchObject({ url: 'https://agrobridge.ge/en' });

    const logoSource = readWeb('components/BrandLogo.tsx');
    expect(logoSource).toContain("AGROBRIDGE_LOGO_SRC = '/brand/agrobridge-logo.png'");
    expect(logoSource).toContain('AGROBRIDGE_LOGO_WIDTH = 1773');
    expect(logoSource).toContain('AGROBRIDGE_LOGO_HEIGHT = 887');

    for (const key of FORBIDDEN_HOME_KEYS) {
      expect(keysDeep(ka)).not.toContain(key);
      expect(keysDeep(en)).not.toContain(key);
    }
  });
});

describe('product JSON-LD', () => {
  it('describes a public product with localized visible fields', () => {
    const product = publicProduct();
    const en = buildProductJsonLd(product, 'en');
    const ru = buildProductJsonLd(product, 'ru');

    expect(en).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': 'https://agrobridge.ge/en/products/prod12345#product',
      url: 'https://agrobridge.ge/en/products/prod12345',
      name: formatProductTitle(product.title, 'en'),
      description: 'Seasonal freestone peaches, hand-picked for export.',
      image: ['https://agrobridge.ge/api/uploads/products/prod12345/peach.jpg'],
      category: 'Fruits',
      countryOfOrigin: { '@type': 'Country', name: 'Georgia' },
    });
    expect(ru).toMatchObject({
      '@id': 'https://agrobridge.ge/en/products/prod12345#product',
      url: 'https://agrobridge.ge/ru/products/prod12345',
      name: 'Свежие персики из Кахетии',
      description: 'Сезонные персики свободной косточки, собранные вручную на экспорт.',
      category: 'Фрукты',
    });
    for (const key of FORBIDDEN_PRODUCT_KEYS) {
      expect(keysDeep(en)).not.toContain(key);
    }
  });

  it('returns null unless the product is publicly listed', () => {
    expect(buildProductJsonLd(publicProduct({ isPublished: false }), 'en')).toBeNull();
    expect(buildProductJsonLd(publicProduct({ moderationStatus: 'pending' }), 'en')).toBeNull();
    expect(buildProductJsonLd(publicProduct({ title: 'Untitled product' }), 'en')).toBeNull();
    expect(buildProductJsonLd(publicProduct(), 'xx')).toBeNull();
  });

  it('omits empty description, unknown category, and empty country', () => {
    const data = buildProductJsonLd(
      publicProduct({
        description: '   ',
        category: 'not-a-category',
        country: '   ',
      }),
      'en',
    );
    expect(data).not.toHaveProperty('description');
    expect(data).not.toHaveProperty('category');
    expect(data).not.toHaveProperty('countryOfOrigin');
    expect(data?.name).toBe('Fresh Kakheti peaches');
  });

  it('keeps real photos absolute and drops placeholders', () => {
    const data = buildProductJsonLd(
      publicProduct({
        images: [
          image('/api/uploads/products/prod12345/peach.jpg', { id: 'a', sortOrder: 0 }),
          image('https://cdn.example.com/products/closeup.jpg', { id: 'b', sortOrder: 1 }),
          image('/images/categories/fruits.jpg', { id: 'c', sortOrder: 2 }),
          image('   ', { id: 'd', sortOrder: 3 }),
          image('', { id: 'e', sortOrder: 4 }),
        ],
      }),
      'en',
    );
    expect(data?.image).toEqual([
      'https://agrobridge.ge/api/uploads/products/prod12345/peach.jpg',
      'https://cdn.example.com/products/closeup.jpg',
    ]);

    const withoutImages = buildProductJsonLd(
      publicProduct({
        images: [image('/images/categories/fruits.jpg'), image('')],
      }),
      'en',
    );
    expect(withoutImages).not.toHaveProperty('image');
  });

  it('does not invent an offer, availability, rating, or seller', () => {
    const priced = {
      ...publicProduct({ description: null, images: [] }),
      priceFrom: 4.5,
      priceCurrency: 'EUR',
      priceNegotiable: false,
      priceDependsOnVolume: false,
      harvestStatus: 'available',
      sellerRating: { average: 4.5, count: 3 },
      moderationNote: 'internal note',
      ownerUserId: 'owner12345',
      variety: 'Freestone',
      qualityScore: { score: 80 },
      opportunity: { tier: 'good' },
    };
    const cases = [
      priced,
      { ...priced, priceNegotiable: true, harvestStatus: 'limited' },
      { ...priced, priceDependsOnVolume: true, harvestStatus: 'growing' },
      { ...priced, priceFrom: null, priceCurrency: null, harvestStatus: 'soldOut' },
    ];

    for (const product of cases) {
      const data = buildProductJsonLd(product, 'de');
      expect(data?.['@type']).toBe('Product');
      expect(data).not.toHaveProperty('offers');
      expect(data).not.toHaveProperty('availability');
      expect(data).not.toHaveProperty('aggregateRating');
      expect(data).not.toHaveProperty('review');
      expect(data).not.toHaveProperty('seller');
      expect(data).not.toHaveProperty('manufacturer');
      expect(data).not.toHaveProperty('brand');
      expect(data).not.toHaveProperty('sku');
      expect(data).not.toHaveProperty('productID');
      expect(data).not.toHaveProperty('material');
      expect(data).not.toHaveProperty('robots');
      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain('internal note');
      expect(serialized).not.toContain('owner12345');
      expect(serialized).not.toContain('Freestone');
      expect(serialized).not.toContain('price');
      for (const key of FORBIDDEN_PRODUCT_KEYS) {
        expect(keysDeep(data)).not.toContain(key);
      }
    }
  });
});

describe('JSON-LD page wiring', () => {
  it('renders homepage JSON-LD and product JSON-LD only for a public listing', () => {
    const home = readWeb('app/[locale]/page.tsx');
    expect(home).toContain('buildHomeJsonLd');
    expect(home).toContain('<JsonLd');
    expect(home).not.toContain('application/ld+json');

    const product = readWeb('app/[locale]/products/[id]/page.tsx');
    expect(product).toContain('buildProductJsonLd(product, locale)');
    expect(product).toContain('productJsonLd ? <JsonLd');
    expect(product).not.toContain('noindexFollowRobots');
    expect(product).not.toContain('index: false');

    const builder = readWeb('lib/seo-jsonld.ts');
    expect(builder).toContain('isPubliclyListedProduct');
    expect(builder).not.toContain('offers:');
    expect(builder).not.toContain('aggregateRating');

    expect(readWeb('lib/seo-public-metadata.ts')).not.toContain('application/ld+json');
    expect(readWeb('components/JsonLd.tsx')).toContain('type="application/ld+json"');
    expect(readWeb('components/JsonLd.tsx')).toContain('JSON.stringify');
    expect(readWeb('components/JsonLd.tsx')).toContain('\\u003c');
    expect(readWeb('components/JsonLd.tsx')).not.toContain("'use client'");
    expect(readWeb('app/[locale]/layout.tsx')).not.toContain('seo-jsonld');
    expect(readWeb('app/sitemap.ts')).not.toContain('seo-jsonld');
    expect(readWeb('app/robots.ts')).not.toContain('seo-jsonld');
  });
});
