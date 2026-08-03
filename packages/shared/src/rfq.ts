import type { ProductUnit } from './catalog';

export const RFQ_STATUSES = [
  'pending',
  'offered',
  'accepted',
  'completed',
  'declined',
  'cancelled',
] as const;

export type RfqStatus = (typeof RFQ_STATUSES)[number];

export const CURRENCIES = ['GEL', 'EUR', 'USD'] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export function isRfqStatus(value: string): value is RfqStatus {
  return (RFQ_STATUSES as readonly string[]).includes(value);
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

export type RfqOfferView = {
  id: string;
  priceAmount: string;
  currency: CurrencyCode;
  quantity: string | null;
  unit: string | null;
  message: string | null;
  validUntil: string | null;
  createdAt: string;
};

export type RfqDealParticipant = {
  id: string;
  displayName: string | null;
  email: string;
};

export type RfqSummary = {
  id: string;
  status: RfqStatus;
  quantity: string;
  unit: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  product: {
    id: string;
    title: string;
  };
  farm: {
    id: string;
    name: string;
    region: string | null;
    ownerId: string;
  };
  buyer: RfqDealParticipant;
  seller: RfqDealParticipant;
  offer: RfqOfferView | null;
  /** Either party may mark an accepted deal as completed. */
  canComplete: boolean;
  /** Current viewer may leave a rating after completion. */
  canRate: boolean;
  myRating: {
    score: number;
    comment: string | null;
    createdAt: string;
  } | null;
  counterpartyRating: {
    score: number;
    comment: string | null;
    createdAt: string;
  } | null;
};

export type CreateRfqInput = {
  productId: string;
  quantity: string;
  unit?: ProductUnit | string;
  message?: string;
};

export type CreateRfqOfferInput = {
  priceAmount: string;
  currency: CurrencyCode;
  quantity?: string;
  unit?: string;
  message?: string;
  validUntil?: string;
};
