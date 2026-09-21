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

const QUOTES_PAGE = 'app/[locale]/dashboard/quotes/page.tsx';
const MINE_PAGE = 'app/[locale]/dashboard/purchase-requests/page.tsx';

describe('My Quotes page chrome', () => {
  it('does not use My Purchase Requests as the quotes eyebrow', () => {
    const page = source(QUOTES_PAGE);
    expect(page).toContain("t('myQuotesTitle')");
    expect(page).toContain("t('myQuotesSubtitle')");
    expect(page).toContain("t('boardTitle')");
    expect(page).toContain("t('browseBoard')");
    expect(page).not.toContain("t('mineTitle')");
    expect(page).not.toContain('/dashboard/purchase-requests');
    expect(page).toMatch(
      /<Link href="\/requests">\{t\('boardTitle'\)\}<\/Link>\s*\{\s*' · '\s*\}\s*\{t\('myQuotesTitle'\)\}/,
    );
  });

  it('keeps My Purchase Requests using mineTitle for its own heading', () => {
    const page = source(MINE_PAGE);
    expect(page).toContain("<h1>{t('mineTitle')}</h1>");
    expect(page).toContain("t('mineSubtitle')");
    expect(page).toContain("href=\"/dashboard/quotes\"");
    expect(page).toContain("t('myQuotesTitle')");
  });

  it('keeps the top CTA as navigation to the public purchase-request board', () => {
    const page = source(QUOTES_PAGE);
    expect(page).toContain('className="button button--ghost"');
    expect(page).toContain("href=\"/requests\"");
    expect(page).toContain("t('browseBoard')");
    expect(page).not.toMatch(
      /className="button button--ghost">\s*\{t\('boardTitle'\)\}/,
    );
  });

  it('preserves compact list markup and empty-versus-error gating', () => {
    const page = source(QUOTES_PAGE);
    const list = source('components/PurchaseQuoteList.tsx');
    expect(page).toContain('PurchaseQuoteList');
    expect(page).toContain('myQuotesLoadError');
    expect(page).toContain('myQuotesEmptyTitle');
    expect(page).toMatch(
      /loadError \? \(\s*<p className="form-error">\{loadError\}<\/p>\s*\) : \(/,
    );
    expect(list).toContain('product-list__item--row');
    expect(list).not.toContain('quote-list');
    expect(list).not.toContain('OpenChatButton');
  });

  it('localizes browse and quotes chrome in every locale without котировка', () => {
    expect(read(messages('en'), 'purchaseRequests.myQuotesTitle')).toBe('My quotes');
    expect(read(messages('en'), 'purchaseRequests.browseBoard')).toBe(
      'Browse purchase requests',
    );
    expect(read(messages('en'), 'purchaseRequests.mineTitle')).toBe('My purchase requests');
    expect(read(messages('en'), 'purchaseRequests.boardTitle')).toBe('Purchase requests');
    expect(read(messages('ru'), 'purchaseRequests.myQuotesTitle')).toBe('Мои предложения');
    expect(read(messages('ru'), 'purchaseRequests.browseBoard')).toBe(
      'Смотреть запросы на покупку',
    );
    expect(read(messages('ru'), 'purchaseRequests.mineTitle')).toBe('Мои запросы на покупку');

    for (const locale of LOCALES) {
      const board = read(messages(locale), 'purchaseRequests.boardTitle');
      const mine = read(messages(locale), 'purchaseRequests.mineTitle');
      const quotes = read(messages(locale), 'purchaseRequests.myQuotesTitle');
      const browse = read(messages(locale), 'purchaseRequests.browseBoard');
      const subtitle = read(messages(locale), 'purchaseRequests.myQuotesSubtitle');

      expect(board.trim().length).toBeGreaterThan(0);
      expect(mine.trim().length).toBeGreaterThan(0);
      expect(quotes.trim().length).toBeGreaterThan(0);
      expect(browse.trim().length).toBeGreaterThan(0);
      expect(subtitle.trim().length).toBeGreaterThan(0);
      expect(quotes).not.toBe(mine);
      expect(browse.toLowerCase()).not.toBe(mine.toLowerCase());

      const haystack = [board, mine, quotes, browse, subtitle].join('\n').toLowerCase();
      expect(haystack).not.toContain('котиров');
      expect(haystack).not.toContain('quotation');
      expect(haystack).not.toMatch(/\brfq\b/);
    }

    if (LOCALES.filter((locale) => locale !== 'en').length) {
      for (const locale of LOCALES) {
        if (locale === 'en') continue;
        expect(read(messages(locale), 'purchaseRequests.browseBoard')).not.toBe(
          'Browse purchase requests',
        );
        expect(read(messages(locale), 'purchaseRequests.myQuotesTitle')).not.toBe('My quotes');
      }
    }

    const ru = read(messages('ru'), 'purchaseRequests.myQuotesSubtitle').toLowerCase();
    expect(ru).toContain('предложен');
    expect(ru).not.toContain('котиров');
  });
});
