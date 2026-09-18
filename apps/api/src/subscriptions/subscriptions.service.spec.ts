import { SubscriptionsService } from './subscriptions.service';
import type { NotificationsService } from '../mail/notifications.service';

describe('SubscriptionsService', () => {
  const prisma = {
    alertSubscription: { findMany: jest.fn() },
  };
  const notifications = {
    notifyNewPurchaseRequest: jest.fn().mockResolvedValue(undefined),
    notifyNewProductListing: jest.fn().mockResolvedValue(undefined),
  };

  const service = new SubscriptionsService(
    prisma as never,
    notifications as unknown as NotificationsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function sub(overrides: Record<string, unknown> = {}) {
    return {
      notifyPurchaseRequests: true,
      allCategories: true,
      categories: [],
      allRegions: true,
      regions: [],
      user: { email: 'farmer@example.com', locale: 'en', displayName: 'Nino' },
      ...overrides,
    };
  }

  it('mails only opted-in, unblocked subscribers whose category filter matches', async () => {
    prisma.alertSubscription.findMany.mockResolvedValue([
      sub(),
      sub({
        user: { email: 'berries@example.com', locale: 'ru', displayName: 'Berries' },
        allCategories: false,
        categories: ['berries'],
      }),
      sub({
        user: { email: 'nuts@example.com', locale: 'en', displayName: 'Nuts' },
        allCategories: false,
        categories: ['nuts'],
      }),
    ]);

    await service.notifyNewPurchaseRequest({
      requestId: 'r1',
      title: 'Blueberries',
      category: 'berries',
      quantity: '1t',
      unit: 't',
      buyerUserId: 'buyer-1',
      buyerName: 'Buyer Ltd',
    });

    expect(prisma.alertSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          notifyPurchaseRequests: true,
          user: { blockedAt: null, id: { not: 'buyer-1' } },
        },
      }),
    );
    const recipients = notifications.notifyNewPurchaseRequest.mock.calls.map(
      (call) => call[0].user.email,
    );
    expect(recipients).toEqual(['farmer@example.com', 'berries@example.com']);
    expect(notifications.notifyNewPurchaseRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'r1',
        title: 'Blueberries',
        buyerName: 'Buyer Ltd',
        quantity: '1t',
        unit: 't',
      }),
    );
  });

  it('sends nothing when nobody is subscribed to purchase-request alerts', async () => {
    prisma.alertSubscription.findMany.mockResolvedValue([]);

    await service.notifyNewPurchaseRequest({
      requestId: 'r1',
      title: 'Blueberries',
      category: 'berries',
      quantity: '1t',
      unit: null,
      buyerUserId: 'buyer-1',
      buyerName: 'Buyer Ltd',
    });

    expect(notifications.notifyNewPurchaseRequest).not.toHaveBeenCalled();
  });
});
