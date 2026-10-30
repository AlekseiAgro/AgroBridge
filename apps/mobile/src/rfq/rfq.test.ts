import { ApiError } from '../api/errors';
import {
  RFQ_INITIAL_STATUS,
  canMessageRfq,
  retryRfqList,
  rfqActionErrorKey,
  rfqActionNeedsConfirm,
  rfqActions,
  rfqDetailParams,
  rfqListPhase,
  rfqLoadPresentation,
  rfqOfferPayload,
  rfqRole,
} from './actions';
import { rfqRequest } from './api';
import { parseRfq, parseRfqList, rfqIdFromCreate, rfqStatusMessageKey, type MobileRfq } from './model';

function rfq(overrides: Partial<MobileRfq> = {}): MobileRfq {
  return {
    id: 'rfq_1',
    status: 'pending',
    quantity: '10',
    unit: 'kg',
    message: 'Need this week',
    product: { id: 'product_1', title: 'Rkatsiteli grapes' },
    farm: { id: 'farm_1', name: 'Telavi Estate', region: 'kakheti', ownerId: 'seller_1' },
    buyer: { id: 'buyer_1', displayName: 'Nino', email: 'nino@example.com' },
    seller: { id: 'seller_1', displayName: 'Giorgi', email: 'giorgi@example.com' },
    offer: null,
    ...overrides,
  };
}

function httpError(status: number): ApiError {
  return new ApiError({ message: 'failed', status, kind: 'http' });
}

describe('RFQ detail loading', () => {
  it('starts in a loading state and parses a successful RFQ', () => {
    expect(RFQ_INITIAL_STATUS).toBe('loading');
    const parsed = parseRfq({
      id: 'rfq_1',
      status: 'offered',
      quantity: '10',
      unit: 'kg',
      message: 'Need this week',
      product: { id: 'product_1', title: 'Rkatsiteli grapes' },
      farm: { id: 'farm_1', name: 'Telavi Estate', region: 'kakheti', ownerId: 'seller_1' },
      buyer: { id: 'buyer_1', displayName: 'Nino', email: 'nino@example.com' },
      seller: { id: 'seller_1', displayName: 'Giorgi', email: 'giorgi@example.com' },
      offer: {
        id: 'offer_1',
        priceAmount: '12.50',
        currency: 'GEL',
        quantity: '10',
        unit: 'kg',
        message: 'Ready',
        validUntil: '2026-10-20T00:00:00.000Z',
      },
    });
    expect(parsed).toMatchObject({
      id: 'rfq_1',
      status: 'offered',
      product: { title: 'Rkatsiteli grapes' },
      offer: { priceAmount: '12.50', currency: 'GEL' },
    });
    expect(rfqRequest({ kind: 'get', rfqId: 'rfq_1' })).toEqual({
      method: 'GET',
      path: '/rfqs/rfq_1',
    });
  });

  it('maps 404, 403, and network failure without treating them as the same error', () => {
    expect(rfqLoadPresentation(httpError(404))).toEqual({ status: 'notFound', messageKey: null });
    expect(rfqLoadPresentation(httpError(403))).toEqual({ status: 'forbidden', messageKey: null });
    expect(
      rfqLoadPresentation(new ApiError({ message: 'offline', status: 0, kind: 'network' })),
    ).toEqual({ status: 'error', messageKey: 'errors.network' });
    expect(rfqLoadPresentation(httpError(401)).messageKey).toBe('errors.unauthorized');
    expect(rfqLoadPresentation(httpError(429)).messageKey).toBe('errors.rateLimit');
  });
});

describe('RFQ seller and buyer actions', () => {
  it('lets a seller offer or decline a pending request that has no offer', () => {
    const item = rfq();
    expect(rfqRole(item, 'seller_1')).toBe('seller');
    expect(rfqActions(item, 'seller')).toEqual(['offer', 'decline']);
    expect(rfqActions(item, 'buyer')).not.toContain('offer');
  });

  it('builds the offer payload and rejects an invalid price', () => {
    expect(
      rfqOfferPayload({
        priceAmount: '12.50',
        currency: 'GEL',
        quantity: '10',
        unit: 'kg',
        message: 'Ready Friday',
      }),
    ).toEqual({
      priceAmount: '12.50',
      currency: 'GEL',
      quantity: '10',
      unit: 'kg',
      message: 'Ready Friday',
    });
    const body = rfqOfferPayload({
      priceAmount: '12.50',
      currency: 'EUR',
      quantity: '10',
      unit: 'kg',
      message: 'Ready Friday',
    });
    expect(body).not.toHaveProperty('validUntil');
    expect(body).not.toHaveProperty('purchaseRequestId');
    expect(rfqRequest({ kind: 'offer', rfqId: 'rfq_1', body: body ?? {} })).toEqual({
      method: 'POST',
      path: '/rfqs/rfq_1/offer',
      body,
    });
    expect(rfqOfferPayload({ priceAmount: '0', currency: 'GEL' })).toBeNull();
    expect(rfqOfferPayload({ priceAmount: '1.234', currency: 'GEL' })).toBeNull();
    expect(rfqOfferPayload({ priceAmount: '', currency: 'GEL' })).toBeNull();
    expect(rfqOfferPayload({ priceAmount: '10', currency: 'GBP' })).toBeNull();
    expect(rfqActionErrorKey(httpError(400))).toBe('errors.validation');
    expect(rfqActionErrorKey(httpError(409))).toBe('errors.conflict');
    expect(rfqActionErrorKey(httpError(403))).toBe('errors.forbidden');
    expect(rfqActionErrorKey(httpError(404))).toBe('errors.notFound');
    expect(rfqActionErrorKey(new ApiError({ message: 'offline', status: 0, kind: 'network' }))).toBe(
      'errors.network',
    );
  });

  it('lets the buyer accept or decline an offered request', () => {
    const item = rfq({
      status: 'offered',
      offer: {
        id: 'offer_1',
        priceAmount: '12',
        currency: 'GEL',
        quantity: '10',
        unit: 'kg',
        message: null,
        validUntil: null,
      },
    });
    expect(rfqActions(item, 'buyer')).toEqual(['accept', 'decline']);
    expect(rfqActions(item, 'seller')).not.toContain('accept');
    expect(rfqRequest({ kind: 'accept', rfqId: 'rfq_1' }).path).toBe('/rfqs/rfq_1/accept');
    expect(rfqRequest({ kind: 'decline', rfqId: 'rfq_1' }).path).toBe('/rfqs/rfq_1/decline');
    expect(rfqActionNeedsConfirm('accept')).toBe(true);
    expect(rfqActionNeedsConfirm('decline')).toBe(true);
  });

  it('shows complete only while the deal is accepted', () => {
    expect(rfqActions(rfq({ status: 'accepted' }), 'buyer')).toEqual(['complete']);
    expect(rfqActions(rfq({ status: 'accepted' }), 'seller')).toEqual(['complete']);
    expect(rfqActions(rfq({ status: 'completed' }), 'buyer')).not.toContain('complete');
    expect(rfqActions(rfq({ status: 'completed' }), 'seller')).not.toContain('complete');
    expect(rfqRequest({ kind: 'complete', rfqId: 'rfq_1' })).toEqual({
      method: 'POST',
      path: '/rfqs/rfq_1/complete',
    });
  });

  it('lets only the buyer cancel, and only while the request is pending', () => {
    expect(rfqActions(rfq({ status: 'pending' }), 'buyer')).toEqual(['cancel']);
    expect(rfqActions(rfq({ status: 'offered' }), 'buyer')).not.toContain('cancel');
    expect(rfqActions(rfq({ status: 'pending' }), 'seller')).not.toContain('cancel');
    expect(rfqRequest({ kind: 'cancel', rfqId: 'rfq_1' }).method).toBe('POST');
  });

  it('lets only the seller delete, and only after cancellation', () => {
    expect(rfqActions(rfq({ status: 'cancelled' }), 'seller')).toEqual(['delete']);
    expect(rfqActions(rfq({ status: 'pending' }), 'seller')).not.toContain('delete');
    expect(rfqActions(rfq({ status: 'cancelled' }), 'buyer')).not.toContain('delete');
    expect(rfqRequest({ kind: 'delete', rfqId: 'rfq_1' })).toEqual({
      method: 'DELETE',
      path: '/rfqs/rfq_1',
    });
    expect(rfqActionNeedsConfirm('delete')).toBe(true);
  });
});

describe('RFQ chat', () => {
  it('creates a conversation with the RFQ id and never a purchase-request id', () => {
    const call = rfqRequest({ kind: 'chat', rfqId: 'rfq_9', locale: 'ka' });
    expect(call).toEqual({
      method: 'POST',
      path: '/conversations',
      body: { rfqId: 'rfq_9', locale: 'ka' },
    });
    expect(call.body).not.toHaveProperty('purchaseRequestId');
    expect(canMessageRfq('buyer')).toBe(true);
    expect(canMessageRfq('seller')).toBe(true);
    expect(canMessageRfq(null)).toBe(false);
  });
});

describe('buyer RFQ list', () => {
  it('loads GET /api/rfqs/mine and opens the exact RFQ', () => {
    expect(rfqRequest({ kind: 'mine' })).toEqual({ method: 'GET', path: '/rfqs/mine' });
    expect(rfqListPhase('loading', 0)).toBe('loading');
    expect(rfqListPhase('error', 0)).toBe('error');
    expect(retryRfqList(2)).toBe(3);
    expect(rfqListPhase('ready', 0)).toBe('empty');
    const items = parseRfqList([
      {
        id: 'rfq_mine',
        status: 'offered',
        quantity: '8',
        unit: 'kg',
        message: null,
        product: { id: 'p1', title: 'Grapes' },
        farm: { id: 'farm_1', name: 'Telavi Estate', region: 'kakheti', ownerId: 'seller_1' },
        buyer: { id: 'buyer_1', displayName: 'Nino', email: 'nino@example.com' },
        seller: { id: 'seller_1', displayName: 'Giorgi', email: 'giorgi@example.com' },
        offer: { id: 'offer_1', priceAmount: '15', currency: 'GEL', quantity: '8', unit: 'kg', message: null },
      },
      {
        id: 'rfq_mine_cancelled',
        status: 'cancelled',
        quantity: '1',
        unit: 'box',
        message: null,
        product: { id: 'p2', title: 'Honey' },
        buyer: { id: 'buyer_1', displayName: 'Nino', email: 'nino@example.com' },
        seller: { id: 'seller_2', displayName: 'Ana', email: 'ana@example.com' },
        offer: null,
      },
    ]);
    expect(rfqListPhase('ready', items.length)).toBe('list');
    expect(items.map((item) => item.status)).toEqual(['offered', 'cancelled']);
    expect(items[0]?.farm?.name).toBe('Telavi Estate');
    expect(items[0]?.offer?.priceAmount).toBe('15');
    expect(rfqDetailParams(items[0]?.id ?? '')).toEqual({ rfqId: 'rfq_mine' });
    expect(rfqDetailParams(items[1]?.id ?? '')).toEqual({ rfqId: 'rfq_mine_cancelled' });
  });
});

describe('seller RFQ inbox', () => {
  it('loads the seller inbox and keeps cancelled rows that open their own detail', () => {
    expect(rfqRequest({ kind: 'inbox' })).toEqual({ method: 'GET', path: '/rfqs/inbox' });
    const items = parseRfqList([
      {
        id: 'rfq_open',
        status: 'pending',
        quantity: '4',
        unit: 'box',
        message: null,
        product: { id: 'p1', title: 'Apples' },
        buyer: { id: 'buyer_1', displayName: 'Nino', email: 'nino@example.com' },
        seller: { id: 'seller_1', displayName: null, email: 'giorgi@example.com' },
        offer: null,
      },
      {
        id: 'rfq_cancelled',
        status: 'cancelled',
        quantity: '2',
        unit: 'ton',
        message: 'Changed plans',
        product: { id: 'p2', title: 'Hazelnuts' },
        buyer: { id: 'buyer_2', displayName: 'Luka', email: 'luka@example.com' },
        seller: { id: 'seller_1', displayName: 'Giorgi', email: 'giorgi@example.com' },
        offer: { id: 'offer_9', priceAmount: '90', currency: 'USD', quantity: null, unit: null, message: null },
      },
    ]);
    expect(items.map((item) => item.status)).toEqual(['pending', 'cancelled']);
    expect(rfqDetailParams(items[1]?.id ?? '')).toEqual({ rfqId: 'rfq_cancelled' });
    expect(items[1]?.offer?.priceAmount).toBe('90');
  });
});

describe('RFQ status copy', () => {
  it('has a localized label for every status', () => {
    expect(RFQ_STATUSES_COVERED()).toEqual([
      'rfq.status.pending',
      'rfq.status.offered',
      'rfq.status.accepted',
      'rfq.status.completed',
      'rfq.status.declined',
      'rfq.status.cancelled',
    ]);
  });

  it('reads the id returned when a product quote request is created', () => {
    expect(rfqIdFromCreate({ id: 'rfq_new' })).toBe('rfq_new');
    expect(rfqIdFromCreate({})).toBeNull();
  });
});

function RFQ_STATUSES_COVERED() {
  return ['pending', 'offered', 'accepted', 'completed', 'declined', 'cancelled'].map(
    (status) => rfqStatusMessageKey(status),
  );
}
