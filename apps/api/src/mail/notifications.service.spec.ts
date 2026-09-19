import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import type { MailService } from './mail.service';

describe('NotificationsService', () => {
  const mail = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  const userNotification = {
    create: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(
      mail as unknown as MailService,
      {
        get: (key: string) => {
          if (key === 'WEB_PUBLIC_URL') return 'http://localhost:3000';
          return undefined;
        },
      } as ConfigService,
      {
        userNotification,
      } as never,
    );
  });

  it('sends verification through the mail abstraction with a UTF-8 subject', async () => {
    await service.notifyVerificationCode({
      user: { email: 'farmer@example.com', locale: 'ka', displayName: 'ნინო' },
      code: '123456',
      channel: 'email',
    });

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'farmer@example.com',
        subject: 'AgroBridge-ის ვერიფიკაციის კოდი',
        text: expect.stringContaining('123456'),
      }),
    );
    expect(mail.send.mock.calls[0][0].text).toContain('ნინო');
  });

  it('sends a localized welcome email', async () => {
    await service.notifyWelcome({
      email: 'farmer@example.com',
      locale: 'ru',
      displayName: 'Nino',
      role: 'farmer',
    });

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'farmer@example.com',
        subject: expect.stringContaining('AgroBridge'),
        text: expect.stringContaining('Nino'),
      }),
    );
    expect(mail.send.mock.calls[0][0].text).toContain('http://localhost:3000/ru/verify-email');
  });

  it('does not throw when mail delivery fails', async () => {
    mail.send.mockRejectedValueOnce(new Error('smtp down'));

    await expect(
      service.notifyProductApproved({
        farmer: {
          email: 'farmer@example.com',
          locale: 'en',
          displayName: 'Farmer',
        },
        productTitle: 'Hazelnuts',
        productId: 'p1',
      }),
    ).resolves.toBeUndefined();
  });

  it('sends a localized product pending moderation email', async () => {
    await service.notifyProductPendingModeration({
      admin: {
        email: 'admin@example.com',
        locale: 'ru',
        displayName: 'Admin',
      },
      productTitle: 'Hazelnuts',
      productId: 'p1',
      sellerName: 'Nino',
    });

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: expect.stringContaining('Hazelnuts'),
        text: expect.stringContaining('Nino'),
      }),
    );
    expect(mail.send.mock.calls[0][0].text).toContain(
      'http://localhost:3000/ru/dashboard/admin?section=products&status=pending',
    );
  });

  it('sends a localized chat message email', async () => {
    await service.notifyChatMessage({
      recipient: {
        email: 'buyer@example.com',
        locale: 'ru',
        displayName: 'Buyer',
      },
      senderName: 'Nino',
      preview: 'Hello from the farm',
      conversationId: 'c1',
    });

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        subject: expect.stringContaining('Nino'),
        text: expect.stringContaining('Hello from the farm'),
      }),
    );
    expect(mail.send.mock.calls[0][0].text).toContain('http://localhost:3000/ru/dashboard/chat/c1');
  });

  it('tells admins a verification needs review without exposing the document', async () => {
    await service.notifyVerificationPendingModeration({
      admin: { email: 'admin@agrobridge.ge', locale: 'ru', displayName: 'Admin' },
      farmId: 'farm1',
      farmName: 'Kakheti Farm',
      sellerType: 'privateFarmer',
      submittedAt: new Date('2026-09-16T10:30:00.000Z'),
    });

    const sent = mail.send.mock.calls[0][0];
    expect(sent.to).toBe('admin@agrobridge.ge');
    expect(sent.subject).toContain('Kakheti Farm');
    expect(sent.text).toContain('частный фермер');
    expect(sent.text).toContain('farm1');
    expect(sent.text).toContain(
      'http://localhost:3000/ru/dashboard/admin?section=farms&status=documents',
    );
    expect(sent.text).not.toContain('/api/uploads/');
    expect(sent.text).not.toContain('farms/farm1/documents');
    expect(sent.text).not.toContain('/file');
  });

  it('reports whether the verification alert reached the admin', async () => {
    const params = {
      admin: { email: 'admin@agrobridge.ge', locale: 'ru', displayName: 'Admin' },
      farmId: 'farm1',
      farmName: 'Kakheti Farm',
      sellerType: 'privateFarmer' as const,
      submittedAt: new Date('2026-09-16T10:30:00.000Z'),
    };

    await expect(service.notifyVerificationPendingModeration(params)).resolves.toBe(true);

    mail.send.mockRejectedValueOnce(new Error('resend unavailable'));
    // Delivery failures stay non-throwing, but the caller must be able to retry later.
    await expect(service.notifyVerificationPendingModeration(params)).resolves.toBe(false);
  });

  it('tells the producer their verification passed, in their own language', async () => {
    await expect(
      service.notifyVerificationApproved({
        farmer: { email: 'farmer@example.com', locale: 'ru', displayName: 'Нино' },
        farmName: 'Kakheti Farm',
      }),
    ).resolves.toBe(true);

    const sent = mail.send.mock.calls[0][0];
    expect(sent.to).toBe('farmer@example.com');
    expect(sent.subject).toContain('Верификация пройдена');
    expect(sent.text).toContain('Kakheti Farm');
    expect(sent.text).toContain('http://localhost:3000/ru/dashboard/farm');
  });

  it('translates the rejection reason and keeps the moderator comment verbatim', async () => {
    await service.notifyVerificationRejected({
      farmer: { email: 'farmer@example.com', locale: 'ru', displayName: 'Нино' },
      farmName: 'Kakheti Farm',
      reasonCode: 'documentRejected',
      moderatorComment: 'Scan is unreadable',
    });

    const sent = mail.send.mock.calls[0][0];
    expect(sent.subject).toContain('Верификация отклонена');
    expect(sent.text).toContain('Модератор не принял документ для верификации.');
    expect(sent.text).toContain('Комментарий модератора: Scan is unreadable');
    // Internal wording must never reach the producer.
    expect(sent.text).not.toContain('documentRejected');
    expect(sent.text).not.toContain('Verification document rejected');
  });

  it('omits the comment block when a rejection has no moderator comment', async () => {
    await service.notifyVerificationRejected({
      farmer: { email: 'farmer@example.com', locale: 'en', displayName: 'Farmer' },
      farmName: 'Kakheti Farm',
      reasonCode: 'registryNotConfirmed',
      moderatorComment: null,
    });

    const sent = mail.send.mock.calls[0][0];
    expect(sent.text).toContain('The company registration could not be confirmed.');
    expect(sent.text).not.toContain('Moderator comment');
  });

  it('falls back to English for an unknown locale and an unknown reason', async () => {
    await service.notifyVerificationRejected({
      farmer: { email: 'farmer@example.com', locale: 'pt', displayName: 'Farmer' },
      farmName: 'Kakheti Farm',
      reasonCode: null,
      moderatorComment: null,
    });

    const sent = mail.send.mock.calls[0][0];
    expect(sent.subject).toBe('Verification not approved: Kakheti Farm');
    expect(sent.text).toContain('The verification requirements were not met.');
  });

  it('reports a failed decision email instead of throwing', async () => {
    mail.send.mockRejectedValueOnce(new Error('resend unavailable'));

    await expect(
      service.notifyVerificationApproved({
        farmer: { email: 'farmer@example.com', locale: 'en', displayName: 'Farmer' },
        farmName: 'Kakheti Farm',
      }),
    ).resolves.toBe(false);
  });

  it('builds password-reset links from WEB_PUBLIC_URL, not the request host', async () => {
    await service.notifyPasswordReset({
      email: 'farmer@example.com',
      locale: 'ka',
      displayName: 'Nino',
      rawToken: 'opaque-reset-token',
      expiresMinutes: 30,
    });

    const text = mail.send.mock.calls[0][0].text as string;
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'farmer@example.com',
        subject: expect.stringContaining('AgroBridge'),
      }),
    );
    expect(text).toContain('http://localhost:3000/ka/reset-password?token=opaque-reset-token');
    expect(text).toContain('30');
    expect(text).not.toContain('evil.example');
  });

  describe('purchase request lifecycle emails', () => {
    it('mails opted-in suppliers a new purchase request in their locale', async () => {
      await service.notifyNewPurchaseRequest({
        user: { email: 'farmer@example.com', locale: 'ru', displayName: 'Нино' },
        title: 'Blueberries',
        requestId: 'r1',
        buyerName: 'Buyer Ltd',
        category: 'berries',
        quantity: '1t',
        unit: 't',
      });

      expect(mail.send).toHaveBeenCalledTimes(1);
      const sent = mail.send.mock.calls[0][0];
      expect(sent.to).toBe('farmer@example.com');
      expect(sent.subject).toBe('Новый запрос на покупку: Blueberries');
      expect(sent.text).toContain('Buyer Ltd');
      expect(sent.text).toContain('1t t');
      expect(sent.text).toContain('http://localhost:3000/ru/requests/r1');
      expect(sent.text).toContain('http://localhost:3000/ru/dashboard/subscriptions');
    });

    it('mails the buyer when a quote arrives', async () => {
      await service.notifyPurchaseQuoteReceived({
        buyer: { id: 'b1', email: 'buyer@example.com', locale: 'en', displayName: 'Buyer Ltd' },
        farmName: 'Kakheti Farm',
        title: 'Blueberries',
        priceAmount: '12.50',
        currency: 'USD',
        requestId: 'r1',
      });

      const sent = mail.send.mock.calls[0][0];
      expect(sent.to).toBe('buyer@example.com');
      expect(sent.subject).toBe('New quote for Blueberries');
      expect(sent.text).toContain('Kakheti Farm');
      expect(sent.text).toContain('12.50 USD');
      expect(sent.text).toContain('http://localhost:3000/en/requests/r1');
    });

    it('mails the winning supplier that their quote was accepted', async () => {
      await service.notifyPurchaseQuoteAccepted({
        farmer: { id: 'f1', email: 'farmer@example.com', locale: 'ka', displayName: 'ნინო' },
        buyerName: 'Buyer Ltd',
        buyerDisplayName: 'Buyer Ltd',
        title: 'Blueberries',
        requestId: 'r1',
      });

      const sent = mail.send.mock.calls[0][0];
      expect(sent.to).toBe('farmer@example.com');
      expect(sent.subject).toContain('Blueberries');
      expect(sent.text).toContain('Buyer Ltd');
      expect(sent.text).toContain('http://localhost:3000/ka/requests/r1');
    });

    it('mails a losing supplier that their quote was not selected', async () => {
      await service.notifyPurchaseQuoteDeclined({
        farmer: { id: 'f1', email: 'farmer@example.com', locale: 'ru', displayName: 'Нино' },
        buyerName: 'Buyer Ltd',
        buyerDisplayName: 'Buyer Ltd',
        title: 'Blueberries',
      });

      const sent = mail.send.mock.calls[0][0];
      expect(sent.subject).toBe('Ваше предложение не выбрано: «Blueberries»');
      expect(sent.text).toContain('Buyer Ltd');
    });

    it('uses the closed template, not the declined template, when a request is closed', async () => {
      await service.notifyPurchaseRequestWithdrawn({
        farmer: { id: 'f1', email: 'farmer@example.com', locale: 'en', displayName: 'Nino' },
        buyerName: 'Buyer Ltd',
        buyerDisplayName: 'Buyer Ltd',
        title: 'Blueberries',
        reason: 'closed',
      });

      const sent = mail.send.mock.calls[0][0];
      expect(sent.subject).toBe('Purchase request closed: Blueberries');
      expect(sent.text).toContain('closed the purchase request');
      expect(sent.text).not.toContain('did not select');
    });

    it('uses the cancelled template when a request is cancelled', async () => {
      await service.notifyPurchaseRequestWithdrawn({
        farmer: { id: 'f1', email: 'farmer@example.com', locale: 'ru', displayName: 'Нино' },
        buyerName: 'Buyer Ltd',
        buyerDisplayName: 'Buyer Ltd',
        title: 'Blueberries',
        reason: 'cancelled',
      });

      const sent = mail.send.mock.calls[0][0];
      expect(sent.subject).toBe('Запрос на закупку отменён: «Blueberries»');
      expect(sent.text).toContain('отменил');
    });

    it('does not throw when a purchase-request email cannot be delivered', async () => {
      mail.send.mockRejectedValueOnce(new Error('smtp down'));

      await expect(
        service.notifyPurchaseQuoteReceived({
          buyer: { id: 'b1', email: 'buyer@example.com', locale: 'en', displayName: 'Buyer Ltd' },
          farmName: 'Kakheti Farm',
          title: 'Blueberries',
          priceAmount: '12.50',
          currency: 'USD',
          requestId: 'r1',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('purchase request lifecycle in-app notifications', () => {
    function createdNotification() {
      expect(userNotification.create).toHaveBeenCalledTimes(1);
      return userNotification.create.mock.calls[0][0].data as {
        userId: string;
        type: string;
        productId: string | null;
        title: string;
        body: string;
        href: string;
      };
    }

    it('notifies only the buyer when a quote arrives', async () => {
      await service.notifyPurchaseQuoteReceived({
        buyer: { id: 'b1', email: 'buyer@secret.test', locale: 'en', displayName: 'Buyer Ltd' },
        farmName: 'Kakheti Farm',
        title: 'Blueberries',
        priceAmount: '12.50',
        currency: 'USD',
        requestId: 'r1',
      });

      expect(createdNotification()).toEqual({
        userId: 'b1',
        type: 'purchaseQuoteReceived',
        productId: null,
        title: 'New quote received',
        body: 'Kakheti Farm sent a quote for your purchase request “Blueberries”.',
        href: '/requests/r1',
      });
      expect(createdNotification().body).not.toContain('buyer@secret.test');
      expect(createdNotification().body).not.toContain('12.50');
    });

    it('notifies the winning seller on the request they may still open', async () => {
      await service.notifyPurchaseQuoteAccepted({
        farmer: { id: 'f1', email: 'farmer@secret.test', locale: 'en', displayName: 'Nino' },
        buyerName: 'buyer@secret.test',
        buyerDisplayName: 'Buyer Ltd',
        title: 'Blueberries',
        requestId: 'r1',
      });

      expect(createdNotification()).toEqual({
        userId: 'f1',
        type: 'purchaseQuoteAccepted',
        productId: null,
        title: 'Your quote was accepted',
        body: 'Buyer Ltd accepted your quote for the purchase request “Blueberries”.',
        href: '/requests/r1',
      });
      expect(createdNotification().body).not.toContain('buyer@secret.test');
      expect(createdNotification().body).not.toMatch(/completed|сделк/i);
    });

    it('sends declined sellers to My Quotes instead of the private request', async () => {
      await service.notifyPurchaseQuoteDeclined({
        farmer: { id: 'f2', email: 'loser@secret.test', locale: 'en', displayName: "Loser's Farm" },
        buyerName: 'buyer@secret.test',
        buyerDisplayName: null,
        title: 'Blueberries',
      });

      expect(createdNotification()).toEqual(
        expect.objectContaining({
          userId: 'f2',
          type: 'purchaseQuoteDeclined',
          productId: null,
          href: '/dashboard/quotes',
        }),
      );
      expect(createdNotification().body).toContain('A buyer');
      expect(createdNotification().body).not.toContain('buyer@secret.test');
    });

    it('keeps close and cancel copy distinct and seller-only', async () => {
      await service.notifyPurchaseRequestWithdrawn({
        farmer: { id: 'f1', email: 'farmer@example.com', locale: 'en', displayName: 'Nino' },
        buyerName: 'Buyer Ltd',
        buyerDisplayName: 'Buyer Ltd',
        title: 'Blueberries',
        reason: 'closed',
      });
      const closed = createdNotification();

      userNotification.create.mockClear();
      await service.notifyPurchaseRequestWithdrawn({
        farmer: { id: 'f1', email: 'farmer@example.com', locale: 'en', displayName: 'Nino' },
        buyerName: 'Buyer Ltd',
        buyerDisplayName: 'Buyer Ltd',
        title: 'Blueberries',
        reason: 'cancelled',
      });
      const cancelled = createdNotification();

      expect(closed).toEqual(
        expect.objectContaining({
          userId: 'f1',
          type: 'purchaseRequestClosed',
          productId: null,
          href: '/dashboard/quotes',
        }),
      );
      expect(cancelled).toEqual(
        expect.objectContaining({
          userId: 'f1',
          type: 'purchaseRequestCancelled',
          productId: null,
          href: '/dashboard/quotes',
        }),
      );
      expect(closed.body).not.toBe(cancelled.body);
      expect(closed.title).not.toBe(cancelled.title);
    });

    it('notifies only the buyer when a quote is withdrawn and sends no email', async () => {
      await service.notifyPurchaseQuoteWithdrawn({
        buyer: { id: 'b1', email: 'buyer@secret.test', locale: 'en', displayName: 'Buyer Ltd' },
        farmName: 'Kakheti Farm',
        title: 'Blueberries',
        requestId: 'r1',
      });

      expect(createdNotification()).toEqual({
        userId: 'b1',
        type: 'purchaseQuoteWithdrawn',
        productId: null,
        title: 'A quote was withdrawn',
        body: 'Kakheti Farm withdrew a quote from your purchase request “Blueberries”.',
        href: '/requests/r1',
      });
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('lists only the current user\'s notifications', async () => {
      userNotification.findMany.mockResolvedValue([]);

      await service.listMine('user-1', 30);

      expect(userNotification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    });
  });
});
