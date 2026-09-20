import { readFileSync } from 'fs';
import { join } from 'path';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const MESSAGES_DIR = join(__dirname, '../../../web/messages');
const ACCOUNT_PAGE = join(__dirname, '../../../web/src/app/[locale]/account/page.tsx');

function loadMessages(locale: string) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
    cabinet: {
      stats: {
        completedDeals: string;
        openPurchaseRequests: string;
        pendingQuotes: string;
        acceptedQuotes: string;
        openRequests?: string;
      };
    };
  };
}

describe('cabinet marketplace overview copy and navigation', () => {
  it('localizes the marketplace activity cards in every locale', () => {
    for (const locale of LOCALES) {
      const stats = loadMessages(locale).cabinet.stats;
      expect(stats.completedDeals.trim().length).toBeGreaterThan(0);
      expect(stats.openPurchaseRequests.trim().length).toBeGreaterThan(0);
      expect(stats.pendingQuotes.trim().length).toBeGreaterThan(0);
      expect(stats.acceptedQuotes.trim().length).toBeGreaterThan(0);
      expect(stats.openRequests).toBeUndefined();
    }
  });

  it('keeps Russian marketplace wording on запрос на покупку and предложение', () => {
    const ru = loadMessages('ru').cabinet.stats;
    const haystack = [
      ru.completedDeals,
      ru.openPurchaseRequests,
      ru.pendingQuotes,
      ru.acceptedQuotes,
    ]
      .join(' ')
      .toLowerCase();

    expect(ru.openPurchaseRequests.toLowerCase()).toMatch(/запрос(ы)? на покупку/);
    expect(haystack).toContain('предложен');
    expect(haystack).not.toContain('котиров');
    expect(ru.acceptedQuotes.toLowerCase()).not.toContain('завершённ');
    expect(ru.acceptedQuotes.toLowerCase()).not.toContain('сделк');
    expect(ru.completedDeals.toLowerCase()).toContain('товар');
  });

  it('points marketplace cards at existing destinations without using registration role', () => {
    const source = readFileSync(ACCOUNT_PAGE, 'utf8');

    expect(source).toContain("href: '/dashboard/deals'");
    expect(source).toContain("href: '/dashboard/purchase-requests'");
    expect(source).toContain("href: '/dashboard/quotes'");
    expect(source).toContain('activity.openPurchaseRequests');
    expect(source).toContain('activity.pendingQuotes');
    expect(source).toContain('activity.acceptedQuotes');
    expect(source).toContain('notificationUnread.purchaseRequestsUnread');
    expect(source).toContain('notificationUnread.pendingQuotesUnread');
    expect(source).toContain('notificationUnread.acceptedQuotesUnread');
    expect(source).not.toContain('activity.openRequests');
    expect(source).not.toContain("t('stats.openRequests')");
    expect(source).not.toContain('/dashboard/inbox?status=open');
    expect(source).not.toContain("user.role === 'farmer' ? `${dealsBase}?status=open`");
  });
});
