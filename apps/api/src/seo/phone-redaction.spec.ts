import {
  containsPhoneLikeNumber,
  findPhoneLikeNumbers,
  phoneLikeFieldNames,
  type ProductDetail,
} from '@agrobridge/shared';
import {
  buildBreadcrumbJsonLd,
  buildFarmJsonLd,
  buildProductJsonLd,
} from '../../../web/src/lib/seo-jsonld';
import {
  farmMetadataCopy,
  productMetadataCopy,
  redactPhoneLikeNumbers,
  requestMetadataCopy,
} from '../../../web/src/lib/seo-page-metadata';

jest.mock('next-intl/server', () => ({
  getTranslations: async () => {
    const t = (key: string, values?: Record<string, string>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key;
    return t;
  },
}));

import { productPageMetadata } from '../../../web/src/lib/seo-public-metadata';

const PHONE_TEXTS = [
  'Contact: 591712316',
  'Call 599 12 34 56',
  '599-12-34-56',
  '+995 555 123 456',
  '+995555123456',
  'WhatsApp +49 151 23456789',
  'tel: 032 2 12 34 56',
  '5 9 9 1 2 3 4 5 6',
];

/** Numeric product facts that must never be treated as a phone number. */
const NUMERIC_PRODUCT_FACTS = [
  'Price 25 GEL per kg, minimum order 1200 kg',
  'Price 500000 GEL for 250000 kg',
  'EAN 4860001234567',
  'GlobalGAP GGN 4049929123456',
  'ISO 22000:2018 and HACCP certified',
  'HS code 0808.10, lot 20260915',
  'Harvest 2026, 15-20 tons, caliber 65-70 mm',
  'Brix 12-14, 10 000 kg per week',
  'Pallet 120x80, 1.5 tons, ready 2026-09-15',
  'Moisture 12.5%, protein 11.8%, 1 000 000 kg per season',
];

describe('phone-like number detection', () => {
  it('finds Georgian numbers without +995 and foreign numbers with their prefix', () => {
    for (const text of PHONE_TEXTS) {
      expect(containsPhoneLikeNumber(text)).toBe(true);
    }
  });

  it('ignores prices, quantities, dates, barcodes, standards and certificate numbers', () => {
    for (const text of NUMERIC_PRODUCT_FACTS) {
      expect(findPhoneLikeNumbers(text)).toEqual([]);
    }
    expect(containsPhoneLikeNumber('')).toBe(false);
    expect(containsPhoneLikeNumber(null)).toBe(false);
    expect(containsPhoneLikeNumber(undefined)).toBe(false);
  });

  it('reports exact character ranges', () => {
    const text = 'Apples. Call 599 12 34 56 today';
    const [span] = findPhoneLikeNumbers(text);
    expect(text.slice(span.start, span.end)).toBe('599 12 34 56');
  });

  it('names the flagged fields in the order given', () => {
    expect(
      phoneLikeFieldNames([
        ['title', 'Golden apples'],
        ['description', 'Contact: 591712316'],
        ['variety', null],
        ['originPlace', '+995 555 123 456'],
      ] as const),
    ).toEqual(['description', 'originPlace']);
    expect(phoneLikeFieldNames([['title', 'Hazelnuts 1200 kg']] as const)).toEqual([]);
  });
});

describe('SEO phone redaction', () => {
  it('removes the live listing number and its contact label', () => {
    expect(
      redactPhoneLikeNumbers(
        'For sale in the village of Tortiza, Gori district, are Aydaridi apples, approximately (1.5) tons. Contact: 591712316.',
      ),
    ).toBe(
      'For sale in the village of Tortiza, Gori district, are Aydaridi apples, approximately (1.5) tons.',
    );
  });

  it('removes labelled numbers in several languages and runs of numbers', () => {
    expect(redactPhoneLikeNumbers('Fresh apples. Tel.: 599 12 34 56')).toBe('Fresh apples.');
    expect(redactPhoneLikeNumbers('Яблоки, звоните 599-12-34-56.')).toBe('Яблоки.');
    expect(redactPhoneLikeNumbers('ვაშლი. ტელ: 555 123 456')).toBe('ვაშლი.');
    expect(redactPhoneLikeNumbers('Hazelnuts. WhatsApp +49 151 23456789 or 599 12 34 56.')).toBe(
      'Hazelnuts.',
    );
    expect(redactPhoneLikeNumbers('Honey (599123456) from Kakheti')).toBe('Honey from Kakheti');
  });

  it('leaves text without a phone number byte-for-byte unchanged', () => {
    for (const text of NUMERIC_PRODUCT_FACTS) {
      expect(redactPhoneLikeNumbers(text)).toBe(text);
    }
    expect(redactPhoneLikeNumbers('  spaced  text  ')).toBe('  spaced  text  ');
  });

  it('keeps numeric product facts next to a removed number', () => {
    expect(
      redactPhoneLikeNumbers('Price 25 GEL per kg, minimum 1200 kg, GGN 4049929123456. Call 599 12 34 56'),
    ).toBe('Price 25 GEL per kg, minimum 1200 kg, GGN 4049929123456.');
  });
});

describe('phone-free search metadata', () => {
  const facts = {
    title: 'Aydaridi apples',
    category: 'Fruits',
    place: 'Gori',
    price: 'Price: 1.20 GEL',
    availability: null,
    quantity: 'Quantity: 1500 kg',
    origin: null,
    variety: null,
    season: null,
  };

  it('drops the number from product descriptions and titles', () => {
    const copy = productMetadataCopy({
      ...facts,
      description: 'Approximately (1.5) tons of apples. Contact: 591712316.',
    });
    expect(copy.description).toBe('Approximately (1.5) tons of apples. Price: 1.20 GEL');
    expect(copy.description).not.toMatch(/591712316/);

    const titled = productMetadataCopy({ ...facts, title: 'Apples 599123456', description: null });
    expect(titled.title).toBe('Apples — Fruits — Gori | AgroBridge');
  });

  it('falls back to product facts when the description is only a phone number', () => {
    const copy = productMetadataCopy({ ...facts, description: 'Tel: 599 12 34 56' });
    expect(copy.description).toBe('Price: 1.20 GEL Quantity: 1500 kg');
  });

  it('keeps numeric product facts in descriptions', () => {
    const copy = productMetadataCopy({
      ...facts,
      description: 'GlobalGAP GGN 4049929123456, EAN 4860001234567, harvest 2026, 15-20 tons.',
    });
    expect(copy.description).toContain('GGN 4049929123456');
    expect(copy.description).toContain('EAN 4860001234567');
    expect(copy.description).toContain('15-20 tons');
  });

  it('drops numbers from farm and purchase-request descriptions', () => {
    const farm = farmMetadataCopy({
      name: 'Gori Orchard',
      region: 'Shida Kartli',
      description: 'Family orchard since 1998. Call +995 555 123 456.',
      fallback: 'fallback',
      categories: null,
      exports: null,
      verified: null,
    });
    expect(farm.description).toBe('Family orchard since 1998.');

    const request = requestMetadataCopy({
      title: 'Walnuts',
      category: null,
      destination: null,
      message: 'Need 20 tons monthly, WhatsApp 599 12 34 56',
      fallback: 'fallback',
      quantity: null,
      variety: null,
      packaging: null,
    });
    expect(request.description).toBe('Need 20 tons monthly');
  });

  it('drops numbers from Product, farm and breadcrumb structured data only', () => {
    const product = buildProductJsonLd(
      {
        id: 'prod12345',
        title: 'Apples 599123456',
        description: 'Approximately (1.5) tons. Contact: 591712316.',
        isPublished: true,
        moderationStatus: 'approved',
        images: null,
      },
      'en',
    );
    expect(product?.name).toBe('Apples');
    expect(product?.description).toBe('Approximately (1.5) tons.');

    const onlyPhone = buildProductJsonLd(
      {
        id: 'prod12345',
        title: 'Apples',
        description: 'Tel: 599 12 34 56',
        isPublished: true,
        moderationStatus: 'approved',
        images: null,
      },
      'en',
    );
    expect(onlyPhone).not.toHaveProperty('description');

    const farm = buildFarmJsonLd(
      { id: 'farm12345', name: 'Gori Orchard', description: 'Orchard. Viber 599 12 34 56' },
      'en',
    );
    expect(farm?.description).toBe('Orchard.');

    const breadcrumb = buildBreadcrumbJsonLd({
      locale: 'en',
      idPath: '/products/prod12345',
      items: [
        { name: 'Catalog', path: '/catalog' },
        { name: 'Apples 599123456', path: '/products/prod12345' },
      ],
    });
    expect(JSON.stringify(breadcrumb)).not.toContain('599123456');
  });

  it('keeps the visible listing fields of the product untouched', async () => {
    const product = {
      id: 'prod12345',
      title: 'Apples',
      description: 'Approximately (1.5) tons. Contact: 591712316.',
      isPublished: true,
      moderationStatus: 'approved',
      images: [{ id: 'img1', url: '/api/uploads/products/prod12345/a.jpg', sortOrder: 0 }],
      seasonMonths: [],
      farm: null,
    } as unknown as ProductDetail;
    const before = JSON.stringify(product);
    const metadata = await productPageMetadata(product, 'en');
    expect(String(metadata.description)).not.toContain('591712316');
    expect(String(metadata.openGraph?.description)).not.toContain('591712316');
    expect(JSON.stringify(product)).toBe(before);
    expect(product.description).toContain('591712316');
  });
});
