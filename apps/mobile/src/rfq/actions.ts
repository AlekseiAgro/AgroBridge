import { ApiError } from '../api/errors';
import { failureMessageKey } from '../api/user-error';
import { isProductUnit, PRICE_CURRENCIES } from '../catalog/categories';
import type { MessageKey } from '../i18n/en';
import type { MobileRfq } from './model';

export type RfqRole = 'buyer' | 'seller';

export type RfqActionId = 'offer' | 'accept' | 'decline' | 'complete' | 'cancel' | 'delete';

export type RfqLoadStatus = 'notFound' | 'forbidden' | 'error';

const PRICE = /^\d+(\.\d{1,2})?$/;
const CURRENCIES = new Set<string>(PRICE_CURRENCIES);
const CONFIRMED: readonly RfqActionId[] = ['accept', 'decline', 'complete', 'cancel', 'delete'];

export const RFQ_INITIAL_STATUS = 'loading' as const;

export function rfqListPhase(
  status: 'loading' | 'ready' | 'error',
  count: number,
): 'loading' | 'empty' | 'list' | 'error' {
  if (status === 'loading') {
    return 'loading';
  }
  if (status === 'error') {
    return 'error';
  }
  return count === 0 ? 'empty' : 'list';
}

export function retryRfqList(reloadToken: number): number {
  return reloadToken + 1;
}

export function rfqRole(rfq: MobileRfq, userId: string | null | undefined): RfqRole | null {
  if (!userId) {
    return null;
  }
  if (rfq.buyer.id === userId) {
    return 'buyer';
  }
  if (rfq.seller.id === userId || rfq.farm?.ownerId === userId) {
    return 'seller';
  }
  return null;
}

/**
 * Actions follow the RFQ status and the viewer's side of the deal.
 * A seller offer is only available while the request is pending and has no offer.
 */
export function rfqActions(rfq: Pick<MobileRfq, 'status' | 'offer'>, role: RfqRole | null): RfqActionId[] {
  if (!role) {
    return [];
  }
  const actions: RfqActionId[] = [];
  if (role === 'seller' && rfq.status === 'pending' && !rfq.offer) {
    actions.push('offer', 'decline');
  }
  if (role === 'buyer' && rfq.status === 'offered') {
    actions.push('accept', 'decline');
  }
  if (rfq.status === 'accepted') {
    actions.push('complete');
  }
  if (role === 'buyer' && rfq.status === 'pending') {
    actions.push('cancel');
  }
  if (role === 'seller' && rfq.status === 'cancelled') {
    actions.push('delete');
  }
  return actions;
}

export function rfqActionNeedsConfirm(action: RfqActionId): boolean {
  return CONFIRMED.includes(action);
}

export function canMessageRfq(role: RfqRole | null): boolean {
  return role === 'buyer' || role === 'seller';
}

export function partyName(person: { displayName: string | null; email: string }, fallback: string): string {
  const name = person.displayName?.trim();
  if (name) {
    return name;
  }
  if (person.email.trim()) {
    return person.email;
  }
  return fallback;
}

export function rfqOfferPayload(input: {
  priceAmount: string;
  currency: string;
  quantity?: string;
  unit?: string;
  message?: string;
}): Record<string, string> | null {
  const priceAmount = input.priceAmount.trim();
  const currency = input.currency.trim();
  const price = Number(priceAmount);
  if (!PRICE.test(priceAmount) || !Number.isFinite(price) || price <= 0 || !CURRENCIES.has(currency)) {
    return null;
  }
  const quantity = input.quantity?.trim() ?? '';
  if (quantity.length > 60) {
    return null;
  }
  const unit = input.unit?.trim() ?? '';
  if (unit && !isProductUnit(unit)) {
    return null;
  }
  const message = input.message?.trim() ?? '';
  if (message.length > 2000) {
    return null;
  }
  const body: Record<string, string> = { priceAmount, currency };
  if (quantity) {
    body.quantity = quantity;
  }
  if (unit) {
    body.unit = unit;
  }
  if (message) {
    body.message = message;
  }
  return body;
}

export function rfqLoadPresentation(error: unknown): { status: RfqLoadStatus; messageKey: MessageKey | null } {
  if (error instanceof ApiError && error.kind === 'http' && error.status === 404) {
    return { status: 'notFound', messageKey: null };
  }
  if (error instanceof ApiError && error.kind === 'http' && error.status === 403) {
    return { status: 'forbidden', messageKey: null };
  }
  return { status: 'error', messageKey: failureMessageKey(error) };
}

export function rfqActionErrorKey(error: unknown): MessageKey {
  return failureMessageKey(error);
}

export function rfqDetailParams(rfqId: string): { rfqId: string } {
  return { rfqId };
}
