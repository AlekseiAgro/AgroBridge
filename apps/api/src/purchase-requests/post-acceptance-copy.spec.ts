import { readFileSync } from 'fs';
import { join } from 'path';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const MESSAGES_DIR = join(__dirname, '../../../web/messages');

const DELIVERY_WORDS = [
  'fulfilled',
  'исполнен',
  'исполненные',
  'შესრულებული',
  'erfüllt',
  'satisfait',
  'satisfaite',
  'satisfaites',
  'evasa',
  'evaso',
  'cumplida',
  'cumplidas',
];

function loadMessages(locale: string) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
    nav: { myQuotes: string };
    auth: { dualCapabilityHint: string };
    purchaseRequests: {
      agreementTitle: string;
      agreementBody: string;
      mineSubtitle: string;
      myQuotesTitle: string;
      myQuotesSubtitle: string;
      myQuotesEmpty: string;
      openRequest: string;
      requestUnavailable: string;
      statuses: { fulfilled: string };
    };
  };
}

describe('post-acceptance user-facing copy', () => {
  it('localizes the agreement copy in every supported locale', () => {
    for (const locale of LOCALES) {
      const copy = loadMessages(locale).purchaseRequests;
      expect(copy.agreementTitle.trim().length).toBeGreaterThan(0);
      expect(copy.agreementBody.trim().length).toBeGreaterThan(0);
      expect(copy.statuses.fulfilled.trim().length).toBeGreaterThan(0);
    }
  });

  it('does not present the technical fulfilled state as physical delivery', () => {
    for (const locale of LOCALES) {
      const copy = loadMessages(locale).purchaseRequests;
      const haystack =
        `${copy.agreementTitle} ${copy.agreementBody} ${copy.statuses.fulfilled}`.toLowerCase();
      for (const word of DELIVERY_WORDS) {
        expect(haystack).not.toContain(word);
      }
    }
  });

  it('localizes My Quotes and dual-role registration copy in every locale', () => {
    for (const locale of LOCALES) {
      const messages = loadMessages(locale);
      expect(messages.nav.myQuotes.trim().length).toBeGreaterThan(0);
      expect(messages.auth.dualCapabilityHint.trim().length).toBeGreaterThan(0);
      expect(messages.purchaseRequests.myQuotesTitle.trim().length).toBeGreaterThan(0);
      expect(messages.purchaseRequests.myQuotesSubtitle.trim().length).toBeGreaterThan(0);
      expect(messages.purchaseRequests.myQuotesEmpty.trim().length).toBeGreaterThan(0);
      expect(messages.purchaseRequests.openRequest.trim().length).toBeGreaterThan(0);
      expect(messages.purchaseRequests.requestUnavailable.trim().length).toBeGreaterThan(0);
      expect(messages.purchaseRequests.mineSubtitle.toLowerCase()).not.toContain('accepted your');
    }
  });

  it('keeps Russian quote wording on предложение, not котировка', () => {
    const ru = loadMessages('ru');
    const haystack = [
      ru.nav.myQuotes,
      ru.purchaseRequests.mineSubtitle,
      ru.purchaseRequests.myQuotesTitle,
      ru.purchaseRequests.myQuotesSubtitle,
      ru.purchaseRequests.myQuotesEmpty,
      ru.purchaseRequests.agreementBody,
      ru.purchaseRequests.statuses.fulfilled,
    ]
      .join(' ')
      .toLowerCase();
    expect(haystack).toContain('предложен');
    expect(haystack).not.toContain('котиров');
  });
});
