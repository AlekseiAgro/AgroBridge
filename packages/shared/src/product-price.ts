import { isPriceCurrency, type PriceCurrency } from './quality';

const CURRENCY_SYMBOLS: Record<PriceCurrency, string> = {
  EUR: '€',
  USD: '$',
  GEL: '₾',
};

export type ListedPriceFields = {
  priceFrom?: number | null;
  priceCurrency?: string | null;
  unit?: string | null;
};

function formatAmount(value: number): string {
  return value.toFixed(2);
}

/** Seller-listed catalog price as `€ 4.50 / kg`. Null when there is no truthful listed price. */
export function formatListedPrice(product: ListedPriceFields): string | null {
  const amount = product.priceFrom;
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const currencyCode = product.priceCurrency?.trim() ?? '';
  if (!currencyCode) {
    return null;
  }

  const symbol = isPriceCurrency(currencyCode) ? CURRENCY_SYMBOLS[currencyCode] : currencyCode;
  const unit = product.unit?.trim();
  const price = `${symbol} ${formatAmount(amount)}`;
  return unit ? `${price} / ${unit}` : price;
}
