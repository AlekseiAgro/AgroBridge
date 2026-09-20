import { readFileSync } from 'fs';
import { join } from 'path';
import {
  summarizeUnreadByType,
  PURCHASE_REQUEST_UNREAD_TYPES,
  QUOTE_UNREAD_TYPES,
  PENDING_QUOTE_UNREAD_TYPES,
  ACCEPTED_QUOTE_UNREAD_TYPES,
} from '@agrobridge/shared';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const MESSAGES_DIR = join(__dirname, '../../../web/messages');
const SHELL = join(__dirname, '../../../web/src/components/CabinetShell.tsx');
const ACCOUNT = join(__dirname, '../../../web/src/app/[locale]/account/page.tsx');
const BELL = join(__dirname, '../../../web/src/components/NotificationBell.tsx');
const QUOTES = join(__dirname, '../../../web/src/app/[locale]/dashboard/quotes/page.tsx');

function loadMessages(locale: string) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
    nav: Record<string, string>;
    subscriptions: Record<string, string>;
    cabinet: Record<string, string>;
  };
}

describe('cabinet notification unread mapping', () => {
  it('uses distinct totals so a field swap cannot hide a bug', () => {
    const summary = summarizeUnreadByType([
      { type: 'purchaseQuoteReceived', count: 2 },
      { type: 'purchaseQuoteWithdrawn', count: 0 },
      { type: 'purchaseQuoteAccepted', count: 1 },
      { type: 'purchaseQuoteDeclined', count: 1 },
      { type: 'purchaseRequestClosed', count: 1 },
      { type: 'purchaseRequestCancelled', count: 1 },
      { type: 'harvestAvailable', count: 1 },
    ]);

    expect(summary.totalUnread).toBe(7);
    expect(summary.count).toBe(7);
    expect(summary.purchaseRequestsUnread).toBe(2);
    expect(summary.quotesUnread).toBe(4);
    expect(summary.pendingQuotesUnread).toBe(3);
    expect(summary.acceptedQuotesUnread).toBe(1);
    expect(summary.purchaseRequestsUnread + summary.quotesUnread).not.toBe(summary.totalUnread);
  });

  it('counts harvest alerts only on the global total', () => {
    const summary = summarizeUnreadByType([
      { type: 'harvestAvailable', count: 2 },
      { type: 'harvestPreorderOpen', count: 1 },
    ]);
    expect(summary.totalUnread).toBe(3);
    expect(summary.purchaseRequestsUnread).toBe(0);
    expect(summary.quotesUnread).toBe(0);
  });

  it('keeps buyer and seller groups disjoint', () => {
    expect(PURCHASE_REQUEST_UNREAD_TYPES.some((type) => (QUOTE_UNREAD_TYPES as readonly string[]).includes(type))).toBe(
      false,
    );
    expect([...PENDING_QUOTE_UNREAD_TYPES, ...ACCEPTED_QUOTE_UNREAD_TYPES].sort()).toEqual(
      [...QUOTE_UNREAD_TYPES].sort(),
    );
  });

  it('localizes bell and unread labels in every locale', () => {
    for (const locale of LOCALES) {
      const messages = loadMessages(locale);
      const { nav, subscriptions, cabinet } = messages;
      expect(nav.notifications.trim().length).toBeGreaterThan(0);
      expect(nav.notificationsUnread).toContain('{count}');
      expect(nav.purchaseRequestsUnread).toContain('{count}');
      expect(nav.myQuotesUnread).toContain('{count}');
      expect(subscriptions.markAllRead.trim().length).toBeGreaterThan(0);
      expect(cabinet.unreadCard).toContain('{label}');
      expect(cabinet.unreadCard).toContain('{count}');
    }
  });

  it('keeps Russian marketplace wording', () => {
    const { nav } = loadMessages('ru');
    const haystack = `${nav.notifications} ${nav.purchaseRequestsUnread} ${nav.myQuotesUnread}`.toLowerCase();
    expect(haystack).toMatch(/запрос(ы|ов)? на покупку/);
    expect(haystack).toContain('предложен');
    expect(haystack).not.toContain('котиров');
  });

  it('adds the bell to the cabinet header without a new Alerts sidebar item', () => {
    const shell = readFileSync(SHELL, 'utf8');
    const account = readFileSync(ACCOUNT, 'utf8');
    const bell = readFileSync(BELL, 'utf8');

    expect(bell).toContain('/dashboard/subscriptions');
    expect(shell).toContain('NotificationBell');
    expect(shell).toContain('/dashboard/purchase-requests');
    expect(shell).toContain('/dashboard/quotes');
    expect(shell).toContain("href=\"/dashboard/subscriptions\">{t('subscriptions')}");
    expect(shell).toContain('ChatNavLink');
    expect(shell).toContain('getUnreadMessagesCount');
    expect(account).toContain('notificationUnread.purchaseRequestsUnread');
    expect(account).toContain('notificationUnread.pendingQuotesUnread');
    expect(account).toContain('notificationUnread.acceptedQuotesUnread');
    expect(account).toContain('activity.openPurchaseRequests');
    expect(account).toContain('activity.pendingQuotes');
    expect(account).toContain('activity.acceptedQuotes');
  });

  it('does not mark My Quotes notifications read when the page failed to load', () => {
    const quotes = readFileSync(QUOTES, 'utf8');
    expect(quotes).toContain('MarkSectionNotificationsRead');
    expect(quotes).toMatch(/loadError \? null : <MarkSectionNotificationsRead section="quotes" \/>/);
  });
});
