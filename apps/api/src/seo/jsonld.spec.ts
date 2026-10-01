import { readFileSync } from 'fs';
import { join } from 'path';
import type { ProductImage } from '@agrobridge/shared';
import {
  buildBreadcrumbJsonLd,
  buildFarmJsonLd,
  buildFarmPageJsonLd,
  buildHomeJsonLd,
  buildProductJsonLd,
  buildProductPageJsonLd,
  farmOrganizationId,
  type FarmJsonLdSource,
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

function fixedPriceProduct(overrides: Partial<ProductJsonLdSource> = {}): ProductJsonLdSource {
  return publicProduct({
    priceFrom: 4.5,
    priceCurrency: 'EUR',
    priceNegotiable: false,
    priceDependsOnVolume: false,
    harvestStatus: 'available',
    preorderEnabled: false,
    farm: { id: 'farm12345' },
    ...overrides,
  });
}

const FARM_ORGANIZATION_ID = 'https://agrobridge.ge/en/farms/farm12345#organization';
const AGROBRIDGE_ORGANIZATION_ID = 'https://agrobridge.ge/#organization';

const FORBIDDEN_HOME_KEYS = [
  'sameAs',
  'telephone',
  'contactPoint',
  'taxID',
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
  'shippingDetails',
  'hasMerchantReturnPolicy',
  'offeredBy',
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
    expect(kaGraph).toHaveLength(3);
    expect(enGraph.map((node) => node['@type'])).toEqual(['WebSite', 'Organization', 'WebPage']);

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
    const stableOrganization = {
      '@type': 'Organization',
      '@id': 'https://agrobridge.ge/#organization',
      name: 'AgroBridge',
      legalName: 'P/E VANO MEGVINETUKHUTSESI',
      url: 'https://agrobridge.ge/',
      description:
        'AgroBridge is a Georgian B2B agricultural marketplace connecting Georgian farms and agricultural producers with buyers in Georgia and international markets.',
      email: 'Support@agrobridge.ge',
      identifier: {
        '@type': 'PropertyValue',
        name: 'Identification Number',
        value: '01501157152',
      },
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Adam Mitskevichi St. 29/5',
        addressLocality: 'Tbilisi',
        addressCountry: 'GE',
      },
      areaServed: [
        { '@type': 'Country', name: 'Georgia' },
        { '@type': 'Place', name: 'International markets' },
      ],
      logo: {
        '@type': 'ImageObject',
        url: 'https://agrobridge.ge/brand/agrobridge-logo.png',
        width: 1773,
        height: 887,
      },
    };
    expect(kaGraph[1]).toEqual({
      ...stableOrganization,
      slogan: 'ქართული მეურნეობები. გლობალური მყიდველები.',
    });
    expect(enGraph[1]).toEqual({
      ...stableOrganization,
      slogan: 'Georgian farms. Global buyers.',
    });
    expect(JSON.stringify(kaGraph[1])).not.toContain('sameAs');
    expect(JSON.stringify(enGraph[1])).not.toContain('company');
    expect(kaGraph.filter((node) => node['@type'] === 'Organization')).toHaveLength(1);
    expect(kaGraph.filter((node) => node['@type'] === 'WebSite')).toHaveLength(1);
    expect(kaGraph.filter((node) => node['@type'] === 'WebPage')).toHaveLength(1);
    expect(kaGraph[2]).toEqual({
      '@type': 'WebPage',
      '@id': 'https://agrobridge.ge/ka#webpage',
      url: 'https://agrobridge.ge/ka',
      inLanguage: 'ka',
      isPartOf: { '@id': 'https://agrobridge.ge/#website' },
      about: { '@id': 'https://agrobridge.ge/#organization' },
    });
    expect(enGraph[2]).toMatchObject({
      '@id': 'https://agrobridge.ge/en#webpage',
      url: 'https://agrobridge.ge/en',
      inLanguage: 'en',
      isPartOf: { '@id': 'https://agrobridge.ge/#website' },
      about: { '@id': 'https://agrobridge.ge/#organization' },
    });

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

  it('emits an Offer for a fixed public starting price', () => {
    const data = buildProductJsonLd(fixedPriceProduct(), 'de');
    const offer = data?.offers as Record<string, unknown>;

    expect(offer).toEqual({
      '@type': 'Offer',
      price: 4.5,
      priceCurrency: 'EUR',
      url: 'https://agrobridge.ge/de/products/prod12345',
      availability: 'https://schema.org/InStock',
      seller: { '@id': FARM_ORGANIZATION_ID },
    });
    expect(typeof offer.price).toBe('number');
    expect(offer).not.toHaveProperty('priceSpecification');
    expect(data).not.toHaveProperty('availability');
    expect(JSON.stringify(data)).not.toContain(AGROBRIDGE_ORGANIZATION_ID);
    expect(JSON.stringify(data)).not.toContain('P/E VANO');
    expect(JSON.stringify(data)).not.toContain('offeredBy');
  });

  it('points seller at the farm organization and omits seller when the farm is missing', () => {
    const withFarm = buildProductJsonLd(fixedPriceProduct(), 'en');
    expect((withFarm?.offers as { seller: { '@id': string } }).seller['@id']).toBe(
      farmOrganizationId('farm12345'),
    );
    expect((withFarm?.offers as { seller: { '@id': string } }).seller['@id']).not.toBe(
      AGROBRIDGE_ORGANIZATION_ID,
    );

    for (const farm of [null, undefined, { id: '   ' }]) {
      const data = buildProductJsonLd(fixedPriceProduct({ farm }), 'en');
      const offer = data?.offers as Record<string, unknown>;
      expect(offer).toMatchObject({
        '@type': 'Offer',
        price: 4.5,
        priceCurrency: 'EUR',
      });
      expect(offer).not.toHaveProperty('seller');
      expect(JSON.stringify(data)).not.toContain(AGROBRIDGE_ORGANIZATION_ID);
    }
  });

  it('omits the Offer for negotiable, volume-dependent, and invalid prices', () => {
    const cases: ProductJsonLdSource[] = [
      fixedPriceProduct({ priceNegotiable: true }),
      fixedPriceProduct({ priceDependsOnVolume: true }),
      fixedPriceProduct({ priceNegotiable: true, priceDependsOnVolume: true }),
      fixedPriceProduct({ priceFrom: null, priceCurrency: null }),
      fixedPriceProduct({ priceFrom: 0 }),
      fixedPriceProduct({ priceFrom: -1 }),
      fixedPriceProduct({ priceFrom: Number.NaN }),
      fixedPriceProduct({ priceFrom: Number.POSITIVE_INFINITY }),
      fixedPriceProduct({ priceCurrency: 'GBP' }),
      fixedPriceProduct({ priceCurrency: '' }),
      fixedPriceProduct({ priceCurrency: null }),
      fixedPriceProduct({ priceNegotiable: undefined, priceDependsOnVolume: undefined }),
    ];

    for (const product of cases) {
      const data = buildProductJsonLd(product, 'en');
      expect(data?.['@type']).toBe('Product');
      expect(data).not.toHaveProperty('offers');
      expect(keysDeep(data)).not.toContain('price');
      expect(keysDeep(data)).not.toContain('priceCurrency');
      expect(keysDeep(data)).not.toContain('seller');
      expect(keysDeep(data)).not.toContain('availability');
    }
  });

  it('maps harvest status to availability and never uses stock', () => {
    const cases: Array<{
      harvestStatus: string | null;
      preorderEnabled?: boolean;
      currentStock?: number | null;
      availability?: string;
    }> = [
      { harvestStatus: 'available', availability: 'https://schema.org/InStock' },
      { harvestStatus: 'available', currentStock: 0, availability: 'https://schema.org/InStock' },
      { harvestStatus: 'available', currentStock: null, availability: 'https://schema.org/InStock' },
      { harvestStatus: 'limited', availability: 'https://schema.org/LimitedAvailability' },
      { harvestStatus: 'soldOut', currentStock: 100, availability: 'https://schema.org/SoldOut' },
      {
        harvestStatus: 'growing',
        preorderEnabled: true,
        availability: 'https://schema.org/PreOrder',
      },
      { harvestStatus: 'growing', preorderEnabled: false },
      { harvestStatus: 'growing' },
      { harvestStatus: null },
    ];

    for (const item of cases) {
      const product = {
        ...fixedPriceProduct({
          harvestStatus: item.harvestStatus,
          preorderEnabled: item.preorderEnabled,
        }),
        currentStock: item.currentStock,
      };
      const offer = buildProductJsonLd(product, 'en')?.offers as Record<string, unknown>;
      if (item.availability) {
        expect(offer.availability).toBe(item.availability);
      } else {
        expect(offer).not.toHaveProperty('availability');
      }
      expect(keysDeep(offer)).not.toContain('inventoryLevel');
      expect(JSON.stringify(offer)).not.toContain('currentStock');
    }
  });

  it('does not emit ratings, identifiers, or merchant-listing commercial fields', () => {
    const product = {
      ...fixedPriceProduct({ description: null, images: [] }),
      sellerRating: { average: 4.5, count: 3 },
      moderationNote: 'internal note',
      ownerUserId: 'owner12345',
      variety: 'Freestone',
      qualityScore: { score: 80 },
      opportunity: { tier: 'good' },
      brand: 'Estate',
      sku: 'SKU-1',
      gtin: '00012345678905',
      mpn: 'MPN-1',
    };
    const data = buildProductJsonLd(product, 'de');
    const allowed = new Set(['offers', 'price', 'priceCurrency', 'seller', 'availability']);
    for (const key of FORBIDDEN_PRODUCT_KEYS) {
      if (allowed.has(key)) continue;
      expect(keysDeep(data)).not.toContain(key);
    }
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain('internal note');
    expect(serialized).not.toContain('owner12345');
    expect(serialized).not.toContain('Freestone');
    expect(serialized).not.toContain('Estate');
    expect(serialized).not.toContain('SKU-1');
    expect(serialized).not.toContain('00012345678905');
    expect(serialized).not.toContain('MPN-1');
    expect(serialized).not.toContain('shippingDetails');
    expect(serialized).not.toContain('hasMerchantReturnPolicy');
    expect(serialized).not.toContain('aggregateRating');
    expect(serialized).not.toContain('inventoryLevel');
    expect(serialized).not.toContain('priceSpecification');
  });
});

describe('farm JSON-LD', () => {
  function publicFarm(overrides: Partial<FarmJsonLdSource> = {}): FarmJsonLdSource {
    return {
      id: 'farm12345',
      name: 'Kakheti Qvevri Cellar',
      description: 'Traditional qvevri wines.',
      region: 'kakheti',
      foundedYear: 2001,
      companyRegistryName: 'Kakheti Qvevri LLC',
      photos: [
        { url: '/api/uploads/farms/farm12345/cellar.jpg', sortOrder: 0 },
      ],
      ...overrides,
    };
  }

  it('describes the farm as an Organization with a stable English id', () => {
    const en = buildFarmJsonLd(publicFarm(), 'en');
    const ru = buildFarmJsonLd(
      publicFarm({
        display: { description: 'Традиционные вина квеври.' },
      }),
      'ru',
    );

    expect(en).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': FARM_ORGANIZATION_ID,
      url: 'https://agrobridge.ge/en/farms/farm12345',
      name: 'Kakheti Qvevri Cellar',
      description: 'Traditional qvevri wines.',
      image: ['https://agrobridge.ge/api/uploads/farms/farm12345/cellar.jpg'],
      foundingDate: '2001',
      legalName: 'Kakheti Qvevri LLC',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'Kakheti',
        addressCountry: 'GE',
      },
    });
    expect(en?.['@type']).not.toBe('Farm');
    expect(en?.['@type']).not.toBe('LocalBusiness');
    expect(ru).toMatchObject({
      '@id': FARM_ORGANIZATION_ID,
      url: 'https://agrobridge.ge/ru/farms/farm12345',
      description: 'Традиционные вина квеври.',
      address: {
        addressRegion: 'Кахетия',
        addressCountry: 'GE',
      },
    });
    expect(Object.keys(en?.address as object).sort()).toEqual([
      '@type',
      'addressCountry',
      'addressRegion',
    ]);
    const serialized = JSON.stringify(en);
    expect(serialized).not.toContain('streetAddress');
    expect(serialized).not.toContain('postalCode');
    expect(serialized).not.toContain('telephone');
    expect(serialized).not.toContain('email');
    expect(serialized).not.toContain('geo');
    expect(serialized).not.toContain(AGROBRIDGE_ORGANIZATION_ID);
  });

  it('omits address, founding date, legal name, and photos that are not public', () => {
    const data = buildFarmJsonLd(
      publicFarm({
        region: 'not-a-region',
        foundedYear: null,
        companyRegistryName: '   ',
        photos: [{ url: '/api/uploads/farms/farm12345/documents/secret.pdf', sortOrder: 0 }],
        description: '   ',
      }),
      'en',
    );
    expect(data).not.toHaveProperty('address');
    expect(data).not.toHaveProperty('foundingDate');
    expect(data).not.toHaveProperty('legalName');
    expect(data).not.toHaveProperty('image');
    expect(data).not.toHaveProperty('description');
    expect(data?.['@type']).toBe('Organization');
  });

  it('does not expose owner, registry number, verification, or ratings', () => {
    const farm = {
      ...publicFarm({ region: null, photos: [] }),
      owner: { id: 'user12345', displayName: 'Tanya Private' },
      verificationStatus: 'approved',
      verified: true,
      verificationNote: 'internal verification note',
      companyRegistrationNumber: '01501157152',
      documents: [{ url: '/api/uploads/farms/farm12345/documents/license.pdf' }],
    };
    const data = buildFarmJsonLd(farm, 'ka');
    const serialized = JSON.stringify(data);
    expect(data?.address).toBeUndefined();
    expect(serialized).not.toContain('Tanya Private');
    expect(serialized).not.toContain('user12345');
    expect(serialized).not.toContain('internal verification note');
    expect(serialized).not.toContain('01501157152');
    expect(serialized).not.toContain('license.pdf');
    expect(serialized).not.toContain('aggregateRating');
    expect(serialized).not.toContain('review');
    expect(serialized).not.toContain('LocalBusiness');
    expect(serialized).not.toContain('"Farm"');
    expect(data?.['@id']).toBe(FARM_ORGANIZATION_ID);
    expect(data?.address).toBeUndefined();
  });

  it('uses the same farm @id as a product Offer seller', () => {
    const product = buildProductJsonLd(fixedPriceProduct(), 'fr');
    const farm = buildFarmJsonLd(publicFarm(), 'fr');
    const sellerId = (product?.offers as { seller: { '@id': string } }).seller['@id'];
    expect(sellerId).toBe(farm?.['@id']);
    expect(sellerId).toBe(farmOrganizationId('farm12345'));
    expect(farm?.url).toBe('https://agrobridge.ge/fr/farms/farm12345');
  });
});

describe('JSON-LD page wiring', () => {
  it('renders homepage JSON-LD and product JSON-LD only for a public listing', () => {
    const home = readWeb('app/[locale]/page.tsx');
    expect(home).toContain('buildHomeJsonLd');
    expect(home).toContain('<JsonLd');
    expect(home).not.toContain('application/ld+json');

    const product = readWeb('app/[locale]/products/[id]/page.tsx');
    expect(product).toContain('buildProductPageJsonLd(product, locale, breadcrumbJsonLd)');
    expect(product).toContain('productPageJsonLd ? <JsonLd');
    expect(product).not.toContain('productJsonLd ? <JsonLd');
    expect(product).not.toContain('noindexFollowRobots');
    expect(product).not.toContain('index: false');

    const builder = readWeb('lib/seo-jsonld.ts');
    expect(builder).toContain('isPubliclyListedProduct');
    expect(builder).toContain("'@type': 'Offer'");
    expect(builder).toContain('data.offers = offer');
    expect(builder).not.toContain('aggregateRating');
    expect(builder).not.toContain('shippingDetails');
    expect(builder).not.toContain('hasMerchantReturnPolicy');
    expect(builder).not.toContain('inventoryLevel');

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
      builder.indexOf('export function buildFarmJsonLd'),
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
    expect(farm).toContain('buildFarmPageJsonLd(farm, locale, breadcrumbJsonLd)');
    expect(farm).toContain('farmPageJsonLd ? <JsonLd');
    expect(farm).not.toContain('farmJsonLd ? <JsonLd');
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
      'app/[locale]/catalog/page.tsx',
      'app/[locale]/requests/page.tsx',
      'app/[locale]/requests/[id]/page.tsx',
      'app/[locale]/users/[id]/page.tsx',
      'app/[locale]/login/page.tsx',
      'app/[locale]/register/page.tsx',
      'app/[locale]/dashboard/layout.tsx',
      'app/[locale]/account/layout.tsx',
      'app/[locale]/requests/new/page.tsx',
    ]) {
      expect(readWeb(path)).not.toContain('#webpage');
      expect(readWeb(path)).not.toContain('buildProductPageJsonLd');
      expect(readWeb(path)).not.toContain('buildFarmPageJsonLd');
    }

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

function graphOf(data: Record<string, unknown> | null): Array<Record<string, unknown>> {
  return (data?.['@graph'] as Array<Record<string, unknown>> | undefined) ?? [];
}

function nodeOf(graph: Array<Record<string, unknown>>, type: string): Record<string, unknown> {
  const matches = graph.filter((node) => node['@type'] === type);
  expect(matches).toHaveLength(1);
  return matches[0];
}

describe('webpage JSON-LD', () => {
  function productCrumb(locale: 'en' | 'ru') {
    return buildBreadcrumbJsonLd({
      locale,
      idPath: '/products/prod12345',
      items: [
        { name: 'Home', path: '' },
        { name: 'Catalog', path: '/catalog' },
        { name: 'Fresh Kakheti peaches', path: '/products/prod12345' },
      ],
    });
  }

  it('links a localized product page to the stable product, breadcrumb, website, and farm ids', () => {
    const source = publicProduct({ farm: { id: 'farm12345' } });
    const crumb = productCrumb('ru');
    const page = buildProductPageJsonLd(source, 'ru', crumb);
    const graph = graphOf(page);
    expect(graph.map((node) => node['@type'])).toEqual(['Product', 'BreadcrumbList', 'WebPage']);
    expect(graph.filter((node) => node['@type'] === 'WebSite')).toHaveLength(0);
    expect(graph.filter((node) => node['@type'] === 'Organization')).toHaveLength(0);

    const product = nodeOf(graph, 'Product');
    const standalone = buildProductJsonLd(source, 'ru');
    expect(standalone).not.toBeNull();
    const { '@context': _productContext, ...productNode } = standalone ?? {};
    expect(product).toEqual(productNode);
    expect(product['@id']).toBe('https://agrobridge.ge/en/products/prod12345#product');
    expect(product).not.toHaveProperty('offers');
    expect(product).not.toHaveProperty('brand');
    expect(product).not.toHaveProperty('manufacturer');

    const webpage = nodeOf(graph, 'WebPage');
    expect(webpage).toEqual({
      '@type': 'WebPage',
      '@id': 'https://agrobridge.ge/ru/products/prod12345#webpage',
      url: 'https://agrobridge.ge/ru/products/prod12345',
      inLanguage: 'ru',
      isPartOf: { '@id': 'https://agrobridge.ge/#website' },
      mainEntity: { '@id': 'https://agrobridge.ge/en/products/prod12345#product' },
      breadcrumb: { '@id': 'https://agrobridge.ge/en/products/prod12345#breadcrumb' },
      about: { '@id': FARM_ORGANIZATION_ID },
    });
    expect(nodeOf(graph, 'BreadcrumbList')['@id']).toBe(
      'https://agrobridge.ge/en/products/prod12345#breadcrumb',
    );
  });

  it('keeps the existing Offer on a fixed-price product and omits about when there is no farm', () => {
    const source = fixedPriceProduct({ farm: null });
    const page = buildProductPageJsonLd(source, 'en', productCrumb('en'));
    const graph = graphOf(page);
    const product = nodeOf(graph, 'Product');
    const standalone = buildProductJsonLd(source, 'en');
    expect(product.offers).toEqual(
      (standalone as { offers: unknown } | null)?.offers,
    );
    expect(nodeOf(graph, 'WebPage')).not.toHaveProperty('about');
    expect(JSON.stringify(page)).not.toContain('brand');
    expect(JSON.stringify(page)).not.toContain('manufacturer');
    expect(JSON.stringify(page)).not.toContain('aggregateRating');
    expect(JSON.stringify(page)).not.toContain('inventoryLevel');
    expect(JSON.stringify(page)).not.toContain('shippingDetails');
    expect(JSON.stringify(page)).not.toContain('hasMerchantReturnPolicy');
    expect(JSON.stringify(page)).not.toContain('LocalBusiness');
    expect(JSON.stringify(page)).not.toContain('sameAs');
    expect(JSON.stringify(page)).not.toContain('SearchAction');
  });

  it('does not build a product page graph for a private or unknown listing', () => {
    const crumb = productCrumb('en');
    expect(buildProductPageJsonLd(publicProduct({ isPublished: false }), 'en', crumb)).toBeNull();
    expect(buildProductPageJsonLd(publicProduct(), 'xx', crumb)).toBeNull();
  });

  it('links a localized farm page without making the farm a subsidiary', () => {
    const farm = {
      id: 'farm12345',
      name: 'Kakheti Qvevri Cellar',
      description: 'Traditional qvevri wines.',
      region: 'kakheti',
      foundedYear: 2001,
      companyRegistryName: 'Kakheti Qvevri LLC',
      photos: [{ url: '/api/uploads/farms/farm12345/cellar.jpg', sortOrder: 0 }],
    };
    const crumb = buildBreadcrumbJsonLd({
      locale: 'de',
      idPath: '/farms/farm12345',
      items: [
        { name: 'Startseite', path: '' },
        { name: 'Kakheti Qvevri Cellar', path: '/farms/farm12345' },
      ],
    });
    const page = buildFarmPageJsonLd(farm, 'de', crumb);
    const graph = graphOf(page);
    expect(graph.map((node) => node['@type'])).toEqual([
      'Organization',
      'BreadcrumbList',
      'WebPage',
    ]);
    expect(graph.filter((node) => node['@type'] === 'WebSite')).toHaveLength(0);
    expect(graph.filter((node) => node['@type'] === 'Organization')).toHaveLength(1);
    expect(graph.filter((node) => node['@type'] === 'WebPage')).toHaveLength(1);

    const organization = nodeOf(graph, 'Organization');
    const standalone = buildFarmJsonLd(farm, 'de');
    expect(standalone).not.toBeNull();
    const { '@context': _farmContext, ...farmNode } = standalone ?? {};
    expect(organization).toEqual(farmNode);
    expect(organization['@id']).toBe(FARM_ORGANIZATION_ID);

    expect(nodeOf(graph, 'WebPage')).toEqual({
      '@type': 'WebPage',
      '@id': 'https://agrobridge.ge/de/farms/farm12345#webpage',
      url: 'https://agrobridge.ge/de/farms/farm12345',
      inLanguage: 'de',
      isPartOf: { '@id': 'https://agrobridge.ge/#website' },
      mainEntity: { '@id': FARM_ORGANIZATION_ID },
      breadcrumb: { '@id': 'https://agrobridge.ge/en/farms/farm12345#breadcrumb' },
    });

    const serialized = JSON.stringify(page);
    expect(serialized).not.toContain('parentOrganization');
    expect(serialized).not.toContain('LocalBusiness');
    expect(serialized).not.toContain('"Place"');
    expect(serialized).not.toContain('founder');
    expect(serialized).not.toContain('employee');
    expect(serialized).not.toContain('aggregateRating');
    expect(serialized).not.toContain('geo');
    expect(serialized).not.toContain('owner');
    expect(serialized).not.toContain(AGROBRIDGE_ORGANIZATION_ID);
  });
});
