export type AppNotification = {
  id: string;
  type: string;
  productId: string | null;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationCenterPhase =
  | 'session'
  | 'signedOut'
  | 'unverified'
  | 'profileUnavailable'
  | 'loading'
  | 'error'
  | 'empty'
  | 'list';

export type NotificationDestination =
  | { screen: 'ProductDetail'; params: { productId: string } }
  | { screen: 'EditProduct'; params: { productId: string } }
  | { screen: 'RequestDetail'; params: { requestId: string } }
  | { screen: 'FarmDetail'; params: { farmId: string } }
  | { screen: 'ConversationThread'; params: { conversationId: string } }
  | { screen: 'FarmProfile' }
  | { screen: 'MyQuotes' }
  | { screen: 'MyRequests' }
  | { screen: 'RfqDetail'; params: { rfqId: string } }
  | { screen: 'RfqInbox' };

export type NotificationOpenPlan = {
  /** Unread notifications are marked read before navigation. Already-read ones are not. */
  markRead: boolean;
  destination: NotificationDestination | null;
};

const LOCALES = new Set(['ka', 'en', 'ru', 'de', 'fr', 'es', 'it']);
const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** The notifications endpoints require a verified email. */
export function shouldLoadNotifications(user: { emailVerified: boolean } | null | undefined): boolean {
  return user?.emailVerified === true;
}

export function notificationCenterPhase(input: {
  authStatus: 'loading' | 'anonymous' | 'authenticated';
  user: { emailVerified: boolean } | null;
  profileUnavailable: boolean;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  count: number;
}): NotificationCenterPhase {
  if (input.authStatus === 'loading') {
    return 'session';
  }
  if (input.profileUnavailable) {
    return 'profileUnavailable';
  }
  if (!input.user) {
    return 'signedOut';
  }
  if (!input.user.emailVerified) {
    return 'unverified';
  }
  if (input.loadStatus === 'error') {
    return 'error';
  }
  if (input.loadStatus !== 'ready') {
    return 'loading';
  }
  return input.count === 0 ? 'empty' : 'list';
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function optionalText(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  return typeof value === 'string' ? value : null;
}

export function parseNotification(value: unknown): AppNotification | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = text(row.id);
  const type = text(row.type);
  const title = typeof row.title === 'string' ? row.title : null;
  const body = typeof row.body === 'string' ? row.body : null;
  const href = typeof row.href === 'string' ? row.href : null;
  const createdAt = text(row.createdAt);
  const productId = optionalText(row.productId);
  const readAt = optionalText(row.readAt);
  if (!id || !type || title == null || body == null || href == null || !createdAt) {
    return null;
  }
  if (row.productId != null && productId == null) {
    return null;
  }
  if (row.readAt != null && readAt == null) {
    return null;
  }
  return { id, type, productId, title, body, href, readAt, createdAt };
}

export function parseNotificationList(value: unknown): AppNotification[] {
  if (!Array.isArray(value)) {
    throw new Error('Notification list was not returned.');
  }
  return newestFirst(value.flatMap((item) => {
    const parsed = parseNotification(item);
    return parsed ? [parsed] : [];
  }));
}

export function parseUnreadCount(value: unknown): number {
  if (!value || typeof value !== 'object') {
    throw new Error('Unread count was not returned.');
  }
  const row = value as { totalUnread?: unknown; count?: unknown };
  const raw = typeof row.totalUnread === 'number' ? row.totalUnread : row.count;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new Error('Unread count was not returned.');
  }
  return Math.max(0, Math.floor(raw));
}

export function parseMarkedNotification(value: unknown): AppNotification {
  const parsed = parseNotification(value);
  if (!parsed?.readAt) {
    throw new Error('Notification was not marked read.');
  }
  return parsed;
}

export function newestFirst(items: readonly AppNotification[]): AppNotification[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return 0;
    }
    return rightTime - leftTime;
  });
}

/** 0 hides the badge. Large totals stay compact on the tab. */
export function compactUnreadBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  const whole = Math.floor(count);
  return whole > 99 ? '99+' : String(whole);
}

export function claimMarkRead(pending: readonly string[], id: string, readAt: string | null): string[] | null {
  if (readAt || pending.includes(id)) {
    return null;
  }
  return [...pending, id];
}

export function applyNotificationRead(items: readonly AppNotification[], updated: AppNotification): AppNotification[] {
  return items.map((item) => (item.id === updated.id ? { ...item, readAt: updated.readAt } : item));
}

export function applyAllNotificationsRead(items: readonly AppNotification[], readAt: string): AppNotification[] {
  return items.map((item) => (item.readAt ? item : { ...item, readAt }));
}

/** A failed mark-all leaves every loaded notification unread. */
export function commitMarkAll(
  items: readonly AppNotification[],
  succeeded: boolean,
  readAt: string,
): AppNotification[] {
  if (!succeeded) {
    return [...items];
  }
  return applyAllNotificationsRead(items, readAt);
}

export function shouldShowMarkAll(phase: NotificationCenterPhase, hasUnread: boolean): boolean {
  return phase === 'list' && hasUnread;
}

/** A second tap is ignored while the first mark-all request is still in flight. */
export function claimMarkAll(inFlight: boolean, hasUnread: boolean): boolean {
  return !inFlight && hasUnread;
}

export function unreadCountAfterRead(count: number, wasUnread: boolean): number {
  if (!wasUnread) {
    return count;
  }
  return Math.max(0, count - 1);
}

export function hasUnreadNotifications(items: readonly AppNotification[], unreadCount: number): boolean {
  return unreadCount > 0 || items.some((item) => !item.readAt);
}

function resourceId(segment: string | undefined): string | null {
  if (!segment) {
    return null;
  }
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return RESOURCE_ID.test(decoded) ? decoded : null;
}

function notificationPath(href: string): string[] | null {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }
  let path = trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      path = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  }
  const withoutSuffix = path.split('?')[0]?.split('#')[0] ?? '';
  const parts = withoutSuffix.split('/').filter(Boolean);
  if (parts[0] && LOCALES.has(parts[0])) {
    parts.shift();
  }
  return parts;
}

/**
 * Decides whether a tap marks the row read and which existing screen it opens.
 * A missing destination still marks an unread row read and stays on Notifications.
 * A tap is ignored while that row, or mark-all, is already in flight.
 */
export function planNotificationOpen(input: {
  item: AppNotification | undefined;
  pending: boolean;
  markingAll: boolean;
}): NotificationOpenPlan | null {
  if (!input.item || input.pending || input.markingAll) {
    return null;
  }
  return {
    markRead: input.item.readAt == null,
    destination: notificationDestination(input.item.href),
  };
}

/**
 * Maps a stored website href onto an existing mobile screen.
 * Supported:
 * - /products/:productId → ProductDetail
 *   (productApproved, harvestAvailable, harvestPreorderOpen)
 * - /dashboard/products/:productId/edit → EditProduct
 *   (productRejected, productCertificateApproved, productCertificateRejected)
 * - /requests/:requestId → RequestDetail
 *   (newPurchaseRequest, purchaseQuoteReceived, purchaseQuoteAccepted, purchaseQuoteWithdrawn)
 * - /farms/:farmId → FarmDetail
 * - /dashboard/chat/:conversationId → ConversationThread
 * - /dashboard/farm → FarmProfile
 *   (verificationApproved, verificationRejected, farmDocumentApproved, farmDocumentRejected)
 * - /dashboard/quotes → MyQuotes
 *   (purchaseQuoteDeclined, purchaseRequestClosed, purchaseRequestCancelled;
 *    these hrefs do not include a request id)
 * - /dashboard/purchase-requests → MyRequests
 *   (purchaseRequestModerated; the href does not include a request id)
 * - /dashboard/inbox/:rfqId and /dashboard/rfqs/:rfqId → RfqDetail
 *   (rfqCreated, rfqAccepted, rfqDeclinedByBuyer, rfqOfferCreated, rfqDeclinedByFarmer)
 * - /dashboard/inbox → RfqInbox
 *   (rfqCancelled; this href has no RFQ id)
 * An RFQ id is never opened as a purchase request.
 */
export function notificationDestination(href: string): NotificationDestination | null {
  const parts = notificationPath(href);
  if (!parts) {
    return null;
  }
  if (parts[0] === 'products' && parts.length === 2) {
    const productId = resourceId(parts[1]);
    return productId ? { screen: 'ProductDetail', params: { productId } } : null;
  }
  if (parts[0] === 'requests' && parts.length === 2) {
    const requestId = resourceId(parts[1]);
    return requestId ? { screen: 'RequestDetail', params: { requestId } } : null;
  }
  if (parts[0] === 'farms' && parts.length === 2) {
    const farmId = resourceId(parts[1]);
    return farmId ? { screen: 'FarmDetail', params: { farmId } } : null;
  }
  if (parts[0] === 'dashboard' && parts[1] === 'chat' && parts.length === 3) {
    const conversationId = resourceId(parts[2]);
    return conversationId ? { screen: 'ConversationThread', params: { conversationId } } : null;
  }
  if (parts[0] === 'dashboard' && parts[1] === 'farm' && parts.length === 2) {
    return { screen: 'FarmProfile' };
  }
  if (parts[0] === 'dashboard' && parts[1] === 'quotes' && parts.length === 2) {
    return { screen: 'MyQuotes' };
  }
  if (parts[0] === 'dashboard' && parts[1] === 'purchase-requests' && parts.length === 2) {
    return { screen: 'MyRequests' };
  }
  if (parts[0] === 'dashboard' && parts[1] === 'inbox' && parts.length === 2) {
    return { screen: 'RfqInbox' };
  }
  if (parts[0] === 'dashboard' && (parts[1] === 'inbox' || parts[1] === 'rfqs') && parts.length === 3) {
    const rfqId = resourceId(parts[2]);
    return rfqId ? { screen: 'RfqDetail', params: { rfqId } } : null;
  }
  if (parts[0] === 'dashboard' && parts[1] === 'products' && parts[3] === 'edit' && parts.length === 4) {
    const productId = resourceId(parts[2]);
    return productId ? { screen: 'EditProduct', params: { productId } } : null;
  }
  return null;
}

export function formatNotificationTime(
  iso: string,
  locale: string,
  labels: { yesterday: string },
  now = new Date(),
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  if (dayDiff === 0) {
    return time;
  }
  if (dayDiff === 1) {
    return `${labels.yesterday}, ${time}`;
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  const datePart = new Intl.DateTimeFormat(
    locale,
    sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' },
  ).format(date);
  return `${datePart}, ${time}`;
}
