import type { PurchaseQuoteMineItem, PurchaseQuoteStatus } from '@agrobridge/shared';

export type QuoteCardActions = {
  showMessageBuyer: boolean;
  showOpenRequest: boolean;
  showWithdraw: boolean;
};

/**
 * Presentation-only: surface actions already allowed by the my-quotes payload.
 * Messaging follows `canOpenRequest`, which matches seller `canMessageBuyer`
 * (open request or accepted/winning quote) without a new API field.
 */
export function quoteCardActions(
  item: Pick<PurchaseQuoteMineItem, 'canOpenRequest' | 'canWithdraw'>,
): QuoteCardActions {
  return {
    showMessageBuyer: item.canOpenRequest,
    showOpenRequest: item.canOpenRequest,
    showWithdraw: item.canWithdraw,
  };
}

export function quoteStatusBadgeClass(status: PurchaseQuoteStatus): string {
  return `harvest-badge quote-status quote-status--${status}`;
}

/** Display the stored amount and currency as-is. No FX or rounding. */
export function formatQuotePrice(priceAmount: string, currency: string): string {
  return `${priceAmount} ${currency}`;
}

export function formatQuoteQuantity(
  amount: string | null | undefined,
  unitLabel: string | null | undefined,
): string | null {
  if (!amount) return null;
  return unitLabel ? `${amount} ${unitLabel}` : amount;
}
