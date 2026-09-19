export type PurchaseRequestAction = 'cancel' | 'close' | 'accept' | 'decline' | 'withdraw';

export const CONFIRMED_PURCHASE_REQUEST_ACTIONS = [
  'accept',
  'decline',
  'close',
  'cancel',
] as const;

export type ConfirmedPurchaseRequestAction = (typeof CONFIRMED_PURCHASE_REQUEST_ACTIONS)[number];

export function purchaseRequestActionRequiresConfirm(
  action: PurchaseRequestAction,
): action is ConfirmedPurchaseRequestAction {
  return (CONFIRMED_PURCHASE_REQUEST_ACTIONS as readonly string[]).includes(action);
}

export function purchaseRequestActionPath(
  requestId: string,
  action: PurchaseRequestAction,
  quoteId?: string,
): string {
  if (action === 'cancel' || action === 'close') {
    return `/api/purchase-requests/${requestId}/${action}`;
  }
  return `/api/purchase-requests/${requestId}/quotes/${quoteId}/${action}`;
}

/**
 * Decide whether the existing POST should run. Confirmation is asked only for
 * accept / decline / close / cancel. A cancelled dialog must not POST.
 */
export function resolvePurchaseRequestActionRequest(input: {
  action: PurchaseRequestAction;
  requestId: string;
  quoteId?: string;
  confirmMessage: string;
  confirm: (message: string) => boolean;
}): { proceed: false } | { proceed: true; method: 'POST'; path: string } {
  if (purchaseRequestActionRequiresConfirm(input.action) && !input.confirm(input.confirmMessage)) {
    return { proceed: false };
  }

  return {
    proceed: true,
    method: 'POST',
    path: purchaseRequestActionPath(input.requestId, input.action, input.quoteId),
  };
}
