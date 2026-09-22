export const CURRENCIES = ['GEL', 'EUR', 'USD'] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

/** Product listed-price currency uses the same canonical set as quotes and RFQ. */
export const PRICE_CURRENCIES = CURRENCIES;
export type PriceCurrency = CurrencyCode;
export const isPriceCurrency = isCurrencyCode;

/** Default currency for a new product that has no saved currency yet. */
export const DEFAULT_PRODUCT_CURRENCY: CurrencyCode = 'GEL';
