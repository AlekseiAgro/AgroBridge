import { readFileSync } from 'fs';
import { join } from 'path';
import {
  formatListedPrice,
  harvestPreorderMessageKey,
} from '@agrobridge/shared';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

type Nested = Record<string, unknown>;

function messages(locale: string): Nested {
  return JSON.parse(readFileSync(join(WEB, 'messages', `${locale}.json`), 'utf8')) as Nested;
}

function read(obj: Nested, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Nested)[key];
  }, obj);
  if (typeof value !== 'string') {
    throw new Error(`Missing string ${path}`);
  }
  return value;
}

function source(name: string): string {
  return readFileSync(join(WEB, 'src', name), 'utf8');
}

describe('catalog listed price', () => {
  it('formats price + currency + unit without converting currency or unit', () => {
    expect(
      formatListedPrice({ priceFrom: 4.5, priceCurrency: 'EUR', unit: 'kg' }),
    ).toBe('€ 4.50 / kg');
    expect(
      formatListedPrice({ priceFrom: 2.8, priceCurrency: 'USD', unit: 'kg' }),
    ).toBe('$ 2.80 / kg');
    expect(
      formatListedPrice({ priceFrom: 5.5, priceCurrency: 'GEL', unit: 'bottle' }),
    ).toBe('₾ 5.50 / bottle');
    expect(
      formatListedPrice({ priceFrom: 12, priceCurrency: 'EUR', unit: 'box' }),
    ).toBe('€ 12.00 / box');
    expect(
      formatListedPrice({ priceFrom: 40.8, priceCurrency: 'EUR', unit: 'liter' }),
    ).toBe('€ 40.80 / liter');
  });

  it('does not invent a price when the listing has none', () => {
    expect(formatListedPrice({ priceFrom: null, priceCurrency: 'EUR', unit: 'kg' })).toBeNull();
    expect(formatListedPrice({ priceFrom: 0, priceCurrency: 'EUR', unit: 'kg' })).toBeNull();
    expect(formatListedPrice({ priceFrom: 4.5, priceCurrency: null, unit: 'kg' })).toBeNull();
  });

  it('does not use Market Insight or a hardcoded EUR fallback', () => {
    const helper = readFileSync(join(__dirname, '../../../../packages/shared/src/product-price.ts'), 'utf8');
    expect(helper).not.toContain('opportunity');
    expect(helper).not.toContain('evaluateMarketOpportunity');
    expect(helper).not.toContain("?? 'EUR'");
    expect(source('app/[locale]/catalog/page.tsx')).not.toContain('opportunity.price');
    expect(source('app/[locale]/catalog/page.tsx')).toContain('formatListedPrice(product)');
    expect(source('app/[locale]/catalog/page.tsx')).toContain("t('priceOnRequest')");
  });

  it('keeps product detail on the same listed-price formatter', () => {
    const detail = source('app/[locale]/products/[id]/page.tsx');
    expect(detail).toContain('formatListedPrice(product)');
    expect(detail).toContain("t('priceFrom')");
  });
});

describe('Available / Pre-order presentation', () => {
  it('keeps harvest status and pre-order as independent capabilities', () => {
    expect(harvestPreorderMessageKey('available')).toBe('filterPreorder');
    expect(harvestPreorderMessageKey('growing')).toBe('preorderBadge');
    expect(harvestPreorderMessageKey('limited')).toBe('preorderBadge');
    expect(harvestPreorderMessageKey('soldOut')).toBe('preorderBadge');
    expect(harvestPreorderMessageKey(null)).toBe('preorderBadge');
  });

  it('does not change harvest status copy', () => {
    expect(read(messages('en'), 'harvest.status.available')).toBe('Available');
    expect(read(messages('en'), 'harvest.status.growing')).toBe('Growing');
    expect(read(messages('en'), 'harvest.status.limited')).toBe('Limited');
    expect(read(messages('en'), 'harvest.status.soldOut')).toBe('Sold out');
  });

  it('wires the badge to the additive pre-order label when stock is available', () => {
    const badge = source('components/HarvestStatusBadge.tsx');
    expect(badge).toContain('harvestPreorderMessageKey');
    expect(badge).toContain('preorderEnabled');
  });
});

describe('catalog price and harvest chrome locales', () => {
  it('keeps English as the canonical source', () => {
    expect(read(messages('en'), 'catalog.priceOnRequest')).toBe('Price on request');
    expect(read(messages('en'), 'harvest.filterPreorder')).toBe('Pre-order available');
  });

  it.each(LOCALES)('%s has catalog price-on-request and harvest pre-order keys', (locale) => {
    expect(read(messages(locale), 'catalog.priceOnRequest').trim().length).toBeGreaterThan(0);
    expect(read(messages(locale), 'harvest.filterPreorder').trim().length).toBeGreaterThan(0);
    expect(read(messages(locale), 'harvest.preorderBadge').trim().length).toBeGreaterThan(0);
    expect(read(messages(locale), 'harvest.status.available').trim().length).toBeGreaterThan(0);
  });

  it.each(['ka', 'ru', 'de', 'fr', 'it', 'es'] as const)(
    '%s does not fall back to English for price-on-request',
    (locale) => {
      expect(read(messages(locale), 'catalog.priceOnRequest')).not.toBe('Price on request');
    },
  );
});
