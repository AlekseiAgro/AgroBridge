import { readFileSync } from 'fs';
import { join } from 'path';
import type { ProductImage } from '@agrobridge/shared';
import {
  buildBreadcrumbJsonLd,
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
    const ru = buildProductJsonLd(
      {
        ...product,
        display: {
          title: 'Свежие персики из Кахетии',
          description: 'Сезонные персики свободной косточки, собранные вручную на экспорт.',
        },
      },
      'ru',
    );

    expect(en).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': 'https://agrobridge.ge/en/products/prod12345#product',
      url: 'https://agrobridge.ge/en/products/prod12345',
      name: product.title,
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

describe('breadcrumb JSON-LD', () => {
  it('builds a three-item product trail in the current locale with a stable English id', () => {
    const data = buildBreadcrumbJsonLd({
      locale: 'ru',
      idPath: '/products/prod12345',
      items: [
        { name: 'Home', path: '' },
        { name: 'Catalog', path: '/catalog' },
        { name: 'Свежие персики из Кахетии', path: '/products/prod12345' },
      ],
    });

    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': 'https://agrobridge.ge/en/products/prod12345#breadcrumb',
    });
    expect(data?.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://agrobridge.ge/ru',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Catalog',
        item: 'https://agrobridge.ge/ru/catalog',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Свежие персики из Кахетии',
        item: 'https://agrobridge.ge/ru/products/prod12345',
      },
    ]);
    expect(JSON.stringify(data)).not.toContain('?');
    expect(buildBreadcrumbJsonLd({
      locale: 'en',
      idPath: '/products/prod12345',
      items: [
        { name: 'Home', path: '' },
        { name: 'Catalog', path: '/catalog' },
        { name: 'Fresh Kakheti peaches', path: '/products/prod12345' },
      ],
    })?.['@id']).toBe('https://agrobridge.ge/en/products/prod12345#breadcrumb');
  });

  it('builds a two-item farm trail without a catalog parent', () => {
    const data = buildBreadcrumbJsonLd({
      locale: 'ka',
      idPath: '/farms/farm12345',
      items: [
        { name: 'მთავარი', path: '' },
        { name: 'Tanya Farm', path: '/farms/farm12345' },
      ],
    });

    expect(data?.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'მთავარი',
        item: 'https://agrobridge.ge/ka',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Tanya Farm',
        item: 'https://agrobridge.ge/ka/farms/farm12345',
      },
    ]);
    expect(data?.['@id']).toBe('https://agrobridge.ge/en/farms/farm12345#breadcrumb');
    expect(JSON.stringify(data)).not.toContain('/catalog');
    expect(JSON.stringify(data)).not.toContain('?');
  });

  it('builds a three-item open purchase-request trail in the current locale', () => {
    const data = buildBreadcrumbJsonLd({
      locale: 'de',
      idPath: '/requests/req123456',
      items: [
        { name: 'Startseite', path: '' },
        { name: 'Kaufanfragen', path: '/requests' },
        { name: 'Peaches for August', path: '/requests/req123456' },
      ],
    });

    expect(data?.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Startseite',
        item: 'https://agrobridge.ge/de',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Kaufanfragen',
        item: 'https://agrobridge.ge/de/requests',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Peaches for August',
        item: 'https://agrobridge.ge/de/requests/req123456',
      },
    ]);
    expect(data?.['@id']).toBe('https://agrobridge.ge/en/requests/req123456#breadcrumb');
    expect(JSON.stringify(data)).not.toContain('?');
  });

  it('keeps BreadcrumbList out of Product and homepage JSON-LD', () => {
    expect(keysDeep(buildProductJsonLd(publicProduct(), 'en'))).not.toContain('BreadcrumbList');
    expect(keysDeep(buildHomeJsonLd({
      locale: 'en',
      description: 'From Georgian Farms to Global Markets',
      slogan: 'Georgian farms. Global buyers.',
    }))).not.toContain('BreadcrumbList');

    const builder = readWeb('lib/seo-jsonld.ts');
    const homeFn = builder.slice(
      builder.indexOf('export function buildHomeJsonLd'),
      builder.indexOf('export function buildProductJsonLd'),
    );
    const productFn = builder.slice(
      builder.indexOf('export function buildProductJsonLd'),
      builder.indexOf('export type BreadcrumbJsonLdItem'),
    );
    expect(homeFn).not.toContain('BreadcrumbList');
    expect(productFn).not.toContain('BreadcrumbList');
    expect(builder).toContain('export function buildBreadcrumbJsonLd');
  });

  it('omits a list when a name is blank, the locale is unknown, or a path has a query', () => {
    const items = [
      { name: 'Home', path: '' },
      { name: 'Catalog', path: '/catalog' },
      { name: 'Peaches', path: '/products/prod12345' },
    ];
    expect(buildBreadcrumbJsonLd({
      locale: 'en',
      idPath: '/products/prod12345',
      items: [{ name: 'Home', path: '' }, { name: '   ', path: '/products/prod12345' }],
    })).toBeNull();
    expect(buildBreadcrumbJsonLd({
      locale: 'xx',
      idPath: '/products/prod12345',
      items,
    })).toBeNull();
    expect(buildBreadcrumbJsonLd({
      locale: 'en',
      idPath: '/products/prod12345',
      items: [
        { name: 'Home', path: '' },
        { name: 'Catalog', path: '/catalog?category=fruits' },
        { name: 'Peaches', path: '/products/prod12345' },
      ],
    })).toBeNull();
  });

  it('wires breadcrumbs only on public product, farm, and open request pages', () => {
    const product = readWeb('app/[locale]/products/[id]/page.tsx');
    expect(product).toContain('PublicBreadcrumbs');
    expect(product).toContain('isPubliclyListedProduct(product)');
    expect(product).toContain('buildBreadcrumbJsonLd');
    expect(product).not.toContain('className="eyebrow"');
    expect(product).not.toContain("path: '/catalog?category=");

    const farm = readWeb('app/[locale]/farms/[id]/page.tsx');
    expect(farm).toContain('PublicBreadcrumbs');
    expect(farm).toContain('buildBreadcrumbJsonLd');
    expect(farm).toContain("path: `/farms/${farm.id}`");
    expect(farm).not.toContain("path: '/catalog'");
    expect(readWeb('components/FarmProfileView.tsx')).not.toContain('PublicBreadcrumbs');

    const request = readWeb('app/[locale]/requests/[id]/page.tsx');
    expect(request).toContain("request.status === 'open'");
    expect(request).toContain('buildBreadcrumbJsonLd');
    expect(request).toContain('PublicBreadcrumbs');
    expect(request).toContain('breadcrumbJsonLd ? <JsonLd');

    const component = readWeb('components/PublicBreadcrumbs.tsx');
    expect(component).toContain('<nav');
    expect(component).toContain('<ol');
    expect(component).toContain('aria-current="page"');
    expect(component).not.toContain("'use client'");
    expect(component).not.toContain('apiRequest');

    for (const path of [
      'app/[locale]/page.tsx',
      'app/[locale]/catalog/page.tsx',
      'app/[locale]/buyers/page.tsx',
      'app/[locale]/sellers/page.tsx',
      'app/[locale]/how-it-works/page.tsx',
      'app/[locale]/support/page.tsx',
      'app/[locale]/legal/page.tsx',
      'app/[locale]/terms/page.tsx',
      'app/[locale]/privacy/page.tsx',
    ]) {
      const source = readWeb(path);
      expect(source).not.toContain('PublicBreadcrumbs');
      expect(source).not.toContain('buildBreadcrumbJsonLd');
    }
  });
});
