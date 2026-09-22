import type { CurrencyCode, ProductUnit } from '@agrobridge/shared';

/** Deterministic B2B demo listed prices. Not supermarket retail and not FX-converted. */
export type DemoCatalogPrice = {
  title: string;
  priceFrom: number;
  priceCurrency: CurrencyCode;
  unit: ProductUnit;
};

export const DEMO_CATALOG_PRICES: readonly DemoCatalogPrice[] = [
  { title: 'Premium bay leaf grade A', priceFrom: 12, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Dried bay leaves', priceFrom: 10, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Adjara blueberries', priceFrom: 17, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Fresh raspberries', priceFrom: 15, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Guria strawberries', priceFrom: 14, priceCurrency: 'GEL', unit: 'box' },
  { title: 'Farm matsoni', priceFrom: 7, priceCurrency: 'GEL', unit: 'liter' },
  { title: 'Fresh sulguni', priceFrom: 24, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Guda sheep cheese', priceFrom: 24, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Lavender essential oil', priceFrom: 85, priceCurrency: 'GEL', unit: 'liter' },
  { title: 'Mandarin peel essential oil', priceFrom: 75, priceCurrency: 'GEL', unit: 'liter' },
  { title: 'Fresh Kakheti peaches', priceFrom: 3.5, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Guria mandarins', priceFrom: 4.5, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Kakheti persimmons', priceFrom: 3, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Kartli dessert apples', priceFrom: 1.8, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Chestnut blossom honey', priceFrom: 30, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Highland wildflower honey', priceFrom: 25, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Racha mountain honey', priceFrom: 28, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Acacia honey', priceFrom: 22, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Natural sparkling mineral water', priceFrom: 1.3, priceCurrency: 'GEL', unit: 'liter' },
  { title: 'Still mineral water', priceFrom: 1.4, priceCurrency: 'GEL', unit: 'liter' },
  { title: 'Georgian hazelnuts (shelled)', priceFrom: 24, priceCurrency: 'USD', unit: 'kg' },
  { title: 'In-shell walnuts', priceFrom: 10, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Roasted almond kernels', priceFrom: 20, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Organic dessert apples', priceFrom: 5, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Organic mixed vegetables', priceFrom: 12, priceCurrency: 'GEL', unit: 'box' },
  { title: 'Organic wildflower honey', priceFrom: 25, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Dried adjika spice blend', priceFrom: 24, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Dried Georgian blue fenugreek', priceFrom: 20, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Dried thyme and savory mix', priceFrom: 18, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Guria black tea', priceFrom: 25, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Georgian green tea', priceFrom: 25, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Fresh cucumbers', priceFrom: 2.8, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Greenhouse tomatoes', priceFrom: 5, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Imereti potatoes', priceFrom: 1.8, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Sweet peppers mix', priceFrom: 7, priceCurrency: 'GEL', unit: 'kg' },
  { title: 'Dry Saperavi rosé', priceFrom: 30, priceCurrency: 'GEL', unit: 'bottle' },
  { title: 'Rkatsiteli white wine', priceFrom: 25, priceCurrency: 'GEL', unit: 'bottle' },
  { title: 'Saperavi qvevri 2024', priceFrom: 15, priceCurrency: 'EUR', unit: 'bottle' },
  { title: 'Tsitska-Tsolikouri blend', priceFrom: 30, priceCurrency: 'GEL', unit: 'bottle' },
];

const DEMO_CATALOG_PRICE_BY_TITLE = new Map(
  DEMO_CATALOG_PRICES.map((row) => [row.title, row]),
);

export function demoCatalogPrice(title: string): DemoCatalogPrice {
  const row = DEMO_CATALOG_PRICE_BY_TITLE.get(title);
  if (!row) {
    throw new Error(`Missing deterministic demo price for "${title}"`);
  }
  return row;
}
