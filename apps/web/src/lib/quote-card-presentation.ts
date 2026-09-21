import type { PurchaseQuoteStatus } from '@agrobridge/shared';

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

export function sellerQuoteActions(input: {
  canMessageBuyer: boolean;
  canWithdraw: boolean;
}) {
  return {
    showMessageBuyer: input.canMessageBuyer,
    showWithdraw: input.canWithdraw,
  };
}
