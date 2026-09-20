export const USER_NOTIFICATION_TYPES = [
  'harvestAvailable',
  'harvestPreorderOpen',
  'purchaseQuoteReceived',
  'purchaseQuoteAccepted',
  'purchaseQuoteDeclined',
  'purchaseRequestClosed',
  'purchaseRequestCancelled',
  'purchaseQuoteWithdrawn',
] as const;

export type UserNotificationType = (typeof USER_NOTIFICATION_TYPES)[number];

export type UserNotificationItem = {
  id: string;
  type: UserNotificationType;
  productId: string | null;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

/** Buyer-side Purchase Request events → My Purchase Requests. */
export const PURCHASE_REQUEST_UNREAD_TYPES = [
  'purchaseQuoteReceived',
  'purchaseQuoteWithdrawn',
] as const satisfies readonly UserNotificationType[];

/** Seller-side quote events → My Quotes. */
export const QUOTE_UNREAD_TYPES = [
  'purchaseQuoteAccepted',
  'purchaseQuoteDeclined',
  'purchaseRequestClosed',
  'purchaseRequestCancelled',
] as const satisfies readonly UserNotificationType[];

/** Seller events whose natural next step is the pending-quotes card. */
export const PENDING_QUOTE_UNREAD_TYPES = [
  'purchaseQuoteDeclined',
  'purchaseRequestClosed',
  'purchaseRequestCancelled',
] as const satisfies readonly UserNotificationType[];

/** Seller events whose natural next step is the accepted-quotes card. */
export const ACCEPTED_QUOTE_UNREAD_TYPES = [
  'purchaseQuoteAccepted',
] as const satisfies readonly UserNotificationType[];

export type NotificationUnreadSummary = {
  /** Alias of `totalUnread` so existing `{ count }` clients keep working. */
  count: number;
  totalUnread: number;
  purchaseRequestsUnread: number;
  quotesUnread: number;
  pendingQuotesUnread: number;
  acceptedQuotesUnread: number;
};

export const EMPTY_NOTIFICATION_UNREAD_SUMMARY: NotificationUnreadSummary = {
  count: 0,
  totalUnread: 0,
  purchaseRequestsUnread: 0,
  quotesUnread: 0,
  pendingQuotesUnread: 0,
  acceptedQuotesUnread: 0,
};

export function isUserNotificationType(value: unknown): value is UserNotificationType {
  return (
    typeof value === 'string' &&
    (USER_NOTIFICATION_TYPES as readonly string[]).includes(value)
  );
}

function sumTypes(
  byType: ReadonlyMap<string, number>,
  types: readonly UserNotificationType[],
): number {
  return types.reduce((total, type) => total + (byType.get(type) ?? 0), 0);
}

/** Fold per-type unread rows into cabinet badge totals. Harvest types count only toward total. */
export function summarizeUnreadByType(
  rows: ReadonlyArray<{ type: string; count: number }>,
): NotificationUnreadSummary {
  const byType = new Map<string, number>();
  let totalUnread = 0;
  for (const row of rows) {
    const count = Number.isFinite(row.count) ? Math.max(0, row.count) : 0;
    if (count === 0) continue;
    byType.set(row.type, (byType.get(row.type) ?? 0) + count);
    totalUnread += count;
  }

  const purchaseRequestsUnread = sumTypes(byType, PURCHASE_REQUEST_UNREAD_TYPES);
  const pendingQuotesUnread = sumTypes(byType, PENDING_QUOTE_UNREAD_TYPES);
  const acceptedQuotesUnread = sumTypes(byType, ACCEPTED_QUOTE_UNREAD_TYPES);
  const quotesUnread = pendingQuotesUnread + acceptedQuotesUnread;

  return {
    count: totalUnread,
    totalUnread,
    purchaseRequestsUnread,
    quotesUnread,
    pendingQuotesUnread,
    acceptedQuotesUnread,
  };
}
