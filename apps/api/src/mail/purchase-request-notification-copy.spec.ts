import { readFileSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import type { MailService } from './mail.service';
import { renderEmailTemplate } from './email-templates';

const SERVICE_SOURCE = readFileSync(join(__dirname, 'notifications.service.ts'), 'utf8');
const EMAIL_TEMPLATES_SOURCE = readFileSync(join(__dirname, 'email-templates.ts'), 'utf8');

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
    await service.notifyPurchaseQuoteWithdrawn({
      buyer: { id: 'b2', email: 'buyer@example.com', locale: 'ru', displayName: 'Buyer Ltd' },
      farmName: 'Kakheti Farm',
      title: 'Голубика',
      requestId: 'r1',
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

  it('keeps seller-affected email destination on My Quotes and opens that page in the CTA', () => {
    expect(EMAIL_TEMPLATES_SOURCE.match(/purchaseQuoteDeclined: \{/g)?.length).toBe(7);
    expect(EMAIL_TEMPLATES_SOURCE.match(/purchaseRequestClosed: \{/g)?.length).toBe(7);
    expect(EMAIL_TEMPLATES_SOURCE.match(/purchaseRequestCancelled: \{/g)?.length).toBe(7);
    expect(EMAIL_TEMPLATES_SOURCE).toContain('Open my quotes: {{link}}');
    expect(EMAIL_TEMPLATES_SOURCE).toContain('Открыть мои предложения: {{link}}');
    expect(EMAIL_TEMPLATES_SOURCE).not.toContain('Browse open purchase requests: {{link}}');
    expect(EMAIL_TEMPLATES_SOURCE).not.toContain('Смотреть открытые запросы: {{link}}');
    expect(EMAIL_TEMPLATES_SOURCE).not.toMatch(/Browse open purchase requests/i);
    expect(EMAIL_TEMPLATES_SOURCE).not.toContain('открытые запросы');

    expect(SERVICE_SOURCE).toMatch(
      /async notifyPurchaseQuoteDeclined[\s\S]*?const href = '\/dashboard\/quotes';[\s\S]*?link: this\.appLink\(locale, href\)/,
    );
    expect(SERVICE_SOURCE).toMatch(
      /async notifyPurchaseRequestWithdrawn[\s\S]*?const href = '\/dashboard\/quotes';[\s\S]*?link: this\.appLink\(locale, href\)/,
    );
    expect(SERVICE_SOURCE).toContain("link: this.appLink(locale, `/requests/${params.requestId}`)");
    expect(SERVICE_SOURCE).not.toMatch(
      /notifyPurchaseQuoteDeclined[\s\S]*?link: this\.appLink\(locale, '\/requests'\)/,
    );
    expect(SERVICE_SOURCE).not.toMatch(
      /notifyPurchaseRequestWithdrawn[\s\S]*?link: this\.appLink\(locale, '\/requests'\)/,
    );
  });

  it('renders seller-side decline/close/cancel emails onto My Quotes in every locale', () => {
    const events = [
      'purchaseQuoteDeclined',
      'purchaseRequestClosed',
      'purchaseRequestCancelled',
    ] as const;
    const openBoardPhrases = [
      /browse open purchase requests/i,
      /открытые запросы/i,
      /offene kaufanfragen/i,
      /demandes ouvertes/i,
      /richieste aperte/i,
      /solicitudes abiertas/i,
      /ღია მოთხოვნ/i,
    ];
    const ctaByLocale: Record<(typeof LOCALES)[number], string> = {
      en: 'Open my quotes',
      ru: 'Открыть мои предложения',
      ka: 'ჩემი შეთავაზებების გახსნა',
      de: 'Meine Angebote öffnen',
      fr: 'Ouvrir mes offres',
      it: 'Apri le mie offerte',
      es: 'Abrir mis ofertas',
    };

    for (const locale of LOCALES) {
      for (const event of events) {
        const rendered = renderEmailTemplate(locale, event, {
          name: 'Nino',
          buyerName: 'Buyer Ltd',
          title: 'Blueberries',
          link: `http://localhost:3000/${locale}/dashboard/quotes`,
        });
        expect(rendered.subject).toContain('Blueberries');
        expect(rendered.subject).not.toContain('{{');
        expect(rendered.text).not.toContain('{{');
        expect(rendered.text).toContain(`http://localhost:3000/${locale}/dashboard/quotes`);
        expect(rendered.text).toContain(ctaByLocale[locale]);
        expect(rendered.text).not.toContain('/requests');
        for (const phrase of openBoardPhrases) {
          expect(rendered.text).not.toMatch(phrase);
        }
      }
    }
  });

  it('renders the withdrawn-quote email onto the same request destination as in-app', () => {
    expect(EMAIL_TEMPLATES_SOURCE.match(/purchaseQuoteWithdrawn: \{/g)?.length).toBe(7);
    expect(EMAIL_TEMPLATES_SOURCE).toContain('View request: {{link}}');
    expect(EMAIL_TEMPLATES_SOURCE).toContain('{{farmName}} withdrew a quote from your purchase request');
    expect(SERVICE_SOURCE).toMatch(
      /async notifyPurchaseQuoteWithdrawn[\s\S]*?const href = `\/requests\/\$\{params\.requestId\}`;[\s\S]*?link: this\.appLink\(locale, href\)/,
    );

    for (const locale of ['en', 'ru', 'de'] as const) {
      const rendered = renderEmailTemplate(locale, 'purchaseQuoteWithdrawn', {
        name: 'Buyer Ltd',
        farmName: 'Kakheti Farm',
        title: 'Blueberries',
        link: `http://localhost:3000/${locale}/requests/r1`,
      });
      expect(rendered.subject).toContain('Blueberries');
      expect(rendered.subject).not.toContain('{{');
      expect(rendered.text).not.toContain('{{');
      expect(rendered.text).toContain(`http://localhost:3000/${locale}/requests/r1`);
      expect(rendered.text).toContain('Kakheti Farm');
      expect(rendered.text).not.toContain('/dashboard/quotes');
    }
  });
});
