import type { ProductCategory, ProductUnit } from './catalog';
import type { CurrencyCode } from './rfq';

export const PURCHASE_REQUEST_STATUSES = [
  'open',
  'closed',
  'cancelled',
  'fulfilled',
] as const;

export type PurchaseRequestStatus = (typeof PURCHASE_REQUEST_STATUSES)[number];

export const PURCHASE_QUOTE_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
] as const;

export type PurchaseQuoteStatus = (typeof PURCHASE_QUOTE_STATUSES)[number];

export function isPurchaseRequestStatus(value: string): value is PurchaseRequestStatus {
  return (PURCHASE_REQUEST_STATUSES as readonly string[]).includes(value);
}

export function isPurchaseQuoteStatus(value: string): value is PurchaseQuoteStatus {
  return (PURCHASE_QUOTE_STATUSES as readonly string[]).includes(value);
}

export type PurchaseRequestBuyer = {
  id: string;
  displayName: string | null;
};

export type PurchaseQuoteView = {
  id: string;
  status: PurchaseQuoteStatus;
  priceAmount: string;
  currency: CurrencyCode;
  quantity: string | null;
  unit: string | null;
  message: string | null;
  validUntil: string | null;
  createdAt: string;
  farm: {
    id: string;
    name: string;
    region: string | null;
    ownerId: string;
  };
  /** Present for request owner / admin / quote author. */
  canAccept: boolean;
  canDecline: boolean;
  canWithdraw: boolean;
};

export type PurchaseRequestSummary = {
  id: string;
  title: string;
  category: ProductCategory | string;
  quantity: string;
  unit: string | null;
  variety: string | null;
  packaging: string | null;
  destinationCountry: string | null;
  message: string | null;
  status: PurchaseRequestStatus;
  createdAt: string;
  updatedAt: string;
  buyer: PurchaseRequestBuyer;
  quoteCount: number;
  /** Current farmer's quote on this request, if any. */
  myQuote: PurchaseQuoteView | null;
};

export type PurchaseRequestDetail = PurchaseRequestSummary & {
  quotes: PurchaseQuoteView[];
  canCancel: boolean;
  canClose: boolean;
  canQuote: boolean;
  canMessageBuyer: boolean;
};

export type CreatePurchaseRequestInput = {
  title: string;
  category: ProductCategory | string;
  quantity: string;
  unit?: ProductUnit | string;
  variety?: string;
  packaging?: string;
  destinationCountry?: string;
  message?: string;
};

export type CreatePurchaseQuoteInput = {
  priceAmount: string;
  currency: CurrencyCode;
  quantity?: string;
  unit?: string;
  message?: string;
  validUntil?: string;
};
