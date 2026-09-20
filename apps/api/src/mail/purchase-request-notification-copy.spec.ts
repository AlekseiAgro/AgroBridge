import { readFileSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import type { MailService } from './mail.service';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const MESSAGES_DIR = join(__dirname, '../../../web/messages');

function loadMessages(locale: string) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
    subscriptions: {
      inboxHint: string;
      inboxEmpty: string;
    };
  };
}

describe('purchase request notification copy', () => {
  const userNotification = {
    create: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };

  const service = new NotificationsService(
    { send: jest.fn().mockResolvedValue(undefined) } as unknown as MailService,
    { get: () => 'http://localhost:3000' } as unknown as ConfigService,
    { userNotification } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('localizes the Alerts inbox copy in every locale', () => {
    for (const locale of LOCALES) {
      const { inboxHint, inboxEmpty } = loadMessages(locale).subscriptions;
      expect(inboxHint.trim().length).toBeGreaterThan(0);
      expect(inboxEmpty.trim().length).toBeGreaterThan(0);
      expect(inboxEmpty.toLowerCase()).not.toMatch(/only harvest|только.*урож|только harvest/);
    }
  });

  it('writes localized in-app titles and bodies for every locale', async () => {
    for (const locale of LOCALES) {
      userNotification.create.mockClear();
      await service.notifyPurchaseQuoteReceived({
        buyer: { id: 'b1', email: 'buyer@example.com', locale, displayName: 'Buyer Ltd' },
        farmName: 'Kakheti Farm',
        title: 'Blueberries',
        priceAmount: '12.50',
        currency: 'USD',
        requestId: 'r1',
      });
      const created = userNotification.create.mock.calls[0][0].data as {
        title: string;
        body: string;
      };
      expect(created.title.trim().length).toBeGreaterThan(0);
      expect(created.body.trim().length).toBeGreaterThan(0);
      expect(created.body.toLowerCase()).not.toContain('котиров');
    }
  });

  it('keeps Russian marketplace wording on запрос на покупку, предложение and Мои предложения', async () => {
    await service.notifyPurchaseQuoteReceived({
      buyer: { id: 'b1', email: 'buyer@example.com', locale: 'ru', displayName: 'Buyer Ltd' },
      farmName: 'Kakheti Farm',
      title: 'Голубика',
      priceAmount: '12.50',
      currency: 'USD',
      requestId: 'r1',
    });
    await service.notifyPurchaseQuoteAccepted({
      farmer: { id: 'f1', email: 'farmer@example.com', locale: 'ru', displayName: 'Нино' },
      buyerName: 'Buyer Ltd',
      buyerDisplayName: 'Buyer Ltd',
      title: 'Голубика',
      requestId: 'r1',
    });
    await service.notifyPurchaseQuoteDeclined({
      farmer: { id: 'f2', email: 'loser@example.com', locale: 'ru', displayName: 'Нино' },
      buyerName: 'Buyer Ltd',
      buyerDisplayName: 'Buyer Ltd',
      title: 'Голубика',
    });
    await service.notifyPurchaseRequestWithdrawn({
      farmer: { id: 'f3', email: 'farmer@example.com', locale: 'ru', displayName: 'Нино' },
      buyerName: 'Buyer Ltd',
      buyerDisplayName: 'Buyer Ltd',
      title: 'Голубика',
      reason: 'closed',
    });

    const bodies = userNotification.create.mock.calls
      .map((call) => `${call[0].data.title} ${call[0].data.body}`)
      .join(' ');
    const hint = loadMessages('ru').subscriptions.inboxHint;
    const haystack = `${bodies} ${hint}`.toLowerCase();

    expect(haystack).toMatch(/запрос(ы)? на покупку/);
    expect(haystack).toContain('предложен');
    expect(haystack).toContain('мои предложения');
    expect(haystack).not.toContain('котиров');
    expect(haystack).not.toContain('сделка завершена');
    expect(userNotification.create.mock.calls[1][0].data.body.toLowerCase()).not.toContain('заверш');
  });
});
