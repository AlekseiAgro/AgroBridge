import { readFileSync } from 'fs';
import { join } from 'path';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const WEB = join(__dirname, '../../../web');
const MESSAGES_DIR = join(WEB, 'messages');

type Nested = Record<string, unknown>;

function messages(locale: string): Nested {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as Nested;
}

function read(obj: Nested, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Nested)[key];
  }, obj);
  if (typeof value !== 'string') {
    throw new Error(`Missing string ${path}`);
  }
  return value;
}

function source(relative: string): string {
  return readFileSync(join(WEB, 'src', relative), 'utf8');
}

const RFQ_INBOX_KEYS = [
  'nav.inbox',
  'nav.inboxUnread',
  'rfq.inboxTitle',
  'rfq.inboxSubtitle',
  'rfq.inboxEmpty',
] as const;

describe('incoming Product RFQ terminology', () => {
  it('keeps the /dashboard/inbox route and pending-count API', () => {
    const page = source('app/[locale]/dashboard/inbox/page.tsx');
    const detail = source('app/[locale]/dashboard/inbox/[id]/page.tsx');
    const nav = source('components/InboxNavLink.tsx');
    const unread = source('lib/inbox-unread.ts');

    expect(page).toContain("t('inboxTitle')");
    expect(page).toContain("t('inboxSubtitle')");
    expect(page).toContain("t('inboxEmpty')");
    expect(page).toContain("apiRequestAuthed<RfqSummary[]>('/rfqs/inbox')");
    expect(detail).toContain('href="/dashboard/inbox"');
    expect(nav).toContain('href="/dashboard/inbox"');
    expect(nav).toContain("t('inbox')");
    expect(nav).toContain("t('inboxUnread'");
    expect(unread).toContain("'/rfqs/inbox/unread-count'");
  });

  it('uses product-owned RFQ identity instead of generic inbox chrome', () => {
    expect(read(messages('en'), 'nav.inbox')).toBe('Requests for my products');
    expect(read(messages('en'), 'rfq.inboxTitle')).toBe('Quote requests for my products');
    expect(read(messages('en'), 'rfq.inboxSubtitle')).toBe(
      'Buyer requests for quotes on your products.',
    );
    expect(read(messages('en'), 'rfq.inboxEmpty')).toBe(
      'No quote requests for your products yet.',
    );
    expect(read(messages('ru'), 'nav.inbox')).toBe('Запросы по моим товарам');
    expect(read(messages('ru'), 'rfq.inboxTitle')).toBe('Запросы предложений по моим товарам');
    expect(read(messages('ru'), 'rfq.inboxSubtitle')).toBe(
      'Запросы покупателей на предложения по вашим товарам.',
    );
    expect(read(messages('ru'), 'rfq.inboxEmpty')).toBe(
      'Пока нет запросов предложений по вашим товарам.',
    );

    for (const locale of LOCALES) {
      for (const key of RFQ_INBOX_KEYS) {
        const value = read(messages(locale), key);
        expect(value.trim().length).toBeGreaterThan(0);
        const lower = value.toLowerCase();
        expect(lower).not.toContain('inbox');
        expect(lower).not.toContain('incoming quote requests');
        expect(lower).not.toContain('входящ');
        expect(lower).not.toContain('my quotes');
        expect(lower).not.toContain('мои предложения');
        expect(lower).not.toContain('purchase request');
        expect(lower).not.toContain('запрос на покупку');
        expect(lower).not.toContain('я продавец');
        expect(lower).not.toContain("i'm a seller");
        expect(lower).not.toContain('котиров');
        expect(lower).not.toContain('quotation');
        expect(lower).not.toContain('cotizaci');
        expect(lower).not.toMatch(/\bdevis\b/);
        expect(lower).not.toContain('preventivo');
        expect(lower).not.toMatch(/\brfq\b/);
      }
    }
  });

  it('keeps notification-center copy distinct from Product RFQ inbox', () => {
    const subscriptions = source('app/[locale]/dashboard/subscriptions/page.tsx');
    expect(subscriptions).toContain("t('inboxTitle')");
    expect(subscriptions).toContain('id="inbox"');

    expect(read(messages('en'), 'subscriptions.inboxTitle')).toBe('Inbox alerts');
    expect(read(messages('ru'), 'subscriptions.inboxTitle')).toBe('Входящие уведомления');
    expect(read(messages('en'), 'subscriptions.inboxTitle')).not.toBe(
      read(messages('en'), 'nav.inbox'),
    );
    expect(read(messages('en'), 'subscriptions.inboxTitle')).not.toBe(
      read(messages('en'), 'rfq.inboxTitle'),
    );

    for (const locale of LOCALES) {
      const notice = read(messages(locale), 'subscriptions.inboxTitle');
      expect(notice.trim().length).toBeGreaterThan(0);
      expect(notice).not.toBe(read(messages(locale), 'nav.inbox'));
      expect(notice).not.toBe(read(messages(locale), 'rfq.inboxTitle'));
    }
  });

  it('keeps outgoing Product RFQ, My Quotes, and My Purchase Requests distinct', () => {
    const outgoing = source('app/[locale]/dashboard/rfqs/page.tsx');
    const quotes = source('app/[locale]/dashboard/quotes/page.tsx');
    const mine = source('app/[locale]/dashboard/purchase-requests/page.tsx');

    expect(outgoing).toContain("apiRequestAuthed<RfqSummary[]>('/rfqs/mine')");
    expect(outgoing).toContain("t('mineTitle')");
    expect(outgoing).toContain('detailBasePath="/dashboard/rfqs"');
    expect(quotes).toContain("t('myQuotesTitle')");
    expect(quotes).toContain("'/purchase-requests/my-quotes'");
    expect(mine).toContain("t('mineTitle')");
    expect(mine).toContain("'/purchase-requests/mine'");

    expect(read(messages('en'), 'rfq.mineTitle')).toBe('My quote requests');
    expect(read(messages('ru'), 'rfq.mineTitle')).toBe('Мои запросы предложений');
    expect(read(messages('en'), 'purchaseRequests.myQuotesTitle')).toBe('My quotes');
    expect(read(messages('ru'), 'purchaseRequests.myQuotesTitle')).toBe('Мои предложения');
    expect(read(messages('en'), 'purchaseRequests.mineTitle')).toBe('My purchase requests');
    expect(read(messages('ru'), 'purchaseRequests.mineTitle')).toBe('Мои запросы на покупку');

    expect(read(messages('en'), 'rfq.mineTitle')).not.toBe(read(messages('en'), 'rfq.inboxTitle'));
    expect(read(messages('en'), 'nav.inbox')).not.toBe(
      read(messages('en'), 'purchaseRequests.myQuotesTitle'),
    );
  });

  it.each(LOCALES)('%s localizes incoming Product RFQ chrome without English leakage', (locale) => {
    for (const key of RFQ_INBOX_KEYS) {
      const value = read(messages(locale), key);
      expect(value.trim().length).toBeGreaterThan(0);
    }
    if (locale !== 'en') {
      expect(read(messages(locale), 'nav.inbox')).not.toBe('Requests for my products');
      expect(read(messages(locale), 'rfq.inboxTitle')).not.toBe('Quote requests for my products');
      expect(read(messages(locale), 'rfq.inboxEmpty')).not.toBe(
        'No quote requests for your products yet.',
      );
    }
  });
});
