import { parseCatalogProducts, parseCatalogRequests, primaryProductImageUrl } from './model';
import {
  filterCatalogProducts,
  filterCatalogRequests,
  normalizeSearchText,
  productsPath,
  purchaseRequestsPath,
  unionById,
} from './query';
import type { CatalogProduct, CatalogRequest } from './model';

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 'p1',
    title: 'Горный мёд',
    description: null,
    category: 'honey',
    variety: null,
    country: 'Georgia',
    originPlace: null,
    unit: 'kg',
    minQuantity: null,
    maxQuantity: null,
    harvestStatus: 'available',
    priceFrom: null,
    priceCurrency: null,
    images: [],
    updatedAt: null,
    owner: { id: 'u1', displayName: null },
    farm: null,
    sourceTitle: null,
    source: null,
    ...overrides,
  };
}

function request(overrides: Partial<CatalogRequest> = {}): CatalogRequest {
  return {
    id: 'r1',
    title: 'Столовый виноград, поздний сезон',
    category: 'fruits',
    quantity: '800',
    unit: 'kg',
    variety: null,
    packaging: null,
    destinationCountry: null,
    message: null,
    status: 'open',
    createdAt: null,
    buyer: { id: 'b1', displayName: null },
    sourceTitle: null,
    source: null,
    ...overrides,
  };
}

describe('catalog search', () => {
  it('treats е and ё as the same letter', () => {
    expect(normalizeSearchText('  МЁД  ')).toBe('мед');
    expect(filterCatalogProducts([product()], 'мед').map((item) => item.id)).toEqual(['p1']);
    expect(filterCatalogProducts([product({ title: 'Натуральный мед' })], 'мёд')).toHaveLength(1);
  });

  it('is case-insensitive and collapses whitespace', () => {
    expect(normalizeSearchText('  Table   Grapes  ')).toBe('table grapes');
    expect(filterCatalogRequests([request()], '  ВИНОГРАД ')).toHaveLength(1);
  });

  it('normalizes Unicode before matching', () => {
    const composed = 'мёд';
    const decomposed = 'м\u0435\u0308д';
    expect(normalizeSearchText(decomposed)).toBe(normalizeSearchText(composed));
  });

  it('builds the same list endpoints the web catalog uses', () => {
    expect(productsPath({})).toBe('/products');
    expect(productsPath({ categoryId: 'fruits' })).toBe('/products?category=fruits');
    expect(productsPath({ categoryId: 'honey', query: '  мёд  ' })).toBe(
      '/products?category=honey&q=%D0%BC%D1%91%D0%B4',
    );
    expect(productsPath({ locale: 'ru', query: 'виноград' })).toBe(
      '/products?q=%D0%B2%D0%B8%D0%BD%D0%BE%D0%B3%D1%80%D0%B0%D0%B4&locale=ru',
    );
    expect(purchaseRequestsPath({})).toBe('/purchase-requests');
    expect(purchaseRequestsPath({ categoryId: 'fruits', query: 'виноград' })).toBe(
      '/purchase-requests?category=fruits&q=%D0%B2%D0%B8%D0%BD%D0%BE%D0%B3%D1%80%D0%B0%D0%B4',
    );
  });

  it('keeps API order and appends only new server matches', () => {
    const local = [product({ id: 'local' })];
    const server = [product({ id: 'local', title: 'other' }), product({ id: 'server', title: 'Peaches' })];
    expect(unionById(local, server).map((item) => item.id)).toEqual(['local', 'server']);
  });
});

describe('catalog parsing', () => {
  it('reads product photos and ignores category showcase images', () => {
    const [parsed] = parseCatalogProducts([
      {
        id: 'p1',
        title: 'თაფლი',
        priceFrom: '12.50',
        priceCurrency: 'GEL',
        images: [
          { id: 'cat', url: '/images/categories/honey.jpg', isPrimary: true, sortOrder: 0 },
          { id: 'photo', url: '/api/uploads/products/p1/honey.jpg', isPrimary: false, sortOrder: 1 },
        ],
        farm: { id: 'f1', name: 'Farm', region: 'kakheti', verified: true },
        owner: { id: 'u1', displayName: 'Nino' },
      },
    ]);
    expect(parsed?.title).toBe('თაფლი');
    expect(parsed?.priceFrom).toBe(12.5);
    expect(primaryProductImageUrl(parsed?.images ?? [])).toBe('/api/uploads/products/p1/honey.jpg');
    expect(parsed?.farm?.verified).toBe(true);
  });

  it('keeps the stored cultivar and the detail fields the catalog card does not show', () => {
    const [parsed] = parseCatalogProducts([
      {
        id: 'p1',
        title: 'Peach',
        variety: 'Киси',
        display: { title: 'Peach', variety: 'Kisi', description: 'Translated' },
        source: { locale: 'ka', title: 'ატამი', variety: 'Киси', description: 'ორიგინალი' },
        description: 'Translated',
        currentStock: 40,
        seasonMonths: [6, 7],
        packagingTypes: ['box'],
        incoterms: ['EXW'],
        producerType: 'family',
        sellerRating: { average: 4.5, count: 2 },
        farm: {
          id: 'f1',
          name: 'Farm',
          region: 'kakheti',
          verified: true,
          producerType: 'family',
        },
        owner: { id: 'u1', displayName: 'Nino' },
      },
    ]);
    expect(parsed?.variety).toBe('Киси');
    expect(parsed?.source?.variety).toBe('Киси');
    expect(parsed?.description).toBe('Translated');
    expect(parsed?.currentStock).toBe(40);
    expect(parsed?.seasonMonths).toEqual([6, 7]);
    expect(parsed?.packagingTypes).toEqual(['box']);
    expect(parsed?.incoterms).toEqual(['EXW']);
    expect(parsed?.sellerRating).toEqual({ average: 4.5, count: 2 });
    expect(parsed?.farm?.producerType).toBe('family');
  });

  it('rejects a non-list payload instead of treating it as an empty catalog', () => {
    expect(() => parseCatalogProducts({ items: [] })).toThrow('Products response was not a list.');
    expect(() => parseCatalogRequests(null)).toThrow('Purchase requests response was not a list.');
  });
});
