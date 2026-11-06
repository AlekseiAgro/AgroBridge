import { productDetailAuth, productDetailPath } from '../catalog/api';
import {
  applyNotificationRead,
  claimMarkAll,
  claimMarkRead,
  commitMarkAll,
  compactUnreadBadge,
  formatNotificationTime,
  hasUnreadNotifications,
  shouldShowMarkAll,
  notificationCenterPhase,
  notificationDestination,
  planNotificationOpen,
  parseNotificationList,
  parseUnreadCount,
  shouldLoadNotifications,
  unreadCountAfterRead,
  type AppNotification,
} from './inbox';

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    type: 'chatMessage',
    productId: null,
    title: 'New message',
    body: 'Nino wrote to you.',
    href: '/dashboard/chat/c1',
    readAt: null,
    createdAt: '2026-10-02T10:00:00.000Z',
    ...overrides,
  };
}

const verified = { emailVerified: true };

describe('notification center access', () => {
  it('loads only for a verified account', () => {
    expect(shouldLoadNotifications(null)).toBe(false);
    expect(shouldLoadNotifications({ emailVerified: false })).toBe(false);
    expect(shouldLoadNotifications(verified)).toBe(true);
  });

  it('keeps signed-out and unverified users off the request', () => {
    expect(
      notificationCenterPhase({
        authStatus: 'anonymous',
        user: null,
        profileUnavailable: false,
        loadStatus: 'idle',
        count: 0,
      }),
    ).toBe('signedOut');
    expect(
      notificationCenterPhase({
        authStatus: 'authenticated',
        user: { emailVerified: false },
        profileUnavailable: false,
        loadStatus: 'idle',
        count: 0,
      }),
    ).toBe('unverified');
    expect(
      notificationCenterPhase({
        authStatus: 'loading',
        user: null,
        profileUnavailable: false,
        loadStatus: 'idle',
        count: 0,
      }),
    ).toBe('session');
  });

  it('shows loading, empty, error, and populated states', () => {
    expect(
      notificationCenterPhase({
        authStatus: 'authenticated',
        user: verified,
        profileUnavailable: false,
        loadStatus: 'loading',
        count: 0,
      }),
    ).toBe('loading');
    expect(
      notificationCenterPhase({
        authStatus: 'authenticated',
        user: verified,
        profileUnavailable: false,
        loadStatus: 'error',
        count: 0,
      }),
    ).toBe('error');
    expect(
      notificationCenterPhase({
        authStatus: 'authenticated',
        user: verified,
        profileUnavailable: false,
        loadStatus: 'ready',
        count: 0,
      }),
    ).toBe('empty');
    expect(
      notificationCenterPhase({
        authStatus: 'authenticated',
        user: verified,
        profileUnavailable: false,
        loadStatus: 'ready',
        count: 2,
      }),
    ).toBe('list');
  });
});

describe('notification list model', () => {
  it('keeps the server fields and orders newest first', () => {
    const items = parseNotificationList([
      notification({ id: 'older', createdAt: '2026-10-01T10:00:00.000Z' }),
      notification({ id: 'newer', createdAt: '2026-10-02T10:00:00.000Z', productId: 'p1' }),
    ]);
    expect(items.map((item) => item.id)).toEqual(['newer', 'older']);
    expect(items[0]).toMatchObject({
      type: 'chatMessage',
      productId: 'p1',
      title: 'New message',
      body: 'Nino wrote to you.',
      href: '/dashboard/chat/c1',
      readAt: null,
    });
  });

  it('drops a malformed row without dropping the list', () => {
    expect(parseNotificationList([notification(), { id: 'bad' }])).toHaveLength(1);
  });

  it('rejects a response that is not a list', () => {
    expect(() => parseNotificationList({ items: [] })).toThrow('Notification list was not returned.');
  });

  it('reads the unread total', () => {
    expect(parseUnreadCount({ count: 4, totalUnread: 4 })).toBe(4);
    expect(parseUnreadCount({ count: 2 })).toBe(2);
    expect(() => parseUnreadCount({})).toThrow('Unread count was not returned.');
  });
});

describe('notification read state', () => {
  it('marks one unread notification read and leaves the others', () => {
    const updated = applyNotificationRead(
      [notification(), notification({ id: 'n2', readAt: '2026-10-01T00:00:00.000Z' })],
      notification({ readAt: '2026-10-02T12:00:00.000Z' }),
    );
    expect(updated[0]?.readAt).toBe('2026-10-02T12:00:00.000Z');
    expect(updated[1]?.readAt).toBe('2026-10-01T00:00:00.000Z');
    expect(unreadCountAfterRead(3, true)).toBe(2);
  });

  it('marks every loaded notification read and hides the mark-all action', () => {
    const updated = commitMarkAll(
      [notification(), notification({ id: 'n2' })],
      true,
      '2026-10-02T12:00:00.000Z',
    );
    expect(updated.every((item) => item.readAt)).toBe(true);
    expect(hasUnreadNotifications(updated, 0)).toBe(false);
    expect(shouldShowMarkAll('list', hasUnreadNotifications(updated, 0))).toBe(false);
    expect(compactUnreadBadge(0)).toBeNull();
  });

  it('shows mark all only while something is unread', () => {
    expect(shouldShowMarkAll('list', hasUnreadNotifications([notification()], 1))).toBe(true);
    expect(
      shouldShowMarkAll('list', hasUnreadNotifications([notification({ readAt: '2026-10-02T12:00:00.000Z' })], 0)),
    ).toBe(false);
    expect(shouldShowMarkAll('empty', false)).toBe(false);
  });

  it('does not mark notifications read when mark-all fails, and ignores a repeated tap', () => {
    const items = [notification(), notification({ id: 'n2' })];
    expect(commitMarkAll(items, false, '2026-10-02T12:00:00.000Z')).toEqual(items);
    expect(claimMarkAll(false, true)).toBe(true);
    expect(claimMarkAll(true, true)).toBe(false);
    expect(claimMarkAll(false, false)).toBe(false);
  });

  it('ignores a repeated tap while a mark-read request is already in flight', () => {
    const first = claimMarkRead([], 'n1', null);
    expect(first).toEqual(['n1']);
    expect(claimMarkRead(first ?? [], 'n1', null)).toBeNull();
    expect(claimMarkRead([], 'n1', '2026-10-02T12:00:00.000Z')).toBeNull();
  });

  it('shows a compact unread badge and hides zero', () => {
    expect(compactUnreadBadge(0)).toBeNull();
    expect(compactUnreadBadge(3)).toBe('3');
    expect(compactUnreadBadge(120)).toBe('99+');
  });
});

describe('notification destinations', () => {
  it('opens the exact object stored on each actionable notification href', () => {
    const cases: { type: string; href: string; destination: ReturnType<typeof notificationDestination> }[] = [
      {
        type: 'chatMessage',
        href: '/dashboard/chat/conv_1',
        destination: { screen: 'ConversationThread', params: { conversationId: 'conv_1' } },
      },
      {
        type: 'productApproved',
        href: '/products/prod_1',
        destination: { screen: 'ProductDetail', params: { productId: 'prod_1' } },
      },
      {
        type: 'harvestAvailable',
        href: '/products/prod_1',
        destination: { screen: 'ProductDetail', params: { productId: 'prod_1' } },
      },
      {
        type: 'harvestPreorderOpen',
        href: 'https://agrobridge.ge/en/products/prod_1',
        destination: { screen: 'ProductDetail', params: { productId: 'prod_1' } },
      },
      {
        type: 'productRejected',
        href: '/en/dashboard/products/prod_1/edit',
        destination: { screen: 'EditProduct', params: { productId: 'prod_1' } },
      },
      {
        type: 'productCertificateApproved',
        href: '/dashboard/products/prod_1/edit',
        destination: { screen: 'EditProduct', params: { productId: 'prod_1' } },
      },
      {
        type: 'productCertificateRejected',
        href: '/dashboard/products/prod_1/edit?tab=certificates',
        destination: { screen: 'EditProduct', params: { productId: 'prod_1' } },
      },
      {
        type: 'newPurchaseRequest',
        href: '/requests/req_1',
        destination: { screen: 'RequestDetail', params: { requestId: 'req_1' } },
      },
      {
        type: 'purchaseQuoteReceived',
        href: 'https://agrobridge.ge/en/requests/req_1',
        destination: { screen: 'RequestDetail', params: { requestId: 'req_1' } },
      },
      {
        type: 'purchaseQuoteAccepted',
        href: '/requests/req_1',
        destination: { screen: 'RequestDetail', params: { requestId: 'req_1' } },
      },
      {
        type: 'purchaseQuoteWithdrawn',
        href: '/ka/requests/req_1',
        destination: { screen: 'RequestDetail', params: { requestId: 'req_1' } },
      },
      {
        type: 'purchaseQuoteDeclined',
        href: '/dashboard/quotes',
        destination: { screen: 'MyQuotes' },
      },
      {
        type: 'purchaseRequestClosed',
        href: '/en/dashboard/quotes',
        destination: { screen: 'MyQuotes' },
      },
      {
        type: 'purchaseRequestCancelled',
        href: 'https://agrobridge.ge/ru/dashboard/quotes',
        destination: { screen: 'MyQuotes' },
      },
      {
        type: 'purchaseRequestModerated',
        href: '/dashboard/purchase-requests',
        destination: { screen: 'MyRequests' },
      },
      {
        type: 'verificationApproved',
        href: '/dashboard/farm',
        destination: { screen: 'FarmProfile' },
      },
      {
        type: 'verificationRejected',
        href: '/ka/dashboard/farm',
        destination: { screen: 'FarmProfile' },
      },
      {
        type: 'farmDocumentApproved',
        href: '/dashboard/farm',
        destination: { screen: 'FarmProfile' },
      },
      {
        type: 'farmDocumentRejected',
        href: '/dashboard/farm',
        destination: { screen: 'FarmProfile' },
      },
    ];

    for (const entry of cases) {
      expect(notificationDestination(entry.href)).toEqual(entry.destination);
    }
    expect(notificationDestination('https://agrobridge.ge/ka/dashboard/chat/conv_1')).toEqual({
      screen: 'ConversationThread',
      params: { conversationId: 'conv_1' },
    });
    expect(notificationDestination('/farms/farm_1')).toEqual({
      screen: 'FarmDetail',
      params: { farmId: 'farm_1' },
    });
  });

  it('opens a product-approved notification on that product, not the notification record', () => {
    const notificationId = 'notif_record_1';
    const productId = 'prod_tea';
    const item = notification({
      id: notificationId,
      type: 'productApproved',
      productId,
      href: `/products/${productId}`,
    });
    const destination = planNotificationOpen({
      item,
      pending: false,
      markingAll: false,
    })?.destination;

    expect(destination).toEqual({ screen: 'ProductDetail', params: { productId } });
    if (destination?.screen !== 'ProductDetail') {
      throw new Error('productApproved did not open ProductDetail');
    }
    expect(destination.params.productId).toBe(item.productId);
    expect(destination.params.productId).not.toBe(item.id);
    expect(productDetailPath(destination.params.productId, 'ru')).toBe('/products/prod_tea?locale=ru');
    expect(productDetailAuth(false, true)).toBe(true);
  });

  it('opens each RFQ notification on the RFQ screen for that exact id', () => {
    const cases = [
      {
        type: 'rfqCreated',
        href: '/dashboard/inbox/rfq_created',
        destination: { screen: 'RfqDetail', params: { rfqId: 'rfq_created' } },
      },
      {
        type: 'rfqAccepted',
        href: '/en/dashboard/inbox/rfq_accepted',
        destination: { screen: 'RfqDetail', params: { rfqId: 'rfq_accepted' } },
      },
      {
        type: 'rfqDeclinedByBuyer',
        href: 'https://agrobridge.ge/ka/dashboard/inbox/rfq_declined_buyer',
        destination: { screen: 'RfqDetail', params: { rfqId: 'rfq_declined_buyer' } },
      },
      {
        type: 'rfqOfferCreated',
        href: '/dashboard/rfqs/rfq_offer',
        destination: { screen: 'RfqDetail', params: { rfqId: 'rfq_offer' } },
      },
      {
        type: 'rfqDeclinedByFarmer',
        href: '/dashboard/rfqs/rfq_declined_farmer?locale=ru',
        destination: { screen: 'RfqDetail', params: { rfqId: 'rfq_declined_farmer' } },
      },
      {
        type: 'rfqCancelled',
        href: '/dashboard/inbox',
        destination: { screen: 'RfqInbox' },
      },
    ] as const;

    for (const entry of cases) {
      const destination = notificationDestination(entry.href);
      expect(destination).toEqual(entry.destination);
      expect(destination?.screen).not.toBe('RequestDetail');
      expect(
        planNotificationOpen({
          item: notification({ type: entry.type, href: entry.href }),
          pending: false,
          markingAll: false,
        })?.destination,
      ).toEqual(entry.destination);
    }
  });

  it('does not treat an RFQ id as a purchase request', () => {
    expect(notificationDestination('/dashboard/inbox/rfq_1')).toEqual({
      screen: 'RfqDetail',
      params: { rfqId: 'rfq_1' },
    });
    expect(notificationDestination('/en/dashboard/inbox/rfq_1')?.screen).not.toBe('RequestDetail');
    expect(notificationDestination('https://agrobridge.ge/en/dashboard/inbox/rfq_1')?.screen).not.toBe(
      'RequestDetail',
    );
    expect(notificationDestination('/dashboard/rfqs/rfq_1')?.screen).not.toBe('RequestDetail');
    expect(notificationDestination('/dashboard/inbox')?.screen).toBe('RfqInbox');
    expect(notificationDestination('/dashboard/farm/extra')).toBeNull();
    expect(notificationDestination('/dashboard/quotes/extra')).toBeNull();
    expect(notificationDestination('/requests/not a request')).toBeNull();
    expect(notificationDestination('/products/')).toBeNull();
    expect(notificationDestination('')).toBeNull();
  });

  it('marks only the tapped unread notification, then opens its exact destination', () => {
    const unread = notification({
      type: 'purchaseQuoteAccepted',
      href: '/requests/req_1',
      readAt: null,
    });
    expect(planNotificationOpen({ item: unread, pending: false, markingAll: false })).toEqual({
      markRead: true,
      destination: { screen: 'RequestDetail', params: { requestId: 'req_1' } },
    });
    expect(
      planNotificationOpen({
        item: notification({ ...unread, readAt: '2026-10-02T12:00:00.000Z' }),
        pending: false,
        markingAll: false,
      }),
    ).toEqual({
      markRead: false,
      destination: { screen: 'RequestDetail', params: { requestId: 'req_1' } },
    });
    expect(planNotificationOpen({ item: unread, pending: true, markingAll: false })).toBeNull();
    expect(planNotificationOpen({ item: unread, pending: false, markingAll: true })).toBeNull();
    expect(
      planNotificationOpen({
        item: notification({ type: 'rfqCreated', href: '/dashboard/inbox/rfq_1' }),
        pending: false,
        markingAll: false,
      }),
    ).toEqual({
      markRead: true,
      destination: { screen: 'RfqDetail', params: { rfqId: 'rfq_1' } },
    });
  });
});

describe('formatNotificationTime', () => {
  const now = new Date('2026-10-02T15:00:00.000Z');

  it('uses a localized clock for today and a localized yesterday label', () => {
    const today = formatNotificationTime('2026-10-02T10:00:00.000Z', 'en', { yesterday: 'Yesterday' }, now);
    const yesterday = formatNotificationTime('2026-10-01T10:00:00.000Z', 'en', { yesterday: 'Yesterday' }, now);
    expect(today.length).toBeGreaterThan(0);
    expect(yesterday.startsWith('Yesterday')).toBe(true);
    expect(formatNotificationTime('not-a-date', 'en', { yesterday: 'Yesterday' }, now)).toBe('');
  });
});
