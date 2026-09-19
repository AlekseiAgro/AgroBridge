import {
  purchaseRequestActionRequiresConfirm,
  resolvePurchaseRequestActionRequest,
  type PurchaseRequestAction,
} from '../../../web/src/lib/purchase-request-action';

const CONFIRMED: PurchaseRequestAction[] = ['accept', 'decline', 'close', 'cancel'];

describe('purchase request irreversible-action confirmation', () => {
  it.each(CONFIRMED)('does not POST when %s confirmation is cancelled', (action) => {
    const confirm = jest.fn(() => false);
    const next = resolvePurchaseRequestActionRequest({
      action,
      requestId: 'req-1',
      quoteId: 'quote-1',
      confirmMessage: `confirm-${action}`,
      confirm,
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(`confirm-${action}`);
    expect(next).toEqual({ proceed: false });
  });

  it('POSTs accept to the same quote endpoint after confirmation', () => {
    const confirm = jest.fn(() => true);
    const next = resolvePurchaseRequestActionRequest({
      action: 'accept',
      requestId: 'req-1',
      quoteId: 'quote-1',
      confirmMessage: 'confirm-accept',
      confirm,
    });

    expect(confirm).toHaveBeenCalledWith('confirm-accept');
    expect(next).toEqual({
      proceed: true,
      method: 'POST',
      path: '/api/purchase-requests/req-1/quotes/quote-1/accept',
    });
  });

  it('POSTs decline to the same quote endpoint after confirmation', () => {
    const next = resolvePurchaseRequestActionRequest({
      action: 'decline',
      requestId: 'req-1',
      quoteId: 'quote-1',
      confirmMessage: 'confirm-decline',
      confirm: () => true,
    });

    expect(next).toEqual({
      proceed: true,
      method: 'POST',
      path: '/api/purchase-requests/req-1/quotes/quote-1/decline',
    });
  });

  it('POSTs close to the same request endpoint after confirmation', () => {
    const next = resolvePurchaseRequestActionRequest({
      action: 'close',
      requestId: 'req-1',
      confirmMessage: 'confirm-close',
      confirm: () => true,
    });

    expect(next).toEqual({
      proceed: true,
      method: 'POST',
      path: '/api/purchase-requests/req-1/close',
    });
  });

  it('POSTs cancel to the same request endpoint after confirmation', () => {
    const next = resolvePurchaseRequestActionRequest({
      action: 'cancel',
      requestId: 'req-1',
      confirmMessage: 'confirm-cancel',
      confirm: () => true,
    });

    expect(next).toEqual({
      proceed: true,
      method: 'POST',
      path: '/api/purchase-requests/req-1/cancel',
    });
  });

  it('does not ask for confirmation before withdrawing a quote', () => {
    const confirm = jest.fn(() => false);
    const next = resolvePurchaseRequestActionRequest({
      action: 'withdraw',
      requestId: 'req-1',
      quoteId: 'quote-1',
      confirmMessage: 'should-not-be-shown',
      confirm,
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(next).toEqual({
      proceed: true,
      method: 'POST',
      path: '/api/purchase-requests/req-1/quotes/quote-1/withdraw',
    });
  });

  it('requires confirmation only for accept, decline, close, and cancel', () => {
    expect(CONFIRMED.every(purchaseRequestActionRequiresConfirm)).toBe(true);
    expect(purchaseRequestActionRequiresConfirm('withdraw')).toBe(false);
  });
});
