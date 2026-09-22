import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CURRENCIES,
  formatListedPrice,
  isCurrencyCode,
  isProductUnit,
} from '@agrobridge/shared';
import { DEMO_CATALOG_PRICES, demoCatalogPrice } from './demo-catalog-prices';

const API_ROOT = join(__dirname, '../..');

function source(rel: string): string {
  return readFileSync(join(API_ROOT, rel), 'utf8');
}

function seedProductTitles(): string[] {
  const seed = source('prisma/seed.ts');
  const farmersBlock = seed.slice(seed.indexOf('const FARMERS_BY_CATEGORY'), seed.indexOf('async function upsertUser'));
  return [...farmersBlock.matchAll(/title: '([^']+)'/g)].map((match) => match[1]);
}

function seedProductUnit(title: string): string {
  const seed = source('prisma/seed.ts');
  const start = seed.indexOf(`title: '${title}'`);
  if (start < 0) {
    throw new Error(`Seed is missing title ${title}`);
  }
  const unit = seed.slice(start).match(/unit: '([^']+)'/);
  if (!unit) {
    throw new Error(`Seed is missing unit for ${title}`);
  }
  return unit[1];
}

describe('deterministic demo catalog prices', () => {
  it('covers every seeded demo product exactly once', () => {
    const titles = seedProductTitles();
    expect(titles).toHaveLength(39);
    expect(new Set(titles).size).toBe(39);
    expect(DEMO_CATALOG_PRICES.map((row) => row.title).sort()).toEqual([...titles].sort());
  });

  it('assigns the intended price, currency, and unit to each demo product', () => {
    const expected = [
      ['Premium bay leaf grade A', 12, 'GEL', 'kg'],
      ['Dried bay leaves', 10, 'GEL', 'kg'],
      ['Adjara blueberries', 17, 'GEL', 'kg'],
      ['Fresh raspberries', 15, 'GEL', 'kg'],
      ['Guria strawberries', 14, 'GEL', 'box'],
      ['Farm matsoni', 7, 'GEL', 'liter'],
      ['Fresh sulguni', 24, 'GEL', 'kg'],
      ['Guda sheep cheese', 24, 'GEL', 'kg'],
      ['Lavender essential oil', 85, 'GEL', 'liter'],
      ['Mandarin peel essential oil', 75, 'GEL', 'liter'],
      ['Fresh Kakheti peaches', 3.5, 'GEL', 'kg'],
      ['Guria mandarins', 4.5, 'GEL', 'kg'],
      ['Kakheti persimmons', 3, 'GEL', 'kg'],
      ['Kartli dessert apples', 1.8, 'GEL', 'kg'],
      ['Chestnut blossom honey', 30, 'GEL', 'kg'],
      ['Highland wildflower honey', 25, 'GEL', 'kg'],
      ['Racha mountain honey', 28, 'GEL', 'kg'],
      ['Acacia honey', 22, 'GEL', 'kg'],
      ['Natural sparkling mineral water', 1.3, 'GEL', 'liter'],
      ['Still mineral water', 1.4, 'GEL', 'liter'],
      ['Georgian hazelnuts (shelled)', 24, 'USD', 'kg'],
      ['In-shell walnuts', 10, 'GEL', 'kg'],
      ['Roasted almond kernels', 20, 'GEL', 'kg'],
      ['Organic dessert apples', 5, 'GEL', 'kg'],
      ['Organic mixed vegetables', 12, 'GEL', 'box'],
      ['Organic wildflower honey', 25, 'GEL', 'kg'],
      ['Dried adjika spice blend', 24, 'GEL', 'kg'],
      ['Dried Georgian blue fenugreek', 20, 'GEL', 'kg'],
      ['Dried thyme and savory mix', 18, 'GEL', 'kg'],
      ['Guria black tea', 25, 'GEL', 'kg'],
      ['Georgian green tea', 25, 'GEL', 'kg'],
      ['Fresh cucumbers', 2.8, 'GEL', 'kg'],
      ['Greenhouse tomatoes', 5, 'GEL', 'kg'],
      ['Imereti potatoes', 1.8, 'GEL', 'kg'],
      ['Sweet peppers mix', 7, 'GEL', 'kg'],
      ['Dry Saperavi rosé', 30, 'GEL', 'bottle'],
      ['Rkatsiteli white wine', 25, 'GEL', 'bottle'],
      ['Saperavi qvevri 2024', 15, 'EUR', 'bottle'],
      ['Tsitska-Tsolikouri blend', 30, 'GEL', 'bottle'],
    ] as const;

    expect(DEMO_CATALOG_PRICES).toHaveLength(expected.length);
    for (const [title, priceFrom, priceCurrency, unit] of expected) {
      expect(demoCatalogPrice(title)).toEqual({ title, priceFrom, priceCurrency, unit });
      expect(seedProductUnit(title)).toBe(unit);
    }
  });

  it('keeps prices deterministic and independent of seed order', () => {
    const first = demoCatalogPrice('Imereti potatoes');
    const second = demoCatalogPrice('Imereti potatoes');
    expect(first).toEqual(second);
    expect(first).toEqual({
      title: 'Imereti potatoes',
      priceFrom: 1.8,
      priceCurrency: 'GEL',
      unit: 'kg',
    });
    expect(demoCatalogPrice('Saperavi qvevri 2024')).toBe(demoCatalogPrice('Saperavi qvevri 2024'));
  });

  it('uses only GEL, EUR, and USD without converting amounts', () => {
    expect(CURRENCIES).toEqual(['GEL', 'EUR', 'USD']);
    for (const row of DEMO_CATALOG_PRICES) {
      expect(isCurrencyCode(row.priceCurrency)).toBe(true);
      expect(isProductUnit(row.unit)).toBe(true);
    }
    expect(demoCatalogPrice('Saperavi qvevri 2024').priceCurrency).toBe('EUR');
    expect(demoCatalogPrice('Saperavi qvevri 2024').priceFrom).toBe(15);
    expect(demoCatalogPrice('Georgian hazelnuts (shelled)').priceCurrency).toBe('USD');
    expect(demoCatalogPrice('Georgian hazelnuts (shelled)').priceFrom).toBe(24);
    expect(DEMO_CATALOG_PRICES.filter((row) => row.priceCurrency === 'EUR')).toEqual([
      demoCatalogPrice('Saperavi qvevri 2024'),
    ]);
    expect(DEMO_CATALOG_PRICES.filter((row) => row.priceCurrency === 'USD')).toEqual([
      demoCatalogPrice('Georgian hazelnuts (shelled)'),
    ]);
  });

  it('does not generate published prices from a category formula', () => {
    const enrichment = source('prisma/seed-enrichment.ts');
    expect(enrichment).not.toContain('PRICE_FROM');
    expect(enrichment).not.toContain('globalIndex % 5');
    expect(enrichment).not.toContain('0.85 + (globalIndex');
    expect(enrichment).toContain('demoCatalogPrice(title)');
    expect(enrichment).toContain('priceFrom: listed.priceFrom');
    expect(enrichment).toContain('priceCurrency: listed.priceCurrency');
    expect(enrichment).not.toMatch(/exchange|fx|convert/i);
  });

  it('formats stored demo currencies without FX', () => {
    expect(
      formatListedPrice({ priceFrom: 24, priceCurrency: 'GEL', unit: 'kg' }),
    ).toBe('₾ 24.00 / kg');
    expect(
      formatListedPrice({ priceFrom: 15, priceCurrency: 'EUR', unit: 'bottle' }),
    ).toBe('€ 15.00 / bottle');
    expect(
      formatListedPrice({ priceFrom: 24, priceCurrency: 'USD', unit: 'kg' }),
    ).toBe('$ 24.00 / kg');
    expect(
      formatListedPrice({ priceFrom: 4.5, priceCurrency: 'GEL', unit: 'kg' }),
    ).toBe('₾ 4.50 / kg');
  });

  it('corrects the unrealistic seed units to kg', () => {
    expect(seedProductUnit('Guria mandarins')).toBe('kg');
    expect(seedProductUnit('Imereti potatoes')).toBe('kg');
    expect(seedProductUnit('Sweet peppers mix')).toBe('kg');
    expect(seedProductUnit('Guria strawberries')).toBe('box');
    expect(seedProductUnit('Organic mixed vegetables')).toBe('box');
  });
});
