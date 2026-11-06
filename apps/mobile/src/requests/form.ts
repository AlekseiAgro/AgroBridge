import { PRODUCT_CATEGORIES, PRODUCT_UNITS, type ProductCategory, type ProductUnit } from '../catalog/categories';

export type RequestDraft = {
  title: string;
  category: string;
  quantity: string;
  unit: string;
  variety: string;
  packaging: string;
  destinationCountry: string;
  message: string;
};

export const emptyRequestDraft = (): RequestDraft => ({
  title: '',
  category: '',
  quantity: '',
  unit: '',
  variety: '',
  packaging: '',
  destinationCountry: '',
  message: '',
});

const CATEGORIES = new Set<string>(PRODUCT_CATEGORIES);
const UNITS = new Set<string>(PRODUCT_UNITS);

export function requestFieldError(
  draft: RequestDraft,
  field: 'title' | 'category' | 'quantity',
): 'title' | 'category' | 'quantity' | null {
  if (field === 'title') {
    const title = draft.title.trim();
    if (title.length < 2 || title.length > 160) return 'title';
  }
  if (field === 'category' && !CATEGORIES.has(draft.category)) return 'category';
  if (field === 'quantity') {
    const quantity = draft.quantity.trim();
    if (quantity.length < 1 || quantity.length > 60) return 'quantity';
  }
  return null;
}

export function requestPayload(draft: RequestDraft): Record<string, string> | null {
  if (
    requestFieldError(draft, 'title') ||
    requestFieldError(draft, 'category') ||
    requestFieldError(draft, 'quantity')
  ) {
    return null;
  }
  const body: Record<string, string> = {
    title: draft.title.trim(),
    category: draft.category,
    quantity: draft.quantity.trim(),
  };
  const unit = draft.unit.trim();
  if (unit && UNITS.has(unit)) body.unit = unit;
  const variety = draft.variety.trim();
  if (variety) body.variety = variety.slice(0, 120);
  const packaging = draft.packaging.trim();
  if (packaging) body.packaging = packaging.slice(0, 160);
  const destinationCountry = draft.destinationCountry.trim();
  if (destinationCountry) body.destinationCountry = destinationCountry.slice(0, 120);
  const message = draft.message.trim();
  if (message) body.message = message.slice(0, 2000);
  return body;
}

export function isRequestCategory(value: string): value is ProductCategory {
  return CATEGORIES.has(value);
}

export function isRequestUnit(value: string): value is ProductUnit {
  return UNITS.has(value);
}

const PRICE = /^\d+(\.\d{1,2})?$/;
const CURRENCIES = new Set(['GEL', 'EUR', 'USD']);

export function quotePayload(input: {
  priceAmount: string;
  currency: string;
  quantity?: string;
  unit?: string;
  message?: string;
}): Record<string, string> | null {
  const priceAmount = input.priceAmount.trim();
  const currency = input.currency.trim();
  if (!PRICE.test(priceAmount) || !CURRENCIES.has(currency)) return null;
  const body: Record<string, string> = { priceAmount, currency };
  const quantity = input.quantity?.trim();
  if (quantity) body.quantity = quantity.slice(0, 60);
  const unit = input.unit?.trim();
  if (unit && UNITS.has(unit)) body.unit = unit;
  const message = input.message?.trim();
  if (message) body.message = message.slice(0, 2000);
  return body;
}

const CONFIRMED_ACTIONS = ['accept', 'decline', 'close', 'cancel'] as const;

export function requestActionNeedsConfirm(action: string): boolean {
  return (CONFIRMED_ACTIONS as readonly string[]).includes(action);
}
